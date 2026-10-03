import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Download, ImageUp, X } from 'lucide-react';
import { zipSync } from 'fflate';
import { IMAGE_FORMATS, encodeImage, estimateImage, jpegsToPdf, loadImage, makeThumb, targetSize } from '../imageConvert';
import { baseName, copyImageBlob, downloadBlob, formatBytes, isImageFile, uniqueNamer, useDoneFlags, usePastedFiles } from '../utils';
import { MOTION_MS } from '../motion';
import { useToast } from '../toastContext';
import TabSwitcher from './TabSwitcher';
import MotionList from './MotionList';
import Collapse from './Collapse';
import Count from './Count';
import AutoHeight from './AutoHeight';
import FadeText from './FadeText';
import FlipRow from './FlipRow';
import SlideText from './SlideText';
import SlideSwap from './SlideSwap';

const RESIZE_MODES = [
  { key: 'percent', label: 'scale %' },
  { key: 'width',   label: 'width px' },
];

let nextId = 1;

// Frees what an image holds once it's gone: its links and its decoded copy
function releaseItem(item) {
  URL.revokeObjectURL(item.url);
  URL.revokeObjectURL(item.thumb);
  item._bitmap?.then(b => b.close(), () => {});
}

export default function ImageConverter({ active }) {
  const [items, setItems] = useState([]); // { id, file, url, img, w, h }
  const [selectedId, setSelectedId] = useState(null);
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

  const selected = items.find(i => i.id === selectedId) || items[0] || null;
  const fmt = IMAGE_FORMATS.find(f => f.key === format);

  const resize = useMemo(() => ({
    mode: resizeMode,
    percent: parseFloat(percent),
    width: parseInt(widthPx, 10),
  }), [resizeMode, percent, widthPx]);

  const settings = useMemo(() => ({ format, resize, quality }), [format, resize, quality]);

  const addFiles = useCallback(async (fileList) => {
    const files = [...fileList].filter(isImageFile);
    if (!files.length) return;
    const loaded = await Promise.all(files.map(async (file) => {
      const url = URL.createObjectURL(file);
      try {
        const img = await loadImage(url);
        const thumb = await makeThumb(img);
        return { id: nextId++, file, url, thumb, img, w: img.naturalWidth, h: img.naturalHeight };
      } catch {
        URL.revokeObjectURL(url);
        toast(`couldn't open ${file.name || 'that image'}`, { warn: true });
        return null;
      }
    }));
    const ok = loaded.filter(Boolean);
    if (!ok.length) return;
    clearTimeout(holdTimer.current);
    setHold(0);
    setItems(prev => [...prev, ...ok]);
    setSelectedId(ok[0].id);
    // A width to start from: the first image's own
    setWidthPx(w => w || String(ok[0].w));
  }, [toast]);

  usePastedFiles(active, isImageFile, addFiles);

  const removeItem = (id) => {
    const index = items.findIndex(i => i.id === id);
    const item = items[index];
    if (!item) return;
    const rest = items.filter(i => i.id !== id);
    if (!rest.length) holdWhileLeaving();
    setItems(rest);
    if (selected?.id === id) setSelectedId(rest[Math.min(index, rest.length - 1)]?.id ?? null);
    // After its card has left (it still shows the picture until then)
    setTimeout(() => releaseItem(item), MOTION_MS + 300);
  };

  const clearAll = () => {
    const old = items;
    holdWhileLeaving();
    setItems([]);
    setSelectedId(null);
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
  useEffect(() => {
    if (!selected) {
      setEstimate(null);
      estimatedFor.current = null;
      return;
    }
    let cancelled = false;
    const newImage = estimatedFor.current !== selected.id;
    const t = setTimeout(async () => {
      try {
        const out = await estimateImage(selected, settings);
        if (cancelled) return;
        estimatedFor.current = selected.id;
        setEstimate({ ...out, pdf: settings.format === 'pdf' });
      } catch {
        if (!cancelled) setEstimate(null);
      }
      // Always after the motion has finished: any heavy work while something
      // moves can make it stutter on a phone
    }, MOTION_MS + (newImage ? 150 : 60));
    return () => { cancelled = true; clearTimeout(t); };
  }, [selected, settings]);

  const handleDownload = async (e) => {
    e.currentTarget.blur();
    if (!items.length || busy) return;
    const list = items;
    try {
      let blob;
      let name;
      let fellBack = false;
      if (format === 'pdf') {
        const pages = [];
        for (let i = 0; i < list.length; i++) {
          setBusy(list.length > 1 ? `${i + 1} / ${list.length}` : '…');
          pages.push(await encodeImage(list[i].img, settings));
        }
        setBusy('…');
        blob = await jpegsToPdf(pages);
        name = list.length === 1 ? `${baseName(list[0].file.name)}.pdf` : 'images.pdf';
      } else if (list.length === 1) {
        setBusy('…');
        const out = await encodeImage(list[0].img, settings);
        blob = out.blob;
        fellBack = out.fellBack;
        name = `${baseName(list[0].file.name)}.${out.ext}`;
      } else {
        const files = {};
        const unique = uniqueNamer();
        for (let i = 0; i < list.length; i++) {
          setBusy(`${i + 1} / ${list.length}`);
          const out = await encodeImage(list[i].img, settings);
          fellBack = fellBack || out.fellBack;
          files[unique(`${baseName(list[i].file.name)}.${out.ext}`)] = new Uint8Array(await out.blob.arrayBuffer());
        }
        // Images are already compressed: store them as they are
        blob = new Blob([zipSync(files, { level: 0 })], { type: 'application/zip' });
        name = 'images.zip';
      }
      downloadBlob(blob, name);
      flagDone('download');
      if (fellBack) toast(`this browser can't make ${fmt.label}, so it saved PNG`, { warn: true });
    } catch (err) {
      toast(err?.message ? `couldn't convert: ${err.message}` : "couldn't convert", { warn: true });
    } finally {
      setBusy('');
    }
  };

  const handleCopy = async (e) => {
    e.currentTarget.blur();
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

  const downloadLabel = busy
    ? `converting ${busy}`
    : items.length > 1
      ? (format === 'pdf' ? 'download pdf' : 'download zip')
      : 'download';

  const original = selected ? targetSize(selected.w, selected.h, { mode: 'percent', percent: 100 }) : null;

  return (
    <div className="tool">
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
              const isSel = selected?.id === item.id;
              return (
                <div className={`page-card ${isSel ? 'selected' : ''}`}>
                  <button
                    className="page-thumb"
                    onClick={(e) => { e.currentTarget.blur(); setSelectedId(item.id); }}
                    aria-pressed={isSel}
                    title="Show this image's size"
                  >
                    <img src={item.thumb} alt={item.file.name || 'pasted image'} decoding="async" draggable={false} />
                  </button>
                  <div className="image-card-foot">
                    <div className="file-info">
                      <span className="file-name">{item.file.name || 'pasted image'}</span>
                      <span className="file-meta">{item.w} × {item.h} · {formatBytes(item.file.size)}</span>
                    </div>
                    <button
                      className="btn btn-sm btn-icon"
                      onClick={(e) => { e.currentTarget.blur(); removeItem(item.id); }}
                      title="Remove"
                      aria-label={`Remove ${item.file.name}`}
                    >
                      <X size={12} />
                    </button>
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

      <AutoHeight className="tool-meta" aria-live="polite">
        <FadeText k={!selected ? 'empty' : estimate ? `est-${!!estimate.clamped}` : 'wait'}>
        {selected && estimate ? (
          <>
            {original.width} × {original.height} → <Count value={estimate.width} format={String} /> × <Count value={estimate.height} format={String} /> · <Count value={estimate.size} format={formatBytes} />
            <SlideText show={!!estimate.pdf}>{'\u00a0per page'}</SlideText>
            {estimate.clamped ? ' (largest this device can make)' : ''}
          </>
        ) : selected ? '…' : 'png, jpg, webp, gif, avif and more'}
      </FadeText>
      </AutoHeight>

      <FlipRow>
        <button
          className="btn btn-icon"
          onClick={(e) => { e.currentTarget.blur(); inputRef.current?.click(); }}
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
          {busy ? <span className="spinner" aria-hidden="true" /> : <Download size={14} />}
          <FadeText k={downloadLabel} className="btn-label">{downloadLabel}</FadeText>
        </button>
        <button
          className={`btn ${done.copy ? 'btn-done' : ''}`}
          onClick={handleCopy}
          disabled={!selected}
          title="Copy the selected image (as PNG)"
        >
          <Copy size={14} />
          copy
        </button>
        <button className="btn" onClick={(e) => { e.currentTarget.blur(); clearAll(); }} disabled={!items.length}>
          clear
        </button>
      </FlipRow>
    </div>
  );
}
