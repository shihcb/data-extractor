import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Download, FileUp, Undo2, ZoomIn, ZoomOut } from 'lucide-react';
import { closePdf, loadPdfLib, openPdf, renderPage, isPasswordError } from '../pdf';
import { baseName, canvasToBlob, downloadBlob, isPdfFile, useDoneFlags, usePastedFiles } from '../utils';
import { MOTION_MS, motionEase, prefersReducedMotion } from '../motion';
import { useToast } from '../toastContext';
import Count from './Count';
import FadeText from './FadeText';
import FlipRow from './FlipRow';
import MotionList from './MotionList';

// Changing text in a PDF the reliable way (what browser PDF editors do):
// the old words are covered with a patch the colour of the paper behind
// them, and the new words are written on top in a standard font close to
// the original, at the same spot and size. Everything else is untouched.

const PAGE_CSS_WIDTH = 820;
const PAD = 0.12; // patch margin, as a share of the font size
const ZOOM_MAX = 5;
const ZOOM_STEP = 1.5;
const clampZoom = (z) => Math.min(ZOOM_MAX, Math.max(1, z));

let nextDocId = 1;

// Which standard PDF font is closest to the original
function pickFont(realName = '', family = '') {
  const n = `${realName} ${family}`.toLowerCase();
  const bold = /bold|black|heavy|semibold|demi/.test(n);
  const italic = /italic|oblique/.test(n);
  let base = 'Helvetica';
  if (/mono|courier|consol|menlo/.test(n)) base = 'Courier';
  else if (/serif|times|georgia|garamond|roman|cambria|minion|book/.test(n) && !/sans/.test(n)) base = 'Times';
  return { base, bold, italic };
}

function standardFontKey({ base, bold, italic }) {
  if (base === 'Times') return bold && italic ? 'TimesRomanBoldItalic' : bold ? 'TimesRomanBold' : italic ? 'TimesRomanItalic' : 'TimesRoman';
  const suffix = bold && italic ? 'BoldOblique' : bold ? 'Bold' : italic ? 'Oblique' : '';
  return `${base}${suffix}`;
}

const cssFont = ({ base, bold, italic }) => ({
  fontFamily: base === 'Times' ? '"Times New Roman", Times, serif' : base === 'Courier' ? '"Courier New", Courier, monospace' : 'Helvetica, Arial, sans-serif',
  fontWeight: bold ? 700 : 400,
  fontStyle: italic ? 'italic' : 'normal',
});

// The paper colour around the words (most common colour along the box's
// edge) and the ink colour (the pixel inside that differs most from it),
// read from the drawn page.
function sampleColors(img, box) {
  const scaleX = img.naturalWidth / 100;
  const scaleY = img.naturalHeight / 100;
  const x = Math.max(0, Math.floor(box.left * scaleX) - 2);
  const y = Math.max(0, Math.floor(box.top * scaleY) - 2);
  const w = Math.min(img.naturalWidth - x, Math.ceil(box.width * scaleX) + 4);
  const h = Math.min(img.naturalHeight - y, Math.ceil(box.height * scaleY) + 4);
  if (w <= 0 || h <= 0) return { bg: [255, 255, 255], ink: [0, 0, 0] };
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  const px = (i, j) => { const k = (j * w + i) * 4; return [data[k], data[k + 1], data[k + 2]]; };
  const counts = new Map();
  const vote = (c) => {
    const key = c.map(v => v >> 3).join(',');
    const e = counts.get(key) || { n: 0, c };
    e.n++;
    counts.set(key, e);
  };
  for (let i = 0; i < w; i++) { vote(px(i, 0)); vote(px(i, h - 1)); }
  for (let j = 0; j < h; j++) { vote(px(0, j)); vote(px(w - 1, j)); }
  let bg = [255, 255, 255];
  let best = -1;
  counts.forEach(({ n, c }) => { if (n > best) { best = n; bg = c; } });
  let ink = bg[0] + bg[1] + bg[2] > 382 ? [0, 0, 0] : [255, 255, 255];
  let far = -1;
  for (let j = 2; j < h - 2; j++) {
    for (let i = 2; i < w - 2; i++) {
      const c = px(i, j);
      const d = (c[0] - bg[0]) ** 2 + (c[1] - bg[1]) ** 2 + (c[2] - bg[2]) ** 2;
      if (d > far) { far = d; ink = c; }
    }
  }
  if (far < 900) ink = bg[0] + bg[1] + bg[2] > 382 ? [0, 0, 0] : [255, 255, 255];
  return { bg, ink };
}

