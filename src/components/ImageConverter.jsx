import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Copy, Download, ImageUp, X } from 'lucide-react';
import { zipSync } from 'fflate';
import { IMAGE_FORMATS, encodeImage, jpegsToPdf, loadImage, makeThumb, targetSize } from '../imageConvert';
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
import { animateTo } from '../engine';

// Box padding (matches .drop-box) and the smallest it shrinks to
const PAD_X = 24;
const PAD_Y = 18;
const MIN_IMAGE_BOX = 200;
const emptyBoxHeight = () => Math.max(320, window.innerHeight * 0.6);

const RESIZE_MODES = [
  { key: 'percent', label: 'scale %' },
  { key: 'width',   label: 'width px' },
];

let nextId = 1;

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
  const initialBoxStyle = useRef({ height: `${emptyBoxHeight()}px` }).current;
  const [done, flagDone] = useDoneFlags();
  const inputRef = useRef(null);
  const boxRef = useRef(null);
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
    setItems(rest);
    if (selected?.id === id) setSelectedId(rest[Math.min(index, rest.length - 1)]?.id ?? null);
    // After its row has slid out (it still shows the thumbnail until then)
    setTimeout(() => { URL.revokeObjectURL(item.url); URL.revokeObjectURL(item.thumb); }, MOTION_MS + 300);
  };

  const clearAll = () => {
    const old = items;
    setItems([]);
    setSelectedId(null);
    setWidthPx('');
    setTimeout(() => old.forEach(i => { URL.revokeObjectURL(i.url); URL.revokeObjectURL(i.thumb); }), MOTION_MS + 300);
  };

  useEffect(() => () => itemsRef.current.forEach(i => { URL.revokeObjectURL(i.url); URL.revokeObjectURL(i.thumb); }), []);

  // The box fits the selected image's shape (up to the empty box's height),
  // easing there on the motion engine.
  useLayoutEffect(() => {
    const fit = () => {
      const maxH = emptyBoxHeight();
      const box = boxRef.current;
      if (!box) return;
      let h = maxH;
      if (selected) {
        const innerW = box.clientWidth - PAD_X * 2;
        const fitted = innerW * (selected.h / selected.w) + PAD_Y * 2;
        h = Math.round(Math.min(maxH, Math.max(MIN_IMAGE_BOX, fitted)));
      }
      // The engine holds it at this height once there
      animateTo(box, 'height', h, { from: box.offsetHeight, keep: true });
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [selected]);

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
        const out = await encodeImage(selected.img, settings);
        if (cancelled) return;
        estimatedFor.current = selected.id;
        setEstimate({ width: out.width, height: out.height, size: out.blob.size, ext: out.ext, fellBack: out.fellBack, clamped: out.clamped, pdf: settings.format === 'pdf' });
      } catch {
        if (!cancelled) setEstimate(null);
      }
    }, newImage ? MOTION_MS + 150 : 120);
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
      <div
        ref={boxRef}
        className={`tool-box drop-box ${dragging ? 'dragging' : ''}`}
        style={initialBoxStyle}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={onDragLeave}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer?.files || []);
        }}
        role="button"
        tabIndex={0}
        aria-label="Add images"
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); } }}
      >
        {selected && <img key={selected.id} src={selected.url} alt={selected.file.name} className="drop-preview" />}
        <FadeText k={selected ? '' : 'hint'} className="tool-hint">{selected ? null : 'drop, paste or click to add images'}</FadeText>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => { addFiles(e.target.files || []); e.target.value = ''; }}
        />
      </div>

      <MotionList
        items={items}
        getKey={item => item.id}
        className="file-list"
        renderItem={(item) => (
          <div
            className={`file-row ${selected?.id === item.id ? 'selected' : ''}`}
            onClick={() => setSelectedId(item.id)}
          >
            <img src={item.thumb} alt="" className="file-thumb" decoding="async" />
            <div className="file-info">
              <span className="file-name">{item.file.name || 'pasted image'}</span>
              <span className="file-meta">{item.w} × {item.h} · {formatBytes(item.file.size)}</span>
            </div>
            <button
              className="btn btn-sm btn-icon file-remove"
              onClick={(e) => { e.stopPropagation(); e.currentTarget.blur(); removeItem(item.id); }}
              title="Remove"
              aria-label={`Remove ${item.file.name}`}
            >
              <X size={13} />
            </button>
          </div>
        )}
      />

      <Collapse open={items.length > 0} className="options-collapse">
        <div className="options-panel">
          <div className="field-grid">
            <TabSwitcher className="tab-switcher-sm" tabs={IMAGE_FORMATS} active={format} onChange={setFormat} />
            <TabSwitcher className="tab-switcher-sm" tabs={RESIZE_MODES} active={resizeMode} onChange={setResizeMode} />
            {resizeMode === 'percent' ? (
              <label className="field">
                <input
                  className="text-input num"
                  type="number"
                  inputMode="decimal"
                  min="1"
                  max="1000"
                  value={percent}
                  onChange={(e) => setPercent(e.target.value)}
                  aria-label="Scale percent"
                />
                %
              </label>
            ) : (
              <label className="field">
                <input
                  className="text-input num"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max="16384"
                  value={widthPx}
                  onChange={(e) => setWidthPx(e.target.value)}
                  aria-label="Width in pixels"
                />
                px wide
              </label>
            )}
          </div>
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
        <FadeText k={!selected ? 'empty' : estimate ? `est-${estimate.pdf}-${!!estimate.clamped}` : 'wait'}>
        {selected && estimate ? (
          <>
            {original.width} × {original.height} → <Count value={estimate.width} /> × <Count value={estimate.height} /> · <Count value={estimate.size} format={formatBytes} />
            {estimate.pdf ? ' per page' : ''}
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
          {downloadLabel}
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
