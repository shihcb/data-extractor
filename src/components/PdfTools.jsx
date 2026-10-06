import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, FilePlus, RotateCcw, RotateCw, Scissors, X } from 'lucide-react';
import { zipSync } from 'fflate';
import { closePdf, loadPdfLib, openPdf, renderPage, isPasswordError, refusedWords, whyRefused } from '../pdf';
import { baseName, canvasToBlob, downloadBlob, isImageFile, isPdfFile, keepFocusAfterRemove, shortName, uniqueNamer, useDoneFlags, usePastedFiles } from '../utils';
import { MOTION_MS, fadeInOnLoad } from '../motion';
import { useToast } from '../toastContext';
import MotionList from './MotionList';
import Count from './Count';
import FadeText from './FadeText';
import FlipRow from './FlipRow';
import SlideText from './SlideText';
import BoxRow from './BoxRow';
import useHistory, { useUndoKeys } from '../useHistory';
import { whenStill } from '../engine';

const THUMB_CSS_WIDTH = 160;
const IMAGE_SCALE = 2; // pages to images: 144 dpi

let nextPageId = 1;
let nextSourceId = 1;

export default function PdfTools({ active }) {
  // A page: { id, srcId, index, rotation (degrees, any multiple of 90) },
  // with undo / redo as in every tab (adding, deleting, turning and moving
  // are steps; clear ends it all, history too). Its picture is kept apart
  // (page id -> url), so an undone delete comes back with its picture.
  const [pages, setPages, history] = useHistory([]);
  useUndoKeys(active, history);
  const [thumbs, setThumbs] = useState(() => new Map());
  const thumbsRef = useRef(thumbs);
  thumbsRef.current = thumbs;
  const [selected, setSelected] = useState(() => new Set());
  const [loading, setLoading] = useState('');
  const loadingCount = useRef(0);
  const [busy, setBusy] = useState('');
  const [dragging, setDragging] = useState(false);
  const [done, flagDone] = useDoneFlags();
  const sources = useRef(new Map()); // srcId -> { name, bytes, view (pdf.js), lib (pdf-lib) }
  const inputRef = useRef(null);
  const labels = useRef(new Map()); // page id -> { num, name } as last shown (a leaving card keeps its own)
  const removed = useRef(new Set()); // ids of pages cleared (a picture still being drawn is thrown away)
  // The last pages leaving: the box holds its height while they fade out
  // where they are (the way they came in, reversed), then eases shut
  const dropBox = useRef(null);
  const [hold, setHold] = useState(0);
  const holdTimer = useRef(null);
  const holdWhileLeaving = () => {
    const inner = dropBox.current?.firstElementChild;
    if (!inner) return;
    setHold(inner.offsetHeight);
    clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => setHold(0), MOTION_MS + 100);
  };
  const stopHolding = () => {
    clearTimeout(holdTimer.current);
    setHold(0);
  };
  useEffect(() => () => clearTimeout(holdTimer.current), []);
  const toast = useToast();

  const addFiles = useCallback(async (fileList) => {
    const files = [...fileList].filter(isPdfFile);
    if (!files.length) {
      if (fileList.length) toast(isImageFile(fileList[0]) ? 'images go in the image converter' : "that isn't a PDF", { warn: true });
      return;
    }
    const failed = [];
    // (a count: two drops at once are both loading until both are done)
    loadingCount.current += 1;
    setLoading('loading');
    stopHolding();
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
          throw new Error(await whyRefused(bytes, err));
        }
        view = await openPdf(bytes);
        srcId = nextSourceId++;
        sources.current.set(srcId, { name: file.name, bytes, view, lib });
        // Both libraries must agree the page is there (a damaged file can
        // look longer to the forgiving one)
        const count = Math.min(view.numPages, lib.getPageCount());
        if (!count) throw new Error('empty');
        // Every page goes in at once as a blank card, so the box eases once
        // to its final height (one by one, it shrank to a row, then grew);
        // the pictures fill in as they're drawn
        const ids = Array.from({ length: count }, () => nextPageId++);
        setPages(prev => [...prev, ...ids.map((id, i) => ({ id, srcId, index: i, rotation: 0 }))]);
        added = count;
        for (let i = 0; i < count; i++) {
          if (removed.current.has(ids[i])) continue; // cleared before its picture was drawn
          // Drawn while nothing moves: drawn as the cards popped in, a page's
          // picture held up frames and the cards jumped
          await whenStill();
          if (removed.current.has(ids[i])) continue;
          const page = await view.getPage(i + 1);
          const { canvas } = await renderPage(page, { cssWidth: THUMB_CSS_WIDTH });
          const thumb = URL.createObjectURL(await canvasToBlob(canvas, 'image/jpeg', 0.8));
          canvas.width = canvas.height = 0;
          page.cleanup();
          if (removed.current.has(ids[i])) {
            URL.revokeObjectURL(thumb);
            continue;
          }
          setThumbs(m => new Map(m).set(ids[i], thumb));
        }
      } catch (err) {
        // Pages already added keep their document; otherwise let it go
        if (!added) {
          closePdf(view);
          if (srcId !== null) sources.current.delete(srcId);
        }
        if (err?.code === 'library') {
          // Not the file's fault: the PDF reader itself didn't load
          toast(err.message, { warn: true });
          break;
        }
        failed.push(`${shortName(file.name)} ${refusedWords(isPasswordError(err) ? 'password' : err?.message)}`);
      }
    }
    // Said once (one after another, only the last showed)
    if (failed.length) toast(failed.length === 1 ? failed[0] : `couldn't open ${failed.length} of the files`, { warn: true });
    loadingCount.current -= 1;
    if (!loadingCount.current) setLoading('');
  }, [toast, setPages]);

  usePastedFiles(active, isPdfFile, addFiles);

  // An undo can take selected pages away
  useEffect(() => {
    setSelected(sel => ([...sel].every(id => pages.some(p => p.id === id)) ? sel : new Set([...sel].filter(id => pages.some(p => p.id === id)))));
    // Undone back to nothing: the box goes back to empty the same way
    if (!pages.length && pagesBefore.current) holdWhileLeaving();
    pagesBefore.current = pages.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages]);
  const pagesBefore = useRef(0);

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

  // Deleted pages keep their file and picture until clear: an undo can
  // bring them back
  const removePages = (ids) => {
    const rest = pages.filter(p => !ids.has(p.id));
    if (!rest.length) holdWhileLeaving();
    pagesBefore.current = rest.length;
    setPages(rest);
    setSelected(sel => new Set([...sel].filter(id => !ids.has(id))));
  };

  // Pages no undo or redo can reach any more: their pictures (once their
  // cards have left) and their files are let go
  useEffect(() => {
    const live = new Set(history.reachable().flat().map(p => p.id));
    const gone = [...thumbsRef.current.keys()].filter(id => !live.has(id));
    if (gone.length) {
      setTimeout(() => {
        setThumbs((m) => {
          const next = new Map(m);
          gone.forEach((id) => {
            if (live.has(id)) return;
            URL.revokeObjectURL(next.get(id));
            next.delete(id);
            labels.current.delete(id);
          });
          return next;
        });
      }, MOTION_MS + 300);
    }
    if (!loading && !busy) dropUnusedSources(history.reachable().flat());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages]);

  // Pages deleted while files were still loading, or while a save, split or
  // export was reading them: their documents are let go once that's done
  // (closing one mid-way broke the file being drawn or made)
  useEffect(() => {
    if (!loading && !busy) dropUnusedSources(history.reachable().flat());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, busy]);

  useEffect(() => () => {
    thumbsRef.current.forEach(url => URL.revokeObjectURL(url));
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
    const { PDFDocument, PDFName, degrees } = await loadPdfLib();
    const turned = (page, p) => {
      const turn = ((p.rotation % 360) + 360) % 360;
      if (turn) page.setRotation(degrees((page.getRotation().angle + turn) % 360));
    };
    // Every page of one file, each once (turned, put in another order):
    // that file itself, its pages rearranged, so its form fields, outline
    // and details stay. (Not when pages were left out: the file would still
    // hold what was on them — a deleted page's words, in the saved file.)
    const ids = new Set(list.map(p => p.srcId));
    const one = ids.size === 1 ? sources.current.get(list[0].srcId) : null;
    if (one && new Set(list.map(p => p.index)).size === list.length && list.length === one.lib.getPageCount()) {
      const doc = await PDFDocument.load(one.bytes);
      const all = doc.getPages();
      // What a page takes from the pages above it (its size, turn, fonts)
      // made its own first: it may land under a different one
      all.forEach((page) => {
        const node = page.node;
        node.set(PDFName.of('MediaBox'), node.MediaBox());
        const crop = node.CropBox();
        if (crop) node.set(PDFName.of('CropBox'), crop);
        const res = node.Resources();
        if (res) node.set(PDFName.of('Resources'), res);
        page.setRotation(page.getRotation());
      });
      for (let i = all.length - 1; i >= 0; i--) doc.removePage(i);
      for (const p of list) {
        const page = all[p.index];
        turned(page, p);
        doc.addPage(page);
      }
      return new Blob([await doc.save()], { type: 'application/pdf' });
    }
    // From several: each file's pages copied in one go (what they share —
    // fonts, pictures — copied once, not once a page), then put in order
    const out = await PDFDocument.create();
    const wanted = new Map();
    list.forEach((p) => {
      if (!wanted.has(p.srcId)) wanted.set(p.srcId, []);
      wanted.get(p.srcId).push(p.index);
    });
    const copies = new Map();
    for (const [id, indexes] of wanted) copies.set(id, await out.copyPages(sources.current.get(id).lib, indexes));
    const used = new Map();
    for (const p of list) {
      const k = used.get(p.srcId) || 0;
      used.set(p.srcId, k + 1);
      const copy = copies.get(p.srcId)[k];
      turned(copy, p);
      out.addPage(copy);
    }
    return new Blob([await out.save()], { type: 'application/pdf' });
  };

  // Named after the file the pages came from (all of them from one), else "merged"
  const outName = (list, suffix) => {
    const ids = new Set(list.map(p => p.srcId));
    const single = ids.size === 1 ? sources.current.get([...ids][0]) : null;
    return single ? `${baseName(single.name)}${suffix}` : `merged${suffix}`;
  };

  const run = async (e, key, job) => {
    if (e.detail) e.currentTarget.blur();
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
    downloadBlob(await buildPdf(pages), outName(pages, '-edited.pdf'));
  });

  const split = (e) => run(e, 'split', async () => {
    const files = {};
    const unique = uniqueNamer();
    const stem = outName(pages, ''); // (already without .pdf: cut again, "Invoice 2024.03" lost its ".03")
    for (let i = 0; i < pages.length; i++) {
      const blob = await buildPdf([pages[i]]);
      files[unique(`${stem}-page-${i + 1}.pdf`)] = new Uint8Array(await blob.arrayBuffer());
    }
    downloadBlob(new Blob([zipSync(files, { level: 6 })], { type: 'application/zip' }), `${stem}-pages.zip`);
  });

  const toImages = (e) => run(e, 'images', async () => {
    const files = {};
    const unique = uniqueNamer();
    const stem = outName(pages, ''); // (already without .pdf: cut again, "Invoice 2024.03" lost its ".03")
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
  const none = !pages.length || !!loading;

  return (
    <div className="tool">
      <p className="tool-desc">merge, split, rotate or turn pages into images</p>
      {/* A fixed-size box that scrolls inside: the page itself stays still */}
      <div
        ref={dropBox}
        className={`tool-box pdf-drop ${pages.length ? 'has-pages' : ''} ${dragging ? 'dragging' : ''}`}
        // Empty: anywhere opens the picker; with pages, only the space around them
        onClick={(e) => { if (!pages.length || e.target === e.currentTarget || e.target.classList.contains('pdf-drop-inner')) inputRef.current?.click(); }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false); }}
        onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer?.files || []); }}
      >
        <div
          className={`pdf-drop-inner ${pages.length || hold ? 'full' : 'drop-box-empty'}`}
          style={hold ? { minHeight: `${hold}px` } : undefined}
        >
        {/* When pages come in, the hint just goes: its fading copy would sit over them */}
        <FadeText k={!pages.length && !hold ? 'hint' : ''} quiet={pages.length > 0} className="tool-hint">{!pages.length && !hold ? 'drop, paste or click to add PDFs' : null}</FadeText>
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
                  onClick={(e) => { if (e.detail) e.currentTarget.blur(); toggle(p.id); }}
                  aria-pressed={isSel}
                  title={isSel ? 'Unselect page' : 'Select page'}
                >
                  {thumbs.get(p.id) && <img src={thumbs.get(p.id)} alt={`Page ${label.num}`} style={{ transform: `rotate(${p.rotation}deg)` }} draggable={false} onLoad={fadeInOnLoad} />}
                </button>
                <div className="page-label">
                  <span>{label.num}</span>
                  {/* File names come and go with the text swap (a second file added, the others removed) */}
                  <FadeText k={label.name} className="page-src">{label.name || null}</FadeText>
                </div>
                <div className="page-buttons">
                  <button className="btn btn-sm btn-icon" onClick={(e) => { if (e.detail) e.currentTarget.blur(); rotate(p.id, -90); }} title="Rotate left" aria-label="Rotate left"><RotateCcw size={12} /></button>
                  <button className="btn btn-sm btn-icon" onClick={(e) => { if (e.detail) e.currentTarget.blur(); rotate(p.id, 90); }} title="Rotate right" aria-label="Rotate right"><RotateCw size={12} /></button>
                  <button className="btn btn-sm btn-icon" onClick={(e) => { if (e.detail) e.currentTarget.blur(); move(p.id, -1); }} disabled={n <= 0} title="Move earlier" aria-label="Move earlier"><ChevronLeft size={12} /></button>
                  <button className="btn btn-sm btn-icon" onClick={(e) => { if (e.detail) e.currentTarget.blur(); move(p.id, 1); }} disabled={n >= pages.length - 1} title="Move later" aria-label="Move later"><ChevronRight size={12} /></button>
                  <button className="btn btn-sm btn-icon" onClick={(e) => { if (e.detail) e.currentTarget.blur(); else keepFocusAfterRemove(e.currentTarget); removePages(new Set([p.id])); }} title="Delete page" aria-label="Delete page"><X size={12} /></button>
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
        </div>
      </div>

      {/* The stats: always there, only the numbers change (counting from 0) */}
      {/* Undo · redo | the stats | delete (the selection, or every page) */}
      <BoxRow
        history={history}
        onTrash={() => removePages(selected.size ? new Set(selected) : new Set(pages.map(p => p.id)))}
        trashDisabled={!pages.length}
        trashTitle={selected.size && selected.size < pages.length ? 'Delete the selected pages' : 'Delete all pages'}        held={pages.length > 0}
      >
        <div className="tool-meta tool-stats" aria-live="polite">
          pages <Count value={pages.length} /> · files <Count value={fileCount} /> · selected <Count value={selected.size} />
        </div>
      </BoxRow>

      {/* The input and the actions (icons), then the saves on their own row */}
      <div className="button-rows">
        <FlipRow>
          <button className="btn btn-icon" onClick={(e) => { if (e.detail) e.currentTarget.blur(); inputRef.current?.click(); }} title="Add PDFs" aria-label="Add PDFs">
            <FilePlus size={14} />
          </button>
          <button className={`btn btn-icon ${done.split ? 'btn-done' : ''}`} onClick={split} disabled={none || !!busy} title="Split into one PDF a page" aria-label="Split into one PDF a page">
            <Scissors size={14} />
          </button>
        </FlipRow>
        <FlipRow>
          <button className={`btn ${done.save ? 'btn-done' : ''}`} onClick={saveAll} disabled={none || !!busy}>
            {/* "merged" comes and goes with the word slide (a cross-fade of the
                whole label inside a button easing its width was choppy) */}
            <span className="btn-label">save<SlideText show={fileCount > 1}>{'\u00a0merged'}</SlideText> PDF</span>
          </button>
          <button className={`btn ${done.images ? 'btn-done' : ''}`} onClick={toImages} disabled={none || !!busy}>
            save PNG
          </button>
        </FlipRow>
      </div>
    </div>
  );
}