const rgbCss = (c) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;

// Characters the standard fonts can't write become "?" (they only cover
// Western European letters and common symbols).
function encodable(font, text) {
  let out = '';
  let lost = false;
  for (const ch of text) {
    try {
      font.encodeText(ch);
      out += ch;
    } catch {
      out += '?';
      lost = true;
    }
  }
  return { text: out, lost };
}

// Every piece of text on a page, at any angle and on rotated pages too:
// where it is in the PDF (for writing) and where it's drawn (for showing,
// in % of the drawn page, with its angle on screen). Only text written top
// to bottom is left out: the standard fonts can't write it.
function itemsOf(page, content, viewport, n) {
  const items = [];
  content.items.forEach((item, i) => {
    if (!item.str || !item.str.trim() || item.dir === 'ttb') return;
    const [a, b, c, d, e, f] = item.transform;
    // Mirrored text can't be retyped in place
    if (a * d - b * c <= 0) return;
    const style = content.styles[item.fontName] || {};
    const size = Math.hypot(c, d); // the font's height
    if (!(size > 0)) return;
    const angle = Math.atan2(b, a); // its baseline's direction, in the PDF
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const ascent = style.ascent || 0.8;
    const descent = style.descent || -0.2;
    const width = item.width || size * item.str.length * 0.5;
    // Its box's corners in the PDF: along the baseline, and up from it
    const at = (along, up) => viewport.convertToViewportPoint(e + along * cos - up * sin, f + along * sin + up * cos);
    const tl = at(0, ascent * size);
    const tr = at(width, ascent * size);
    const bl = at(0, descent * size);
    const br = at(width, descent * size);
    const xs = [tl[0], tr[0], bl[0], br[0]];
    const ys = [tl[1], tr[1], bl[1], br[1]];
    let realName = '';
    try {
      if (page.commonObjs.has(item.fontName)) realName = page.commonObjs.get(item.fontName)?.name || '';
    } catch {
      realName = '';
    }
    items.push({
      id: `${n}-${i}`,
      page: n - 1,
      str: item.str,
      // In PDF units, for writing
      pdf: { x: e, y: f, size, width, ascent, descent, angle },
      // In % of the drawn page, for showing (turned about its top-left corner)
      box: {
        left: (tl[0] / viewport.width) * 100,
        top: (tl[1] / viewport.height) * 100,
        width: (Math.hypot(tr[0] - tl[0], tr[1] - tl[1]) / viewport.width) * 100,
        height: (Math.hypot(bl[0] - tl[0], bl[1] - tl[1]) / viewport.height) * 100,
        turn: (Math.atan2(tr[1] - tl[1], tr[0] - tl[0]) * 180) / Math.PI,
        // Straight around it, for reading the colours behind it
        sample: {
          left: (Math.min(...xs) / viewport.width) * 100,
          top: (Math.min(...ys) / viewport.height) * 100,
          width: ((Math.max(...xs) - Math.min(...xs)) / viewport.width) * 100,
          height: ((Math.max(...ys) - Math.min(...ys)) / viewport.height) * 100,
        },
        fontSize: ((size * viewport.scale) / viewport.width) * 100, // in cqw
      },
      font: pickFont(realName, style.fontFamily),
    });
  });
  return items;
}

