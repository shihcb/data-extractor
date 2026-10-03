import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, FilePlus, RotateCcw, RotateCw, X } from 'lucide-react';
import { zipSync } from 'fflate';
import { closePdf, loadPdfLib, openPdf, renderPage, isPasswordError } from '../pdf';
import { baseName, canvasToBlob, downloadBlob, isPdfFile, uniqueNamer, useDoneFlags, usePastedFiles } from '../utils';
import { MOTION_MS } from '../motion';
import { useToast } from '../toastContext';
import MotionList from './MotionList';
import AutoHeight from './AutoHeight';
import Count from './Count';
import FadeText from './FadeText';
import FlipRow from './FlipRow';
import SlideText from './SlideText';

const THUMB_CSS_WIDTH = 160;
const IMAGE_SCALE = 2; // pages to images: 144 dpi

let nextPageId = 1;
let nextSourceId = 1;

const plural = (n, word) => (n === 1 ? word : `${word}s`);

export default function PdfTools({ active }) {
  // A page: { id, srcId, index, rotation (degrees, any multiple of 90), thumb (url), num }
  const [pages, setPages] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [loading, setLoading] = useState('');
  const [busy, setBusy] = useState('');
  const [dragging, setDragging] = useState(false);
  const [done, flagDone] = useDoneFlags();
  const sources = useRef(new Map()); // srcId -> { name, bytes, view (pdf.js), lib (pdf-lib) }
  const inputRef = useRef(null);
  const labels = useRef(new Map()); // page id -> { num, name } as last shown (a leaving card keeps its own)
  const removed = useRef(new Set()); // ids of pages deleted (a picture still being drawn is thrown away)
  const pagesRef = useRef(pages);
  pagesRef.current = pages;
  const toast = useToast();

  const addFiles = useCallback(async (fileList) => {
    const files = [...fileList].filter(isPdfFile);
    if (!files.length) return;
    setLoading('loading');
    for (const file of files) {
      let view = null;
      let added = 0;
      let srcId = null;
      try {
        const bytes = await file.arrayBuffer();
        const { PDFDocument } = await loadPdfLib();
        let lib;
        try {
          lib = await PDFDocument.load(bytes);
        } catch (err) {
          throw new Error(/encrypt/i.test(err?.message || '') ? 'password' : 'broken');
        }
        view = await openPdf(bytes);
        srcId = nextSourceId++;
        sources.current.set(srcId, { name: file.name, bytes, view, lib });
        // Both libraries must agree the page is there (a damaged file can
        // look longer to the forgiving one)
        const count = Math.min(view.numPages, lib.getPageCount());
        // Every page goes in at once as a blank card, so the box eases once
        // to its final height (one by one, it shrank to a row, then grew);
        // the pictures fill in as they're drawn
        const ids = Array.from({ length: count }, () => nextPageId++);
        setPages(prev => [...prev, ...ids.map((id, i) => ({ id, srcId, index: i, rotation: 0, thumb: null }))]);
        added = count;
        for (let i = 0; i < count; i++) {
          if (removed.current.has(ids[i])) continue; // deleted before its picture was drawn
          const page = await view.getPage(i + 1);
          const { canvas } = await renderPage(page, { cssWidth: THUMB_CSS_WIDTH });
          const thumb = URL.createObjectURL(await canvasToBlob(canvas, 'image/jpeg', 0.8));
          canvas.width = canvas.height = 0;
          page.cleanup();
          if (removed.current.has(ids[i])) {
            URL.revokeObjectURL(thumb);
            continue;
          }
          setPages(prev => prev.map(p => (p.id === ids[i] ? { ...p, thumb } : p)));
        }
      } catch (err) {
        // Pages already added keep their document; otherwise let it go
        if (!added) {
          closePdf(view);
          if (srcId !== null) sources.current.delete(srcId);
        }
        const why = err?.message === 'password' || isPasswordError(err)
          ? 'is password-protected'
          : "isn't a PDF this can open";
        toast(`${file.name} ${why}`, { warn: true });
      }
    }
    setLoading('');
  }, [toast]);

  usePastedFiles(active, isPdfFile, addFiles);

  // Sources no page uses any more are let go
  const dropUnusedSources = (remaining) => {
    const used = new Set(remaining.map(p => p.srcId));
    sources.current.forEach((src, id) => {
      if (!used.has(id)) {
        closePdf(src.view);
        sources.current.delete(id);
      }
    });
  };

  const releaseThumbs = (list) => setTimeout(() => list.forEach(p => {
    if (p.thumb) URL.revokeObjectURL(p.thumb);
    labels.current.delete(p.id);
  }), MOTION_MS + 300);

  const removePages = (ids) => {
    const gone = pages.filter(p => ids.has(p.id));
    const rest = pages.filter(p => !ids.has(p.id));
    ids.forEach(id => removed.current.add(id));
    setPages(rest);
    setSelected(sel => new Set([...sel].filter(id => !ids.has(id))));
    releaseThumbs(gone);
    if (!loading) dropUnusedSources(rest);
  };

  const clearAll = () => {
    releaseThumbs(pages);
    pages.forEach(p => removed.current.add(p.id));
    setPages([]);
    setSelected(new Set());
    if (!loading) dropUnusedSources([]);
  };

  useEffect(() => () => {
    pagesRef.current.forEach(p => p.thumb && URL.revokeObjectURL(p.thumb));
    sources.current.forEach(src => closePdf(src.view));
  }, []);

  const rotate = (id, by) => setPages(prev => prev.map(p => (p.id === id ? { ...p, rotation: p.rotation + by } : p)));

  const move = (id, by) => setPages(prev => {
    const i = prev.findIndex(p => p.id === id);
    const j = i + by;
    if (i < 0 || j < 0 || j >= prev.length) return prev;
    const next = prev.slice();
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });

  const toggle = (id) => setSelected(sel => {
    const next = new Set(sel);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  // One PDF from these pages, in this order, with their rotations
  const buildPdf = async (list) => {
    const { PDFDocument, degrees } = await loadPdfLib();
    const out = await PDFDocument.create();
    for (const p of list) {
      const src = sources.current.get(p.srcId);
      const [copy] = await out.copyPages(src.lib, [p.index]);
      const turn = ((p.rotation % 360) + 360) % 360;
      if (turn) copy.setRotation(degrees((copy.getRotation().angle + turn) % 360));
      out.addPage(copy);
    }
    return new Blob([await out.save()], { type: 'application/pdf' });
  };

  const outName = (suffix) => {
    const ids = new Set(pages.map(p => p.srcId));
    const single = ids.size === 1 ? sources.current.get([...ids][0]) : null;
    return single ? `${baseName(single.name)}${suffix}` : `merged${suffix}`;
  };

  const run = async (e, key, job) => {
    e.currentTarget.blur();
    if (busy) return;
    try {
      setBusy(key);
      await job();
      flagDone(key);
    } catch (err) {
      toast(`couldn't make that file${err?.message ? `: ${err.message}` : ''}`, { warn: true });
    } finally {
      setBusy('');
    }
  };

  const saveAll = (e) => run(e, 'save', async () => {
    downloadBlob(await buildPdf(pages), outName('-edited.pdf'));
  });

  const saveSelected = (e) => run(e, 'extract', async () => {
    downloadBlob(await buildPdf(pages.filter(p => selected.has(p.id))), outName('-selected.pdf'));
  });

  const split = (e) => run(e, 'split', async () => {
    const files = {};
    const unique = uniqueNamer();
    const stem = baseName(outName(''));
    for (let i = 0; i < pages.length; i++) {
      const blob = await buildPdf([pages[i]]);
      files[unique(`${stem}-page-${i + 1}.pdf`)] = new Uint8Array(await blob.arrayBuffer());
    }
    downloadBlob(new Blob([zipSync(files, { level: 6 })], { type: 'application/zip' }), `${stem}-pages.zip`);
  });

  const toImages = (e) => run(e, 'images', async () => {
    const files = {};
    const unique = uniqueNamer();
    const stem = baseName(outName(''));
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      const page = await sources.current.get(p.srcId).view.getPage(p.index + 1);
      const turn = ((p.rotation % 360) + 360) % 360;
      const { canvas } = await renderPage(page, { scale: IMAGE_SCALE, rotation: turn, maxPixels: 16e6 });
      const blob = await canvasToBlob(canvas, 'image/png');
      canvas.width = canvas.height = 0;
      page.cleanup();
      files[unique(`${stem}-page-${i + 1}.png`)] = new Uint8Array(await blob.arrayBuffer());
    }
    downloadBlob(new Blob([zipSync(files, { level: 0 })], { type: 'application/zip' }), `${stem}-images.zip`);
  });

  const fileCount = new Set(pages.map(p => p.srcId)).size;
  // A button's words: "working…" while it runs, swapped with the text swap
  const label = (key, idle) => {
    const text = busy === key ? 'working…' : idle;
    return <FadeText k={text} className="btn-label">{text}</FadeText>;
  };
  const none = !pages.length || !!loading;

  return (
    <div className="tool">
      <AutoHeight
        className={`tool-box pdf-drop ${pages.length ? 'has-pages' : ''} ${dragging ? 'dragging' : ''}`}
        innerClassName={`pdf-drop-inner ${pages.length ? 'full' : 'drop-box-empty'}`}
        // Empty: anywhere opens the picker; with pages, only the space around them
        onClick={(e) => { if (!pages.length || e.target === e.currentTarget || e.target.classList.contains('pdf-drop-inner')) inputRef.current?.click(); }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false); }}
        onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer?.files || []); }}
      >
        {/* When pages come in, the hint just goes: its fading copy would sit over them */}
        <FadeText k={!pages.length ? 'hint' : ''} quiet={pages.length > 0} className="tool-hint">{!pages.length ? 'drop, paste or click to add PDFs' : null}</FadeText>
        <MotionList
          items={pages}
          getKey={p => p.id}
          variant="grid"
          className="page-grid"
          renderItem={(p, { leaving }) => {
            const n = pages.findIndex(q => q.id === p.id);
            const isSel = selected.has(p.id);
            // A card on its way out keeps the number and file name it had
            // (gone, its label row emptied and the card shrank as it left)
            let label = labels.current.get(p.id);
            if (!leaving || !label) {
              label = { num: n >= 0 ? n + 1 : '', name: fileCount > 1 ? baseName(sources.current.get(p.srcId)?.name) : '' };
              labels.current.set(p.id, label);
            }
            return (
              <div className={`page-card ${isSel ? 'selected' : ''}`}>
                <button
                  className="page-thumb"
                  onClick={(e) => { e.currentTarget.blur(); toggle(p.id); }}
                  aria-pressed={isSel}
                  title={isSel ? 'Unselect page' : 'Select page'}
                >
                  {p.thumb && <img src={p.thumb} alt={`Page ${label.num}`} style={{ transform: `rotate(${p.rotation}deg)` }} draggable={false} />}
                </button>
                <div className="page-label">
                  <span>{label.num}</span>
                  {/* File names come and go with the text swap (a second file added, the others removed) */}
                  <FadeText k={label.name} className="page-src">{label.name || null}</FadeText>
                </div>
                <div className="page-buttons">
                  <button className="btn btn-sm btn-icon" onClick={(e) => { e.currentTarget.blur(); rotate(p.id, -90); }} title="Rotate left" aria-label="Rotate left"><RotateCcw size={12} /></button>
                  <button className="btn btn-sm btn-icon" onClick={(e) => { e.currentTarget.blur(); rotate(p.id, 90); }} title="Rotate right" aria-label="Rotate right"><RotateCw size={12} /></button>
                  <button className="btn btn-sm btn-icon" onClick={(e) => { e.currentTarget.blur(); move(p.id, -1); }} disabled={n <= 0} title="Move earlier" aria-label="Move earlier"><ChevronLeft size={12} /></button>
                  <button className="btn btn-sm btn-icon" onClick={(e) => { e.currentTarget.blur(); move(p.id, 1); }} disabled={n >= pages.length - 1} title="Move later" aria-label="Move later"><ChevronRight size={12} /></button>
                  <button className="btn btn-sm btn-icon" onClick={(e) => { e.currentTarget.blur(); removePages(new Set([p.id])); }} title="Delete page" aria-label="Delete page"><X size={12} /></button>
                </div>
              </div>
            );
          }}
        />
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          hidden
          onChange={(e) => { addFiles(e.target.files || []); e.target.value = ''; }}
        />
      </AutoHeight>

      <AutoHeight className="tool-meta" aria-live="polite">
        {/* No per-page loading line: the cards show it, and a line changing
            every page piled its fading copies on top of each other */}
        <FadeText k={pages.length ? `pages-${selected.size > 0}` : 'empty'}>
        {pages.length ? (
          <>
            <Count value={pages.length} /> {plural(pages.length, 'page')} from <Count value={fileCount} /> {plural(fileCount, 'file')}
            <SlideText show={selected.size > 0}>{'\u00a0·\u00a0'}<Count value={selected.size} />{'\u00a0selected'}</SlideText>
            {' · tap a page to select it'}
          </>
        ) : 'merge, split, reorder, rotate, delete pages, or turn them into images'}
      </FadeText>
      </AutoHeight>

      <FlipRow>
        <button className="btn btn-icon" onClick={(e) => { e.currentTarget.blur(); inputRef.current?.click(); }} title="Add PDFs" aria-label="Add PDFs">
          <FilePlus size={14} />
        </button>
        <button className={`btn btn-primary ${done.save ? 'btn-done' : ''}`} onClick={saveAll} disabled={none || !!busy}>
          <Download size={14} /> {label('save', fileCount > 1 ? 'save merged pdf' : 'save pdf')}
        </button>
        <button className={`btn ${done.extract ? 'btn-done' : ''}`} onClick={saveSelected} disabled={none || !selected.size || !!busy}>
          {label('extract', 'save selected')}
        </button>
        <button className={`btn ${done.split ? 'btn-done' : ''}`} onClick={split} disabled={none || !!busy}>
          {label('split', 'split into pages')}
        </button>
        <button className={`btn ${done.images ? 'btn-done' : ''}`} onClick={toImages} disabled={none || !!busy}>
          {label('images', 'pages to PNG')}
        </button>
      </FlipRow>
      <FlipRow>
        <button
          className="btn btn-sm"
          onClick={(e) => { e.currentTarget.blur(); setSelected(selected.size === pages.length ? new Set() : new Set(pages.map(p => p.id))); }}
          disabled={none}
        >
          {(() => {
            const text = selected.size === pages.length && pages.length ? 'select none' : 'select all';
            return <FadeText k={text} className="btn-label">{text}</FadeText>;
          })()}
        </button>
        <button className="btn btn-sm" onClick={(e) => { e.currentTarget.blur(); removePages(new Set(selected)); }} disabled={none || !selected.size}>
          delete selected
        </button>
        <button className="btn btn-sm" onClick={(e) => { e.currentTarget.blur(); clearAll(); }} disabled={none}>
          clear
        </button>
      </FlipRow>
    </div>
  );
}
