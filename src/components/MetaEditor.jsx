import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, ImageUp, Undo2, X } from 'lucide-react';
import { GROUPS, applyFields, readFields, readMeta, sizeText, writeMeta, writeTiff } from '../exif';
import { loadImage, makeThumb } from '../imageConvert';
import { downloadBlob, isImageFile, isPdfFile, shortName, useDoneFlags, usePastedFiles } from '../utils';
import { MOTION_MS, fadeIn, fadeInOnLoad } from '../motion';
import { whenStill } from '../engine';
import { useToast } from '../toastContext';
import AutoHeight from './AutoHeight';
import Collapse from './Collapse';
import Count from './Count';
import FadeText from './FadeText';
import FlipRow from './FlipRow';
import ActionBar from './ActionBar';
import MotionList from './MotionList';

const MAKES = ['Apple', 'samsung', 'Google', 'Sony', 'Canon', 'NIKON CORPORATION', 'FUJIFILM', 'OLYMPUS', 'Panasonic', 'Xiaomi', 'OnePlus', 'HUAWEI'];
const MODELS = [
  'iPhone 17 Pro Max', 'iPhone 17 Pro', 'iPhone 17', 'iPhone Air', 'iPhone 16 Pro Max', 'iPhone 16 Pro', 'iPhone 16', 'iPhone 16e',
  'iPhone 15 Pro Max', 'iPhone 15 Pro', 'iPhone 15', 'iPhone 14 Pro Max', 'iPhone 14 Pro', 'iPhone 13 Pro Max', 'iPhone 13',
  'Pixel 10 Pro', 'Pixel 10', 'Pixel 9 Pro', 'Pixel 9',
];
const NUMERIC = new Set(['int', 'rational', 'exposure', 'lat', 'lon', 'alt']);

// The details outside the tags: XMP (Lightroom's, the phone's edits) and
// IPTC (captions, credits) — kept, or dropped whole
function extraFields(meta) {
  const out = [];
  if (meta.xmp) out.push({ id: 'xmp', kind: 'raw', group: 'other', label: 'XMP', value: sizeText(meta.xmp), readOnly: true });
  if (meta.iptc) out.push({ id: 'iptc', kind: 'raw', group: 'other', label: 'IPTC', value: sizeText(meta.iptc), readOnly: true });
  return out;
}

function FieldInput({ f, value, onChange }) {
  const common = { id: `meta-${f.id}`, className: 'text-input meta-input', value, onChange: (e) => onChange(e.target.value) };
  if (f.kind === 'raw') {
    return <input {...common} readOnly placeholder="removed" title="kept as it is, or removed" />;
  }
  if (f.kind === 'date') {
    return <input {...common} type="datetime-local" step="1" />;
  }
  if (f.kind === 'select') {
    const opts = f.options.some(([v]) => String(v) === value) || !value ? f.options : [...f.options, [value, value]];
    return (
      <select {...common}>
        <option value="">—</option>
        {opts.map(([v, label]) => <option key={v} value={String(v)}>{label}</option>)}
      </select>
    );
  }
  return (
    <input
      {...common}
      type="text"
      inputMode={NUMERIC.has(f.kind) ? 'decimal' : undefined}
      placeholder={f.hint || ''}
      list={f.id === 'make' ? 'meta-makes' : f.id === 'model' ? 'meta-models' : undefined}
      spellCheck={false}
      autoComplete="off"
    />
  );
}

