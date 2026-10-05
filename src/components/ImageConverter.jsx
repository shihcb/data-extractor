import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Copy, Download, ImageUp, X } from 'lucide-react';
import { zipSync } from 'fflate';
import { IMAGE_FORMATS, encodeImage, estimateImage, jpegsToPdf, loadImage, makeThumb, targetSize } from '../imageConvert';
import { baseName, copyImageBlob, downloadBlob, isImageFile, isPdfFile, keepFocusAfterRemove, shortName, uniqueNamer, useDoneFlags, usePastedFiles } from '../utils';
import { MOTION_MS, fadeInOnLoad } from '../motion';
import { useToast } from '../toastContext';
import TabSwitcher from './TabSwitcher';
import MotionList from './MotionList';
import Collapse from './Collapse';
import Count from './Count';
import FadeText from './FadeText';
import FlipRow from './FlipRow';
import BulkBar from './BulkBar';
import SlideSwap from './SlideSwap';

const RESIZE_MODES = [
  { key: 'percent', label: 'scale %' },
  { key: 'width',   label: 'width px' },
];

let nextId = 1;

// Always in KB, so only the number changes (never "B" → "KB" → "MB")
// (a tiny file is still at least 1 KB: "0 KB" read as nothing at all)
const kb = (n) => `${(n > 0 ? Math.max(1, Math.round(n / 1024)) : 0).toLocaleString()} KB`;

// Frees what an image holds once it's gone: its links and its decoded copy
function releaseItem(item) {
  URL.revokeObjectURL(item.url);
  URL.revokeObjectURL(item.thumb);
  item._bitmap?.then(b => b.close(), () => {});
}