export default function PdfEditor({ active }) {
  const [doc, setDoc] = useState(null); // { id, name, bytes, pages: [{ key, num, url, items, width, height }] }
  const [edits, setEdits] = useState({}); // item id -> { text, bg, ink }
  const [editing, setEditing] = useState(null); // item id
  const [draft, setDraft] = useState('');
  const [draftColors, setDraftColors] = useState(null); // { bg, ink } of the text being edited
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [done, flagDone] = useDoneFlags();
  const inputRef = useRef(null);
  const imgRefs = useRef({});
  // Closing: the box's content holds its height while the pages pop out
  // where they are, then the box goes back to empty (PDF tools' clear)
  const dropBox = useRef(null);
  const scrollRef = useRef(null); // what scrolls inside the box (both ways once zoomed)
  const innerRef = useRef(null);
  const [hold, setHold] = useState(0);
  const holdTimer = useRef(null);
  const holdWhileLeaving = () => {
    const inner = innerRef.current;
    if (!inner) return;
    setHold(inner.offsetHeight);
    clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => setHold(0), MOTION_MS + 100);
  };
  useEffect(() => () => clearTimeout(holdTimer.current), []);
  const docRef = useRef(doc);
  docRef.current = doc;
  const toast = useToast();

  const release = (d) => d?.pages.forEach(p => URL.revokeObjectURL(p.url));
  // Once a document's pages have popped out (they show their pictures until then)
  const releaseLater = (d) => setTimeout(() => release(d), MOTION_MS + 300);

  // The open document, kept for drawing pages sharper when zoomed in
  const viewRef = useRef(null);
  const dropView = () => {
    closePdf(viewRef.current?.view);
    viewRef.current = null;
  };
  useEffect(() => () => dropView(), []);

  // Zoom: 1 = the page fits the box's width. Applied straight to the page
  // (no re-render per frame), the spot under your fingers / the middle of
  // the box staying where it is; the buttons ease it on the app's curve.
  const [zoom, setZoomState] = useState(1); // where it's headed (the % shown)
  const zoomNow = useRef(1); // where it's drawn
  const zooming = useRef(false);
  const zoomAnim = useRef(null);
  const applyZoom = (z, ax, ay) => {
    const sc = scrollRef.current;
    const inner = innerRef.current;
    if (!sc || !inner) return;
    const k = z / zoomNow.current;
    if (Math.abs(k - 1) < 1e-9) return;
    const left = sc.scrollLeft;
    const top = sc.scrollTop;
    inner.style.setProperty('--zoom', String(z));
    zoomNow.current = z;
    sc.scrollLeft = (left + ax) * k - ax;
    sc.scrollTop = (top + ay) * k - ay;
  };
  const settleZoom = () => {
    // The pages' height changed with the zoom: the boxes take their new
    // size straight away, not easing after it (see heightMotion)
    requestAnimationFrame(() => { zooming.current = false; });
  };
  const zoomTo = (target, ax, ay) => {
    const sc = scrollRef.current;
    if (!sc) return;
    target = clampZoom(target);
    if (ax === undefined) { ax = sc.clientWidth / 2; ay = sc.clientHeight / 2; }
    cancelAnimationFrame(zoomAnim.current);
    setZoomState(target);
    zooming.current = true;
    const from = zoomNow.current;
    if (prefersReducedMotion()) {
      applyZoom(target, ax, ay);
      settleZoom();
      return;
    }
    const t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / MOTION_MS);
      applyZoom(from + (target - from) * motionEase(t), ax, ay);
      if (t < 1) zoomAnim.current = requestAnimationFrame(step);
      else settleZoom();
    };
    zoomAnim.current = requestAnimationFrame(step);
  };
  const resetZoom = () => {
    cancelAnimationFrame(zoomAnim.current);
    zoomNow.current = 1;
    innerRef.current?.style.setProperty('--zoom', '1');
    setZoomState(1);
  };

  // Pinch (two fingers) and trackpad pinch / ctrl + wheel zoom around the
  // spot you're zooming on, following your fingers with no easing
  useEffect(() => {
    const sc = scrollRef.current;
    if (!sc) return undefined;
    // Easing boxes inside don't ease while zooming (they'd lag behind)
    sc._heightMotion = { running: () => zooming.current, animatesChanges: () => false };
    let pinch = null;
    const spot = (x, y) => {
      const r = sc.getBoundingClientRect();
      return [x - r.left, y - r.top];
    };
    const onStart = (e) => {
      if (e.touches.length !== 2 || !docRef.current) return;
      const [a, b] = e.touches;
      cancelAnimationFrame(zoomAnim.current);
      zooming.current = true;
      pinch = { dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), zoom: zoomNow.current };
    };
    const onMove = (e) => {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      const [a, b] = e.touches;
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const [ax, ay] = spot((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2);
      applyZoom(clampZoom(pinch.zoom * (dist / pinch.dist)), ax, ay);
    };
    const onEnd = (e) => {
      if (!pinch || e.touches.length >= 2) return;
      pinch = null;
      setZoomState(zoomNow.current);
      settleZoom();
    };
    let wheelDone = null;
    const onWheel = (e) => {
      if (!e.ctrlKey || !docRef.current) return;
      e.preventDefault();
      cancelAnimationFrame(zoomAnim.current);
      zooming.current = true;
      const [ax, ay] = spot(e.clientX, e.clientY);
      applyZoom(clampZoom(zoomNow.current * Math.exp(-e.deltaY * 0.01)), ax, ay);
      clearTimeout(wheelDone);
      wheelDone = setTimeout(() => { setZoomState(zoomNow.current); settleZoom(); }, 150);
    };
    sc.addEventListener('touchstart', onStart, { passive: true });
    sc.addEventListener('touchmove', onMove, { passive: false });
    sc.addEventListener('touchend', onEnd);
    sc.addEventListener('touchcancel', onEnd);
    sc.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      clearTimeout(wheelDone);
      sc._heightMotion = null;
      sc.removeEventListener('touchstart', onStart);
      sc.removeEventListener('touchmove', onMove);
      sc.removeEventListener('touchend', onEnd);
      sc.removeEventListener('touchcancel', onEnd);
      sc.removeEventListener('wheel', onWheel);
    };
  }, []);

  const openFile = useCallback(async (files) => {
    const file = [...files].find(isPdfFile);
    if (!file) return;
    let view = null;
    try {
      const bytes = await file.arrayBuffer();
      const { PDFDocument } = await loadPdfLib();
      try {
        await PDFDocument.load(bytes);
      } catch (err) {
        throw new Error(/encrypt/i.test(err?.message || '') ? 'password' : 'broken');
      }
      view = await openPdf(bytes);
      const pages = [];
      for (let n = 1; n <= view.numPages; n++) {
        const page = await view.getPage(n);
        const { canvas, viewport } = await renderPage(page, { cssWidth: PAGE_CSS_WIDTH });
        const url = URL.createObjectURL(await canvasToBlob(canvas, 'image/png'));
        const px = canvas.width;
        canvas.width = canvas.height = 0;
        const content = await page.getTextContent();
        const items = itemsOf(page, content, viewport, n);
        page.cleanup();
        pages.push({ num: n, url, px, items, width: viewport.width, height: viewport.height });
      }
      // A new document's pages pop in as the old one's pop out
      const id = nextDocId++;
      pages.forEach(p => { p.key = `${id}-${p.num}`; });
      clearTimeout(holdTimer.current);
      setHold(0);
      resetZoom();
      // Kept open to draw the pages sharper when zoomed in
      dropView();
      viewRef.current = { id, view };
      view = null;
      setDoc(prev => {
        if (prev) releaseLater(prev);
        return { id, name: file.name, bytes, pages };
      });
      setEdits({});
      setEditing(null);
      if (!pages.some(p => p.items.length)) toast('no text to change in this PDF (is it a scan?)', { warn: true });
    } catch (err) {
      if (err?.code === 'library') {
        // Not the file's fault: the PDF reader itself didn't load
        toast(err.message, { warn: true });
        return;
      }
      const why = err?.message === 'password' || isPasswordError(err) ? 'is password-protected' : "isn't a PDF this can open";
      toast(`${file.name} ${why}`, { warn: true });
    } finally {
      closePdf(view);
    }
  }, [toast]);

  usePastedFiles(active, isPdfFile, openFile);

  // Zoomed in, the pages are drawn again at the size they're shown (once the
  // zoom has settled: drawing a page is heavy work, never while things move)
  useEffect(() => {
    if (!doc) return undefined;
    let stale = false;
    const t = setTimeout(async () => {
      const open = viewRef.current;
      if (!open || open.id !== doc.id) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      for (const p of doc.pages) {
        if (stale) return;
        const img = imgRefs.current[p.key];
        if (!img) continue;
        const cssWidth = img.getBoundingClientRect().width;
        if (!cssWidth || p.maxed || p.px >= cssWidth * dpr * 0.9) continue;
        try {
          const page = await open.view.getPage(p.num);
          const { canvas } = await renderPage(page, { cssWidth });
          const url = URL.createObjectURL(await canvasToBlob(canvas, 'image/png'));
          const px = canvas.width;
          canvas.width = canvas.height = 0;
          page.cleanup();
          if (stale || viewRef.current !== open) {
            URL.revokeObjectURL(url);
            return;
          }
          setDoc(prev => {
            if (!prev || prev.id !== doc.id) {
              URL.revokeObjectURL(url);
              return prev;
            }
            return { ...prev, pages: prev.pages.map(q => {
              if (q.key !== p.key) return q;
              // The old picture stays until the new one has replaced it
              const old = q.url;
              setTimeout(() => URL.revokeObjectURL(old), 2000);
              // Drawn as big as a page can be: no use drawing it again
              return { ...q, url, px, maxed: px < cssWidth * dpr * 0.9 };
            }) };
          });
        } catch {
          return;
        }
      }
    }, MOTION_MS + 250);
    return () => { stale = true; clearTimeout(t); };
    // Only when the zoom or the document changes (not each sharper page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, doc?.id]);

  useEffect(() => () => release(docRef.current), []);

  const cancelled = useRef(false);
  const startEdit = (item) => {
    const edit = edits[item.id];
    let colors = edit;
    if (!colors) {
      try {
        colors = sampleColors(imgRefs.current[`${doc.id}-${item.page + 1}`], item.box.sample || item.box);
      } catch {
        colors = { bg: [255, 255, 255], ink: [0, 0, 0] };
      }
    }
    cancelled.current = false;
    setDraftColors({ bg: colors.bg, ink: colors.ink });
    setDraft(edit?.text ?? item.str);
    setEditing(item.id);
  };

  const commit = (item) => {
    if (cancelled.current) { // Escape: the blur that follows doesn't save
      cancelled.current = false;
      return;
    }
    setEditing(null);
    const text = draft;
    const colors = draftColors;
    setEdits(prev => {
      const next = { ...prev };
      if (text === item.str) delete next[item.id];
      else next[item.id] = { text, bg: colors.bg, ink: colors.ink };
      return next;
    });
  };

  const save = async (e) => {
    e.currentTarget.blur();
    if (!doc || busy) return;
    setBusy(true);
    try {
      const { PDFDocument, StandardFonts, rgb, degrees } = await loadPdfLib();
      const pdf = await PDFDocument.load(doc.bytes);
      const fonts = new Map();
      const getFont = async (key) => {
        if (!fonts.has(key)) fonts.set(key, await pdf.embedFont(StandardFonts[key]));
        return fonts.get(key);
      };
      const color = (c) => rgb(c[0] / 255, c[1] / 255, c[2] / 255);
      let lost = false;
      const all = doc.pages.flatMap(p => p.items);
      for (const item of all) {
        const edit = edits[item.id];
        if (!edit) continue;
        const page = pdf.getPage(item.page);
        const font = await getFont(standardFontKey(item.font));
        const safe = encodable(font, edit.text);
        lost = lost || safe.lost;
        const { x, y, size, width, ascent, descent, angle = 0 } = item.pdf;
        const newWidth = safe.text ? font.widthOfTextAtSize(safe.text, size) : 0;
        const pad = size * PAD;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        // The patch's corner: back along the baseline and down from it, turned with the text
        const along = -pad;
        const up = descent * size - pad;
        page.drawRectangle({
          x: x + along * cos - up * sin,
          y: y + along * sin + up * cos,
          width: Math.max(width, newWidth) + pad * 2,
          height: (ascent - descent) * size + pad * 2,
          rotate: degrees((angle * 180) / Math.PI),
          color: color(edit.bg),
          borderWidth: 0,
        });
        if (safe.text) page.drawText(safe.text, { x, y, size, font, color: color(edit.ink), rotate: degrees((angle * 180) / Math.PI) });
      }
      const out = await pdf.save();
      downloadBlob(new Blob([out], { type: 'application/pdf' }), `${baseName(doc.name)}-edited.pdf`);
      flagDone('save');
      if (lost) toast('some characters aren\'t in the standard PDF fonts and were saved as "?"', { warn: true });
    } catch (err) {
      toast(`couldn't save${err?.message ? `: ${err.message}` : ''}`, { warn: true });
    } finally {
      setBusy(false);
    }
  };

  const editCount = Object.keys(edits).length;
  const textCount = doc ? doc.pages.reduce((n, p) => n + p.items.length, 0) : 0;
  const close = () => {
    dropView();
    releaseLater(doc);
    holdWhileLeaving();
    setDoc(null);
    setEdits({});
    setEditing(null);
  };

  return (
    <div className="tool">
      <p className="tool-desc">click any text in a PDF to change it</p>
      {/* The same box as PDF tools: a fixed size that scrolls inside (the
          page stays still); the pages pop in and out like PDF tools' cards */}
      <div
        ref={dropBox}
        className={`tool-box pdf-drop editor-drop ${doc ? 'has-pages' : ''} ${dragging ? 'dragging' : ''}`}
        // Empty: anywhere opens the picker; with a PDF, only the space around it
        onClick={(e) => { if (!doc || e.target === e.currentTarget || e.target === scrollRef.current || e.target.classList.contains('pdf-drop-inner')) inputRef.current?.click(); }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false); }}
        onDrop={(e) => { e.preventDefault(); setDragging(false); openFile(e.dataTransfer?.files || []); }}
        aria-label="Open a PDF"
      >
        {/* Scrolls inside the box, both ways once zoomed in */}
        <div ref={scrollRef} className="editor-scroll">
        <div
          ref={innerRef}
          className={`pdf-drop-inner ${doc || hold ? 'full' : 'drop-box-empty'}`}
          style={hold ? { minHeight: `${hold}px` } : undefined}
        >
          <FadeText k={!doc && !hold ? 'hint' : ''} quiet={!!doc} className="tool-hint">{!doc && !hold ? 'drop, paste or click to open a PDF' : null}</FadeText>
          <MotionList
            items={doc ? doc.pages : []}
            getKey={p => p.key}
            motion="pop"
            className="pdf-pages"
            renderItem={(p) => (
              <div className="tool-box pdf-page" style={{ aspectRatio: `${p.width} / ${p.height}` }}>
                <img
                  // By the page's own key: an old document's pages still popping
                  // out mustn't stand in for (or clear) the new one's
                  ref={el => { if (el) imgRefs.current[p.key] = el; else delete imgRefs.current[p.key]; }}
                  src={p.url}
                  alt={`Page ${p.num}`}
                  className="pdf-page-img"
                  draggable={false}
                />
                <div className="pdf-text-layer">
                  {p.items.map(item => {
                    const edit = edits[item.id];
                    const pos = {
                      left: `${item.box.left}%`,
                      top: `${item.box.top}%`,
                      minWidth: `${item.box.width}%`,
                      height: `${item.box.height}%`,
                      '--fs': item.box.fontSize,
                      // Turned with the text (about its top-left corner)
                      transform: item.box.turn ? `rotate(${item.box.turn}deg)` : undefined,
                      ...cssFont(item.font),
                    };
                    if (editing === item.id && draftColors) {
                      const colors = draftColors;
                      return (
                        <input
                          key={item.id}
                          className="pdf-text-input"
                          style={{ ...pos, background: rgbCss(colors.bg), color: rgbCss(colors.ink), width: `${Math.max(draft.length, 1) * 0.62}em` }}
                          value={draft}
                          autoFocus
                          onChange={(e) => setDraft(e.target.value)}
                          onBlur={() => commit(item)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') e.currentTarget.blur();
                            if (e.key === 'Escape') {
                              cancelled.current = true;
                              setEditing(null);
                            }
                          }}
                          aria-label="Change text"
                          spellCheck={false}
                        />
                      );
                    }
                    return (
                      <button
                        key={item.id}
                        className={`pdf-text-item ${edit ? 'edited' : ''}`}
                        style={edit ? { ...pos, background: rgbCss(edit.bg), color: rgbCss(edit.ink) } : pos}
                        onClick={() => startEdit(item)}
                        title={edit ? `was: ${item.str}` : 'Change this text'}
                      >
                        {edit ? edit.text : ''}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          />
        </div>
        </div>
        {/* Zoom: pinch too (or the trackpad / ctrl + scroll) */}
        <div className={`zoom-pill ${doc ? 'show' : ''}`} aria-hidden={!doc}>
          <button className="zoom-btn" onClick={(e) => { e.currentTarget.blur(); zoomTo(zoom / ZOOM_STEP); }} disabled={!doc || zoom <= 1} title="Zoom out" aria-label="Zoom out"><ZoomOut size={14} /></button>
          <span className="zoom-num"><Count value={Math.round(zoom * 100)} />%</span>
          <button className="zoom-btn" onClick={(e) => { e.currentTarget.blur(); zoomTo(zoom * ZOOM_STEP); }} disabled={!doc || zoom >= ZOOM_MAX} title="Zoom in" aria-label="Zoom in"><ZoomIn size={14} /></button>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onChange={(e) => { openFile(e.target.files || []); e.target.value = ''; }}
      />

      {/* The stats: always there, only the numbers change (counting from 0) */}
      <div className="tool-meta tool-stats" aria-live="polite">
        pages <Count value={doc ? doc.pages.length : 0} /> · texts <Count value={textCount} /> · changes <Count value={editCount} />
      </div>

      <FlipRow>
        <button className="btn btn-icon" onClick={(e) => { e.currentTarget.blur(); inputRef.current?.click(); }} title="Open a PDF" aria-label="Open a PDF">
          <FileUp size={14} />
        </button>
        <button className={`btn btn-primary ${done.save ? 'btn-done' : ''}`} onClick={save} disabled={!doc || !editCount || busy}>
          <Download size={14} /> save pdf
        </button>
        <button className="btn" onClick={(e) => { e.currentTarget.blur(); setEdits({}); }} disabled={!editCount}>
          <Undo2 size={14} /> undo changes
        </button>
        <button className="btn" onClick={(e) => { e.currentTarget.blur(); close(); }} disabled={!doc}>
          close
        </button>
      </FlipRow>
    </div>
  );
}
