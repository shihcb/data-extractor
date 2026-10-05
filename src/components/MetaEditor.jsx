import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, ImageUp, X } from 'lucide-react';
import { zipSync } from 'fflate';
import { GROUPS, applyFields, readFields, readMeta, sizeText, writeMeta, writeTiff } from '../exif';
import { loadImage, makeThumb } from '../imageConvert';
import { downloadBlob, isImageFile, isPdfFile, keepFocusAfterRemove, shortName, uniqueNamer, useDoneFlags, usePastedFiles } from '../utils';
import { MOTION_MS, fadeInOnLoad } from '../motion';
import { whenStill } from '../engine';
import { useToast } from '../toastContext';
import AutoHeight from './AutoHeight';
import Collapse from './Collapse';
import Count from './Count';
import FadeText from './FadeText';
import FlipRow from './FlipRow';
import ActionBar from './ActionBar';
import MotionList from './MotionList';
import SlideText from './SlideText';
import useHistory, { useUndoKeys } from '../useHistory';

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

function FieldInput({ f, value, onChange, id }) {
  const common = { id, className: 'text-input meta-input', value, onChange: (e) => onChange(e.target.value) };
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
      list={f.id === 'make' ? 'meta-makes' : f.id === 'model' ? 'meta-models' : undefined}
      spellCheck={false}
      autoComplete="off"
    />
  );
}

let nextId = 1;
const startValues = (fields) => Object.fromEntries(fields.map(f => [f.id, f.value]));

// A photo's file with its details as they are now: the picture's own bytes
// are copied untouched ({ bytes } or { error })
function edited(it) {
  const res = applyFields(it.meta.tiff, it.fields, it.values);
  if (res.error) return res;
  const opts = { dropXmp: it.values.xmp === '', dropIptc: it.values.iptc === '', size: { width: it.w, height: it.h } };
  try {
    return { bytes: writeMeta(it.bytes, writeTiff(res.tiff), opts) };
  } catch (err) {
    // Too much for a JPG's block: the small preview goes first
    if (!res.tiff.thumb) return { error: err?.message || "couldn't save" };
    return { bytes: writeMeta(it.bytes, writeTiff({ ...res.tiff, thumb: null, ifd1: new Map() }), opts), smaller: true };
  }
}