// A photo's details, changed or removed in the file itself: the picture's
// own bytes are copied as they are, so a photo from an iPhone still says
// it was taken on that iPhone (a redrawn copy loses all of it)
export default function MetaEditor({ active }) {
  const [item, setItem] = useState(null); // { file, bytes, meta, fields, thumb, w, h }
  const [values, setValues] = useState({});
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, flagDone] = useDoneFlags();
  // What shows while the fields leave
  const [shown, setShown] = useState(null);
  const inputRef = useRef(null);
  const fieldsRef = useRef(null);
  const toast = useToast();
  // The photo leaving (the clear): its spot holds its height while the card
  // pops out where it is, then the box goes back to empty (as in the converter)
  const slotRef = useRef(null);
  const [hold, setHold] = useState(0);
  const holdTimer = useRef(null);
  useEffect(() => () => clearTimeout(holdTimer.current), []);

  const release = (it) => { if (it) setTimeout(() => URL.revokeObjectURL(it.thumb), MOTION_MS + 300); };

  const addFile = useCallback(async (fileList) => {
    const file = [...fileList].find(isImageFile);
    if (!file) {
      if (fileList.length) toast(isPdfFile(fileList[0]) ? 'PDFs go in PDF tools' : "that isn't an image", { warn: true });
      return;
    }
    const url = URL.createObjectURL(file);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let meta;
      try {
        meta = readMeta(bytes);
      } catch {
        meta = { format: null };
      }
      if (!meta.format) {
        toast('only JPG, PNG and WEBP details can be changed here', { warn: true });
        return;
      }
      const img = await loadImage(url);
      // Drawn small once nothing's moving (it's heavy work on the page's thread)
      await whenStill();
      const thumb = await makeThumb(img);
      const fields = [...readFields(meta.tiff), ...extraFields(meta)];
      const next = { file, bytes, meta, fields, thumb, w: img.naturalWidth, h: img.naturalHeight };
      clearTimeout(holdTimer.current);
      setHold(0);
      setItem((old) => { release(old); return next; });
      setShown(next);
      setValues(Object.fromEntries(fields.map(f => [f.id, f.value])));
      // Another photo's fields fade in where the last one's were
      if (itemRef.current) requestAnimationFrame(() => fadeIn(fieldsRef.current));
    } catch {
      toast(`couldn't open ${shortName(file.name) || 'that image'}`, { warn: true });
    } finally {
      URL.revokeObjectURL(url);
    }
  }, [toast]);

  usePastedFiles(active, isImageFile, addFile);

  const clear = () => {
    if (!item) return;
    setHold(slotRef.current?.offsetHeight || 0);
    clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => setHold(0), MOTION_MS + 100);
    release(item);
    setItem(null);
  };
  const itemRef = useRef(item);
  itemRef.current = item;
  const shownRef = useRef(shown);
  shownRef.current = shown;
  useEffect(() => () => { if (shownRef.current) URL.revokeObjectURL(shownRef.current.thumb); }, []);

  const fields = shown?.fields || [];
  const set = (id, v) => setValues(vals => ({ ...vals, [id]: v }));

  const stats = useMemo(() => {
    let filled = 0;
    let changed = 0;
    let removed = 0;
    if (item) {
      item.fields.forEach((f) => {
        const now = values[f.id] ?? '';
        if (now.trim()) filled++;
        if (f.value && !now.trim()) removed++;
        else if (now !== f.value && now.trim()) changed++;
      });
    }
    return { filled, changed, removed };
  }, [item, values]);

  const reset = () => item && setValues(Object.fromEntries(item.fields.map(f => [f.id, f.value])));

  const save = async (e) => {
    if (e.detail) e.currentTarget.blur();
    if (!item || busy) return;
    const res = applyFields(item.meta.tiff, item.fields, values);
    if (res.error) {
      toast(res.error, { warn: true });
      return;
    }
    setBusy(true);
    try {
      const opts = { dropXmp: values.xmp === '', dropIptc: values.iptc === '', size: { width: item.w, height: item.h } };
      let out;
      try {
        out = writeMeta(item.bytes, writeTiff(res.tiff), opts);
      } catch (err) {
        // Too much for a JPG's block: the small preview goes first
        if (!res.tiff.thumb) throw err;
        out = writeMeta(item.bytes, writeTiff({ ...res.tiff, thumb: null, ifd1: new Map() }), opts);
        toast('the small preview was left out to fit', { warn: true });
      }
      downloadBlob(new Blob([out], { type: item.file.type || 'image/jpeg' }), item.file.name || `photo.${item.meta.format === 'jpeg' ? 'jpg' : item.meta.format}`);
      flagDone('save');
    } catch (err) {
      toast(err?.message ? `couldn't save: ${err.message}` : "couldn't save", { warn: true });
    } finally {
      setBusy(false);
    }
  };

  const groups = GROUPS
    .map(([key, title]) => [key, title, fields.filter(f => f.group === key)])
    .filter(([, , list]) => list.length);

  return (
    <div className="tool">
      <p className="tool-desc">change or remove a photo's details — the picture itself isn't touched</p>
      {/* The converter's box: the photo is a card that pops in and out the
          same way, centred */}
      <div
        className={`tool-box pdf-drop image-drop meta-drop ${item ? 'has-pages' : ''} ${dragging ? 'dragging' : ''}`}
        onClick={(e) => { if (!item || e.target === e.currentTarget || e.target.classList.contains('pdf-drop-inner')) inputRef.current?.click(); }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false); }}
        onDrop={(e) => { e.preventDefault(); setDragging(false); addFile(e.dataTransfer?.files || []); }}
        role="button"
        tabIndex={0}
        aria-label="Choose a photo"
        onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); inputRef.current?.click(); } }}
      >
        <div className={`pdf-drop-inner ${item || hold ? 'full' : 'drop-box-empty'}`}>
          <FadeText k={!item && !hold ? 'hint' : ''} quiet={!!item} className="tool-hint">{!item && !hold ? 'drop, paste or click to add a photo' : null}</FadeText>
          <div ref={slotRef} className="meta-slot" style={hold ? { minHeight: `${hold}px` } : undefined}>
            <MotionList
              items={item ? [item] : []}
              getKey={it => it.thumb}
              variant="grid"
              className="meta-grid"
              renderItem={it => (
                <div className="page-card meta-card">
                  <div className="page-thumb">
                    <img src={it.thumb} alt={it.file.name || 'photo'} decoding="async" draggable={false} onLoad={fadeInOnLoad} />
                  </div>
                  <div className="page-label">
                    <span className="page-src page-name">{it.file.name || 'pasted image'}</span>
                    <span>{it.w}×{it.h}</span>
                  </div>
                </div>
              )}
            />
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/*"
          hidden
          onChange={(e) => { addFile(e.target.files || []); e.target.value = ''; }}
        />
      </div>

      <div className="tool-meta tool-stats" aria-live="polite">
        details <Count value={stats.filled} /> · changed <Count value={stats.changed} /> · removed <Count value={stats.removed} />
      </div>

      <Collapse open={!!item} className="options-collapse">
        <AutoHeight className="tool-box meta-fields-box" innerClassName="meta-fields-inner">
          <div ref={fieldsRef} className="meta-fields">
          {groups.map(([key, title, list]) => (
            <section key={`${shown?.thumb}-${key}`} className="meta-group">
              <h3 className="meta-group-title">{title}</h3>
              {list.map((f) => {
                const now = values[f.id] ?? '';
                const changed = now !== f.value;
                return (
                  <div key={f.id} className={`meta-row ${changed ? 'changed' : ''}`}>
                    <label className="meta-label" htmlFor={`meta-${f.id}`}>{f.label}</label>
                    <FieldInput f={f} value={now} onChange={v => set(f.id, v)} />
                    <button
                      className="btn btn-sm btn-icon meta-remove"
                      onClick={(e) => { if (e.detail) e.currentTarget.blur(); set(f.id, changed && !now ? f.value : ''); }}
                      disabled={!now && !changed}
                      title={!now && changed ? `Put back ${f.label}` : `Remove ${f.label}`}
                      aria-label={!now && changed ? `Put back ${f.label}` : `Remove ${f.label}`}
                    >
                      {/* The icons swap (the text swap) */}
                      <FadeText k={!now && changed ? 'undo' : 'x'} className="meta-icon">{!now && changed ? <Undo2 size={12} /> : <X size={12} />}</FadeText>
                    </button>
                  </div>
                );
              })}
            </section>
          ))}
          </div>
        </AutoHeight>
      </Collapse>
      <datalist id="meta-makes">{MAKES.map(m => <option key={m} value={m} />)}</datalist>
      <datalist id="meta-models">{MODELS.map(m => <option key={m} value={m} />)}</datalist>

      <FlipRow>
        <button className="btn btn-icon" onClick={(e) => { if (e.detail) e.currentTarget.blur(); inputRef.current?.click(); }} title="Choose a photo" aria-label="Choose a photo">
          <ImageUp size={14} />
        </button>
        <button className={`btn btn-primary ${done.save ? 'btn-done' : ''}`} onClick={save} disabled={!item || busy}>
          <Download size={14} />
          save
        </button>
      </FlipRow>

      <ActionBar active={active} open={!!item} onClose={clear} closeDisabled={!item} label="Details">
        <button className="bulk-btn" onClick={(e) => { if (e.detail) e.currentTarget.blur(); reset(); }} disabled={!stats.changed && !stats.removed}>
          reset
        </button>
      </ActionBar>
    </div>
  );
}