export default function ImageConverter({ active }) {
  const [items, setItems] = useState([]); // { id, file, url, img, w, h }
  const [picked, setPicked] = useState(() => new Set()); // ids of the selected cards
  const [format, setFormat] = useState('png');
  const [resizeMode, setResizeMode] = useState('percent');
  const [percent, setPercent] = useState('100');
  const [widthPx, setWidthPx] = useState('');
  const [quality, setQuality] = useState(90);
  const [estimate, setEstimate] = useState(null); // { width, height, size, ext, fellBack }
  const [busy, setBusy] = useState('');
  const [dragging, setDragging] = useState(false);
  const [done, flagDone] = useDoneFlags();
  const inputRef = useRef(null);
  const boxRef = useRef(null);
  // The last images leaving: the box's content holds its height while they
  // pop out where they are, then the box goes back to empty (as in PDF tools)
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
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const toast = useToast();

  // The image the size line and copy are about: the first selected one
  // (in order), else the first image
  const selected = items.find(i => picked.has(i.id)) || items[0] || null;
  const fmt = IMAGE_FORMATS.find(f => f.key === format);

  const resize = useMemo(() => ({
    mode: resizeMode,
    percent: parseFloat(percent),
    width: parseInt(widthPx, 10),
  }), [resizeMode, percent, widthPx]);

  const settings = useMemo(() => ({ format, resize, quality }), [format, resize, quality]);

  const addFiles = useCallback(async (fileList) => {
    const files = [...fileList].filter(isImageFile);
    if (!files.length) {
      // (a PDF dropped here did nothing at all)
      if (fileList.length) toast(isPdfFile(fileList[0]) ? 'PDFs go in PDF tools' : "that isn't an image", { warn: true });
      return;
    }
    const failed = [];
    const loaded = await Promise.all(files.map(async (file) => {
      const url = URL.createObjectURL(file);
      try {
        const img = await loadImage(url);
        const thumb = await makeThumb(img);
        return { id: nextId++, file, url, thumb, img, w: img.naturalWidth, h: img.naturalHeight };
      } catch {
        URL.revokeObjectURL(url);
        failed.push(file);
        return null;
      }
    }));
    // Said once for all that failed (one after another, only the last showed)
    if (failed.length) toast(failed.length === 1 ? `couldn't open ${shortName(failed[0].name) || 'that image'}` : `couldn't open ${failed.length} images`, { warn: true });
    const ok = loaded.filter(Boolean);
    if (!ok.length) return;
    clearTimeout(holdTimer.current);
    setHold(0);
    setItems(prev => [...prev, ...ok]);
    // A width to start from: the first image's own
    setWidthPx(w => w || String(ok[0].w));
  }, [toast]);

  usePastedFiles(active, isImageFile, addFiles);

  const removeItems = (ids) => {
    const gone = items.filter(i => ids.has(i.id));
    if (!gone.length) return;
    const rest = items.filter(i => !ids.has(i.id));
    if (!rest.length) holdWhileLeaving();
    setItems(rest);
    setPicked(sel => new Set([...sel].filter(id => !ids.has(id))));
    if (!rest.length) setWidthPx('');
    // After their cards have left (they still show the picture until then)
    setTimeout(() => gone.forEach(releaseItem), MOTION_MS + 300);
  };

  const move = (id, by) => setItems(prev => {
    const i = prev.findIndex(p => p.id === id);
    const j = i + by;
    if (i < 0 || j < 0 || j >= prev.length) return prev;
    const next = prev.slice();
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });

  const toggle = (id) => setPicked(sel => {
    const next = new Set(sel);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const clearAll = () => {
    const old = items;
    holdWhileLeaving();
    setItems([]);
    setPicked(new Set());
    setWidthPx('');
    setTimeout(() => old.forEach(releaseItem), MOTION_MS + 300);
  };

  useEffect(() => () => itemsRef.current.forEach(releaseItem), []);

  // What the selected image comes out as with these settings (encoded for
  // real, a moment after the last change). A newly picked image waits until
  // the rows and boxes have finished moving (encoding a big image blocks the
  // page, which stuttered the slide-in); a settings change is quick, so the
  // size doesn't sit on the old format's number.
  const estimatedFor = useRef(null);
  const lastEstimated = useRef(null);
  useEffect(() => {
    if (!selected) {
      setEstimate(null);
      estimatedFor.current = null;
      return;
    }
    let cancelled = false;
    const newImage = estimatedFor.current !== selected.id;
    // The last image's decoded copy is let go once another is the one
    // estimated (kept, every photo ever picked held a full-size copy)
    const before = lastEstimated.current;
    if (before && before !== selected) {
      before._bitmap?.then(b => b.close(), () => {});
      before._bitmap = null;
    }
    lastEstimated.current = selected;
    const t = setTimeout(async () => {
      try {
        const out = await estimateImage(selected, settings);
        if (cancelled) return;
        estimatedFor.current = selected.id;
        setEstimate({ ...out, pdf: settings.format === 'pdf', id: selected.id });
      } catch {
        if (!cancelled) setEstimate(null);
      }
      // Always after the motion has finished: any heavy work while something
      // moves can make it stutter on a phone
    }, MOTION_MS + (newImage ? 150 : 60));
    return () => { cancelled = true; clearTimeout(t); };
  }, [selected, settings]);

  const handleDownload = async (e) => {
    if (e.detail) e.currentTarget.blur();
    if (!items.length || busy) return;
    const list = items;
    try {
      let blob;
      let name;
      let fellBack = false;
      let clamped = false;
      if (format === 'pdf') {
        const pages = [];
        for (let i = 0; i < list.length; i++) {
          setBusy('on');
          pages.push(await encodeImage(list[i].img, settings));
          clamped = clamped || pages[i].clamped;
        }
        setBusy('on');
        blob = await jpegsToPdf(pages);
        name = list.length === 1 ? `${baseName(list[0].file.name)}.pdf` : 'images.pdf';
      } else if (list.length === 1) {
        setBusy('on');
        const out = await encodeImage(list[0].img, settings);
        blob = out.blob;
        fellBack = out.fellBack;
        clamped = out.clamped;
        name = `${baseName(list[0].file.name)}.${out.ext}`;
      } else {
        const files = {};
        const unique = uniqueNamer();
        for (let i = 0; i < list.length; i++) {
          setBusy('on');
          const out = await encodeImage(list[i].img, settings);
          fellBack = fellBack || out.fellBack;
          clamped = clamped || out.clamped;
          files[unique(`${baseName(list[i].file.name)}.${out.ext}`)] = new Uint8Array(await out.blob.arrayBuffer());
        }
        // Images are already compressed: store them as they are
        blob = new Blob([zipSync(files, { level: 0 })], { type: 'application/zip' });
        name = 'images.zip';
      }
      downloadBlob(blob, name);
      flagDone('download');
      if (fellBack) toast(`this browser can't make ${fmt.label}, so it saved PNG`, { warn: true });
      // (it said nothing: an 8000 × 6000 photo came out smaller at 100%)
      else if (clamped) toast('made smaller: that size is more than this browser can draw', { warn: true });
    } catch (err) {
      toast(err?.message ? `couldn't convert: ${err.message}` : "couldn't convert", { warn: true });
    } finally {
      setBusy('');
    }
  };

  const handleCopy = async (e) => {
    if (e.detail) e.currentTarget.blur();
    if (!selected) return;
    // Started inside the click (Safari only allows it there); the clipboard
    // takes PNG, so that's what's copied whatever the format.
    const png = encodeImage(selected.img, { ...settings, format: 'png' }).then(out => out.blob);
    if (await copyImageBlob(png)) {
      flagDone('copy');
      toast('image copied');
    } else {
      toast("this browser can't copy images — download it instead", { warn: true });
    }
  };

  const onDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false);
  };


  // Until this image's estimate is in: the size it will be, with the last
  // byte count (another image's estimate never stands in for it)
  const out = !selected
    ? { width: 0, height: 0, size: 0 }
    : estimate?.id === selected.id
      ? estimate
      : { ...targetSize(selected.w, selected.h, resize), size: estimate?.size || 0 };

  return (
    <div className="tool">
      <p className="tool-desc">convert and resize images, or make them a PDF</p>
      {/* The same box as PDF tools: a fixed size that scrolls inside, the
          images as cards that pop in and out */}
      <div
        ref={boxRef}
        className={`tool-box pdf-drop image-drop ${items.length ? 'has-pages' : ''} ${dragging ? 'dragging' : ''}`}
        // Empty: anywhere opens the picker; with images, only the space around them
        onClick={(e) => { if (!items.length || e.target === e.currentTarget || e.target.classList.contains('pdf-drop-inner')) inputRef.current?.click(); }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={onDragLeave}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer?.files || []);
        }}
        aria-label="Add images"
      >
        <div
          className={`pdf-drop-inner ${items.length || hold ? 'full' : 'drop-box-empty'}`}
          style={hold ? { minHeight: `${hold}px` } : undefined}
        >
          <FadeText k={!items.length && !hold ? 'hint' : ''} quiet={items.length > 0} className="tool-hint">{!items.length && !hold ? 'drop, paste or click to add images' : null}</FadeText>
          <MotionList
            items={items}
            getKey={item => item.id}
            variant="grid"
            className="page-grid"
            renderItem={(item) => {
              const n = items.findIndex(q => q.id === item.id);
              const isSel = picked.has(item.id);
              const name = item.file.name || 'pasted image';
              // The PDF page card: picture, a label row, a row of small buttons
              return (
                <div className={`page-card ${isSel ? 'selected' : ''}`}>
                  <button
                    className="page-thumb"
                    onClick={(e) => { if (e.detail) e.currentTarget.blur(); toggle(item.id); }}
                    aria-pressed={isSel}
                    title={isSel ? 'Unselect image' : 'Select image'}
                  >
                    <img src={item.thumb} alt={name} decoding="async" draggable={false} onLoad={fadeInOnLoad} />
                  </button>
                  <div className="page-label">
                    <span className="page-src page-name">{name}</span>
                    <span>{item.w}×{item.h}</span>
                  </div>
                  <div className="page-buttons">
                    <button className="btn btn-sm btn-icon" onClick={(e) => { if (e.detail) e.currentTarget.blur(); move(item.id, -1); }} disabled={n <= 0} title="Move earlier" aria-label="Move earlier"><ChevronLeft size={12} /></button>
                    <button className="btn btn-sm btn-icon" onClick={(e) => { if (e.detail) e.currentTarget.blur(); move(item.id, 1); }} disabled={n < 0 || n >= items.length - 1} title="Move later" aria-label="Move later"><ChevronRight size={12} /></button>
                    <button className="btn btn-sm btn-icon" onClick={(e) => { if (e.detail) e.currentTarget.blur(); else keepFocusAfterRemove(e.currentTarget); removeItems(new Set([item.id])); }} title="Remove" aria-label={`Remove ${name}`}><X size={12} /></button>
                  </div>
                </div>
              );
            }}
          />
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => { addFiles(e.target.files || []); e.target.value = ''; }}
          />
        </div>
      </div>

      {/* The stats: always there, only the numbers change (counting from 0).
          "out" is what the selected image (or the first) comes out as. */}
      <div className="tool-meta tool-stats" aria-live="polite">
        images <Count value={items.length} /> · selected <Count value={picked.size} /> · out <Count value={out.width} format={String} /> × <Count value={out.height} format={String} /> · <Count value={out.size} format={kb} />
      </div>

      <Collapse open={items.length > 0} className="options-collapse">
        <div className="options-panel">
          <FlipRow className="field-grid">
            <TabSwitcher className="tab-switcher-sm" tabs={IMAGE_FORMATS} active={format} onChange={setFormat} />
            <TabSwitcher className="tab-switcher-sm" tabs={RESIZE_MODES} active={resizeMode} onChange={setResizeMode} />
            {/* One number box; its unit words do the word swap (% ↔ px wide) */}
            <label className="field resize-field">
              <input
                className="text-input num"
                type="number"
                inputMode={resizeMode === 'percent' ? 'decimal' : 'numeric'}
                min="1"
                max={resizeMode === 'percent' ? '1000' : '16384'}
                value={resizeMode === 'percent' ? percent : widthPx}
                onChange={(e) => (resizeMode === 'percent' ? setPercent : setWidthPx)(e.target.value)}
                aria-label={resizeMode === 'percent' ? 'Scale percent' : 'Width in pixels'}
              />
              <SlideSwap text={resizeMode === 'percent' ? '%' : 'px wide'} />
            </label>
          </FlipRow>
          <Collapse open={fmt.lossy}>
            <div className="field-grid quality-row">
              <label className="field">
                quality
                <input
                  className="range-input"
                  type="range"
                  min="10"
                  max="100"
                  value={quality}
                  onChange={(e) => setQuality(Number(e.target.value))}
                  aria-label="Quality"
                />
                <span className="count-num quality-num"><Count value={quality} /></span>
              </label>
            </div>
          </Collapse>
        </div>
      </Collapse>


      <FlipRow>
        <button
          className="btn btn-icon"
          onClick={(e) => { if (e.detail) e.currentTarget.blur(); inputRef.current?.click(); }}
          title="Add images"
          aria-label="Add images"
        >
          <ImageUp size={14} />
        </button>
        <button
          className={`btn btn-primary ${done.download ? 'btn-done' : ''}`}
          onClick={handleDownload}
          disabled={!items.length || !!busy}
        >
          {/* Always just "download": no working text while it converts */}
          <Download size={14} />
          download
        </button>
        <button
          className={`btn ${done.copy ? 'btn-done' : ''}`}
          onClick={handleCopy}
          disabled={!selected}
          title="Copy the selected image (or the first one) as PNG"
        >
          <Copy size={14} />
          copy
        </button>
      </FlipRow>
      {/* Selecting, deleting, clearing: the bulk bar (as in PDF tools) */}
      <BulkBar
        active={active}
        total={items.length}
        selected={picked.size}
        disabled={!items.length}
        onSelectAll={(all) => setPicked(all ? new Set(items.map(i => i.id)) : new Set())}
        onDelete={() => removeItems(new Set(picked))}
        onClear={clearAll}
      />
    </div>
  );
}