// A photo's details, changed or removed in the file itself: the picture's
// own bytes are copied as they are, so a photo from an iPhone still says
// it was taken on that iPhone (a redrawn copy loses all of it). The photos
// sit in the converter's box as the same cards; the one selected (one at
// a time) is the one whose details show below.
export default function MetaEditor({ active }) {
  // The photos and every change to their details, with undo / redo as in
  // every tab (typing in one box is a step per burst; clear ends it all)
  const [items, setItems, history] = useHistory([]); // { id, file, bytes, meta, fields, values, thumb, w, h }
  useUndoKeys(active, history, { inFields: true });
  // Every photo since the last clear (an undone delete brings one back)
  const seen = useRef(new Set());
  const [pickedId, setPickedId] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, flagDone] = useDoneFlags();
  const inputRef = useRef(null);
  const boxRef = useRef(null);
  const toast = useToast();
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // The last photos leaving (the clear): the box's content holds its height
  // while they pop out where they are, then the box goes back to empty
  const [hold, setHold] = useState(0);
  const holdTimer = useRef(null);
  const holdWhileLeaving = () => {
    const inner = boxRef.current?.firstElementChild;
    if (!inner) return;
    setHold(inner.offsetHeight);
    clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => setHold(0), MOTION_MS + 100);
  };
  useEffect(() => () => clearTimeout(holdTimer.current), []);

  const picked = items.find(i => i.id === pickedId) || null;

  const release = (list) => setTimeout(() => list.forEach(it => URL.revokeObjectURL(it.thumb)), MOTION_MS + 300);
  useEffect(() => () => seen.current.forEach(it => URL.revokeObjectURL(it.thumb)), []);

  // Another photo's details fade in where the last one's were
  const select = (id) => {
    if (id === pickedId) return;
    setPickedId(id);
  };

  const addFiles = useCallback(async (fileList) => {
    const files = [...fileList].filter(isImageFile);
    if (!files.length) {
      if (fileList.length) toast(isPdfFile(fileList[0]) ? 'PDFs go in PDF tools' : "that isn't an image", { warn: true });
      return;
    }
    const failed = [];
    let wrongKind = 0;
    const loaded = await Promise.all(files.map(async (file) => {
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
          wrongKind++;
          return null;
        }
        const img = await loadImage(url);
        // Drawn small once nothing's moving (heavy work on the page's thread)
        await whenStill();
        const thumb = await makeThumb(img);
        const fields = [...readFields(meta.tiff), ...extraFields(meta)];
        return { id: nextId++, file, bytes, meta, fields, values: startValues(fields), thumb, w: img.naturalWidth, h: img.naturalHeight };
      } catch {
        failed.push(file);
        return null;
      } finally {
        URL.revokeObjectURL(url);
      }
    }));
    // Said once for all that couldn't be used
    if (wrongKind) toast('only JPG, PNG and WEBP details can be changed here', { warn: true });
    else if (failed.length) toast(failed.length === 1 ? `couldn't open ${shortName(failed[0].name) || 'that image'}` : `couldn't open ${failed.length} images`, { warn: true });
    const ok = loaded.filter(Boolean);
    if (!ok.length) return;
    clearTimeout(holdTimer.current);
    setHold(0);
    ok.forEach(it => seen.current.add(it));
    setItems(prev => [...prev, ...ok]);
    // Nothing selected yet: the first new photo is
    setPickedId(id => id ?? ok[0].id);
  }, [toast, setItems]);

  usePastedFiles(active, isImageFile, addFiles);

  // An undo took the selected photo away (or brought photos back with none
  // selected): the first one is
  useEffect(() => {
    if (items.length && !items.some(i => i.id === pickedId)) {
      setPickedId(items[0].id);
    } else if (!items.length && pickedId !== null) {
      holdWhileLeaving();
      setPickedId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const removeItems = (ids) => {
    const gone = items.filter(i => ids.has(i.id));
    if (!gone.length) return;
    const rest = items.filter(i => !ids.has(i.id));
    if (!rest.length) holdWhileLeaving();
    setItems(rest);
    // The selected one gone: the one that took its place (or the one before)
    if (ids.has(pickedId) && rest.length) {
      const at = items.findIndex(i => i.id === pickedId);
      const next = items.slice(at + 1).find(i => !ids.has(i.id)) || items.slice(0, at).reverse().find(i => !ids.has(i.id));
      select(next.id);
    } else if (!rest.length) {
      setPickedId(null);
    }
  };

  const clearAll = () => {
    if (!items.length) return;
    holdWhileLeaving();
    release([...seen.current]);
    seen.current = new Set();
    history.reset([]);
    setPickedId(null);
  };

  const move = (id, by) => setItems(prev => {
    const i = prev.findIndex(p => p.id === id);
    const j = i + by;
    if (i < 0 || j < 0 || j >= prev.length) return prev;
    const next = prev.slice();
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });

  const setValue = (fieldId, v) => setItems(prev => prev.map(it => (it.id === pickedId ? { ...it, values: { ...it.values, [fieldId]: v } } : it)), `${pickedId}:${fieldId}`);
  const reset = () => setItems(prev => prev.map(it => (it.id === pickedId ? { ...it, values: startValues(it.fields) } : it)));

  const stats = useMemo(() => {
    let filled = 0;
    let changed = 0;
    let removed = 0;
    picked?.fields.forEach((f) => {
      const now = picked.values[f.id] ?? '';
      if (now.trim()) filled++;
      if (f.value && !now.trim()) removed++;
      else if (now !== f.value && now.trim()) changed++;
    });
    return { filled, changed, removed };
  }, [picked]);

  // Every photo, each with its own changes: one as itself, several in a zip
  const save = async (e) => {
    if (e.detail) e.currentTarget.blur();
    if (!items.length || busy) return;
    setBusy(true);
    try {
      const outs = [];
      for (const it of items) {
        const out = edited(it);
        if (out.error) {
          // Its details show, so the one to put right is in view
          select(it.id);
          toast(items.length > 1 ? `${shortName(it.file.name) || 'a photo'}: ${out.error}` : out.error, { warn: true });
          return;
        }
        outs.push({ it, ...out });
      }
      const nameOf = (it) => it.file.name || `photo.${it.meta.format === 'jpeg' ? 'jpg' : it.meta.format}`;
      if (outs.length === 1) {
        const [{ it, bytes }] = outs;
        downloadBlob(new Blob([bytes], { type: it.file.type || 'image/jpeg' }), nameOf(it));
      } else {
        const unique = uniqueNamer();
        const files = {};
        outs.forEach(({ it, bytes }) => { files[unique(nameOf(it))] = bytes; });
        downloadBlob(new Blob([zipSync(files, { level: 0 })], { type: 'application/zip' }), 'photos.zip');
      }
      flagDone('save');
      if (outs.some(o => o.smaller)) toast('the small preview was left out to fit', { warn: true });
    } finally {
      setBusy(false);
    }
  };

  const onDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false);
  };

  // One photo's details (the one leaving keeps its own while it goes)
  const renderDetails = (it) => GROUPS
    .map(([key, title]) => [key, title, it.fields.filter(f => f.group === key)])
    .filter(([, , list]) => list.length)
    .map(([key, title, list]) => (
      <section key={key} className="meta-group">
        <h3 className="meta-group-title">{title}</h3>
        {list.map((f) => {
          const now = it.values[f.id] ?? '';
          const changed = now !== f.value;
          const id = `meta-${it.id}-${f.id}`;
          return (
            <div key={f.id} className={`meta-row ${changed ? 'changed' : ''}`}>
              <label className="meta-label" htmlFor={id}>{f.label}</label>
              <FieldInput f={f} id={id} value={now} onChange={v => setValue(f.id, v)} />
              {/* Only a box with something in it has a remove button: it
                  slides open as you type (the word slide, as "px wide"
                  does) and shut when the box empties */}
              <SlideText show={!!now}>
                <button
                  className="btn btn-sm btn-icon meta-remove"
                  onClick={(e) => { if (e.detail) e.currentTarget.blur(); setValue(f.id, ''); }}
                  tabIndex={now ? undefined : -1}
                  title={`Remove ${f.label}`}
                  aria-label={`Remove ${f.label}`}
                >
                  <X size={12} />
                </button>
              </SlideText>
            </div>
          );
        })}
      </section>
    ));

  return (
    <div className="tool">
      <p className="tool-desc">change or remove photos' details — the pictures themselves aren't touched</p>
      {/* The converter's box: the photos as the same cards, popping in and out */}
      <div
        ref={boxRef}
        className={`tool-box pdf-drop image-drop ${items.length ? 'has-pages' : ''} ${dragging ? 'dragging' : ''}`}
        onClick={(e) => { if (!items.length || e.target === e.currentTarget || e.target.classList.contains('pdf-drop-inner')) inputRef.current?.click(); }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={onDragLeave}
        onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer?.files || []); }}
        aria-label="Add photos"
      >
        <div
          className={`pdf-drop-inner ${items.length || hold ? 'full' : 'drop-box-empty'}`}
          style={hold ? { minHeight: `${hold}px` } : undefined}
        >
          <FadeText k={!items.length && !hold ? 'hint' : ''} quiet={items.length > 0} className="tool-hint">{!items.length && !hold ? 'drop, paste or click to add photos' : null}</FadeText>
          <MotionList
            items={items}
            getKey={it => it.id}
            variant="grid"
            className="page-grid"
            renderItem={(it) => {
              const n = items.findIndex(q => q.id === it.id);
              const isSel = it.id === pickedId;
              const name = it.file.name || 'pasted image';
              return (
                <div className={`page-card ${isSel ? 'selected' : ''}`}>
                  <button
                    className="page-thumb"
                    onClick={(e) => { if (e.detail) e.currentTarget.blur(); select(it.id); }}
                    aria-pressed={isSel}
                    title={isSel ? 'Showing its details' : 'Show its details'}
                  >
                    <img src={it.thumb} alt={name} decoding="async" draggable={false} onLoad={fadeInOnLoad} />
                  </button>
                  <div className="page-label">
                    <span className="page-src page-name">{name}</span>
                    <span>{it.w}×{it.h}</span>
                  </div>
                  <div className="page-buttons">
                    <button className="btn btn-sm btn-icon" onClick={(e) => { if (e.detail) e.currentTarget.blur(); move(it.id, -1); }} disabled={n <= 0} title="Move earlier" aria-label="Move earlier"><ChevronLeft size={12} /></button>
                    <button className="btn btn-sm btn-icon" onClick={(e) => { if (e.detail) e.currentTarget.blur(); move(it.id, 1); }} disabled={n < 0 || n >= items.length - 1} title="Move later" aria-label="Move later"><ChevronRight size={12} /></button>
                    <button className="btn btn-sm btn-icon" onClick={(e) => { if (e.detail) e.currentTarget.blur(); else keepFocusAfterRemove(e.currentTarget); removeItems(new Set([it.id])); }} title="Remove" aria-label={`Remove ${name}`}><X size={12} /></button>
                  </div>
                </div>
              );
            }}
          />
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/*"
            multiple
            hidden
            onChange={(e) => { addFiles(e.target.files || []); e.target.value = ''; }}
          />
        </div>
      </div>

      {/* Label first, only the numbers change: the photos, then the
          selected one's details */}
      <div className="tool-meta tool-stats" aria-live="polite">
        images <Count value={items.length} /> · details <Count value={stats.filled} /> · changed <Count value={stats.changed} /> · removed <Count value={stats.removed} />
      </div>


      <Collapse open={!!picked} className="options-collapse">
        <AutoHeight className="tool-box meta-fields-box" innerClassName="meta-fields-inner">
          {/* Switching photos, the details swap the way the cards do: the
              old ones pop out where they are as the new ones pop in */}
          <MotionList
            items={picked ? [picked] : []}
            getKey={it => it.id}
            variant="grid"
            className="meta-details-list"
            renderItem={it => <div className="meta-fields">{renderDetails(it)}</div>}
          />
        </AutoHeight>
      </Collapse>
      {/* Under the details, as in the converter: the details are a box of
          one fixed size that scrolls inside, so opening it slides these down
          a box's height on the shared curve, not a whole page of rows */}
      <FlipRow>
        <button className="btn btn-icon" onClick={(e) => { if (e.detail) e.currentTarget.blur(); inputRef.current?.click(); }} title="Add photos" aria-label="Add photos">
          <ImageUp size={14} />
        </button>
        <button className={`btn btn-primary ${done.save ? 'btn-done' : ''}`} onClick={save} disabled={!items.length || busy}>
          <Download size={14} />
          save
        </button>
      </FlipRow>
      <datalist id="meta-makes">{MAKES.map(m => <option key={m} value={m} />)}</datalist>
      <datalist id="meta-models">{MODELS.map(m => <option key={m} value={m} />)}</datalist>


      <ActionBar active={active} open={items.length > 0} onClose={clearAll} closeDisabled={!items.length} label="Details" history={history}>
        <button className="bulk-btn" onClick={(e) => { if (e.detail) e.currentTarget.blur(); reset(); }} disabled={!stats.changed && !stats.removed}>
          reset
        </button>
      </ActionBar>
    </div>
  );
}
