import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Download, FileUp, Redo2, Replace, Type, Undo2, ZoomIn, ZoomOut } from 'lucide-react';
import { closePdf, loadPdfLib, loadPdfjs, openPdf, renderPage, isPasswordError } from '../pdf';
import { readLine } from '../ocr';
import { removeText } from '../pdfText';
import { baseName, canvasToBlob, downloadBlob, isPdfFile, loadLibrary, useDoneFlags, usePastedFiles } from '../utils';
import { MOTION_MS, motionEase, prefersReducedMotion } from '../motion';
import { useToast } from '../toastContext';
import { cssFont, cssWidthEm, fontInfoOf, originalCanWrite, squeezeFor, standardFontKey, unicodeFontOf } from '../pdfFonts';
import Collapse from './Collapse';
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

// Where a font's baseline sits in a line exactly one font size tall, as a
// share of the font size (measured once per font): the text on screen is
// placed so its baseline lands on the PDF's own, not centred in its box.
const baselines = new Map();
function baselineOf(css) {
  const key = `${css.fontFamily}|${css.fontWeight}|${css.fontStyle}`;
  if (baselines.has(key)) return baselines.get(key);
  const probe = document.createElement('div');
  Object.assign(probe.style, {
    position: 'absolute', left: '-9999px', top: '0', visibility: 'hidden',
    fontSize: '100px', lineHeight: '1', whiteSpace: 'nowrap', ...css,
  });
  probe.textContent = 'Hg';
  const mark = document.createElement('span');
  Object.assign(mark.style, { display: 'inline-block', width: '0', height: '0', verticalAlign: 'baseline' });
  probe.appendChild(mark);
  document.body.appendChild(probe);
  const ratio = mark.offsetTop / 100;
  probe.remove();
  const value = ratio > 0 && ratio < 1.5 ? ratio : 0.8;
  baselines.set(key, value);
  return value;
}

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
  return colorsIn(img, x, y, w, h);
}

// The same, from a region of any picture or canvas, in its pixels
function colorsIn(source, x, y, w, h) {
  if (w <= 0 || h <= 0) return { bg: [255, 255, 255], ink: [0, 0, 0] };
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(source, x, y, w, h, 0, 0, w, h);
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
// The pieces pdf.js reads come as the PDF wrote them: often a line in bits
// (each word placed on its own, a ligature on its own, "justi" "fi" "ed").
// Pieces in the same font and size, on the same baseline, one right after
// the other, become one line to change — a space put back where there's a
// gap a space wide.
function linesOf(content) {
  const lines = [];
  content.items.forEach((item, i) => {
    if (!item.str || !item.str.trim() || item.dir === 'ttb') return;
    const [a, b, c, d, e, f] = item.transform;
    // Mirrored text can't be retyped in place
    if (a * d - b * c <= 0) return;
    const size = Math.hypot(c, d); // the font's height
    if (!(size > 0)) return;
    const angle = Math.atan2(b, a); // its baseline's direction, in the PDF
    const width = item.width || size * item.str.length * 0.5;
    const last = lines[lines.length - 1];
    if (last && last.fontName === item.fontName && Math.abs(last.size - size) < size * 0.02 && Math.abs(last.angle - angle) < 0.01) {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const dx = e - last.e;
      const dy = f - last.f;
      const along = dx * cos + dy * sin;
      const up = -dx * sin + dy * cos;
      const gap = along - last.width;
      if (Math.abs(up) < size * 0.1 && gap > -size * 0.25 && gap < size * 0.6) {
        const spaced = /\s$/.test(last.str) || /^\s/.test(item.str);
        last.str += (gap > size * 0.15 && !spaced ? ' ' : '') + item.str;
        last.width = Math.max(last.width, along + width);
        return;
      }
    }
    lines.push({ i, str: item.str, e, f, size, angle, width, fontName: item.fontName });
  });
  return lines;
}

function itemsOf(page, content, viewport, n, fonts) {
  const items = [];
  linesOf(content).forEach((item) => {
    const { i, e, f, size, angle } = item;
    const style = content.styles[item.fontName] || {};
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const ascent = style.ascent || 0.8;
    const descent = style.descent || -0.2;
    // The font as pdf.js read it (once per font): its own file and letters
    if (!(item.fontName in fonts)) {
      let font = null;
      try {
        if (page.commonObjs.has(item.fontName)) font = page.commonObjs.get(item.fontName);
      } catch {
        font = null;
      }
      fonts[item.fontName] = fontInfoOf(font, style.fontFamily);
    }
    const info = fonts[item.fontName];
    // A space at the end isn't a word to change (nor room it takes)
    const trailing = item.str.length - item.str.replace(/\s+$/, '').length;
    item.str = item.str.slice(0, item.str.length - trailing);
    const width = Math.max(size * 0.1, item.width - trailing * (info?.spaceWidth || 0.278) * size);
    // Its box's corners in the PDF: along the baseline, and up from it
    const at = (along, up) => viewport.convertToViewportPoint(e + along * cos - up * sin, f + along * sin + up * cos);
    const tl = at(0, ascent * size);
    const tr = at(width, ascent * size);
    const bl = at(0, descent * size);
    const br = at(width, descent * size);
    const xs = [tl[0], tr[0], bl[0], br[0]];
    const ys = [tl[1], tr[1], bl[1], br[1]];
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
      fontKey: item.fontName,
      font: info?.style || { base: 'Helvetica', bold: false, italic: false },
    });
  });
  return items;
}

// ── Pictures of text ──────────────────────────────────────────────────
// Some PDFs draw lines of text as pictures (Apple Mail prints an email's
// From / Subject / Date / To that way). Each short, wide picture on a page
// becomes an item too: tapped, its words are read (OCR) and can be changed
// like any text — it's covered whole, and the new words written on its line.

const applyM = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const compose = (a, b) => [
  a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5],
];

// Where each picture is drawn on the page, in the PDF's units
async function picturesOf(page, OPS) {
  const list = await page.getOperatorList();
  const out = [];
  let ctm = [1, 0, 0, 1, 0, 0];
  const stack = [];
  list.fnArray.forEach((fn, i) => {
    const args = list.argsArray[i];
    if (fn === OPS.save) stack.push(ctm);
    else if (fn === OPS.restore) ctm = stack.pop() || ctm;
    else if (fn === OPS.transform) ctm = compose(ctm, args);
    else if (fn === OPS.paintFormXObjectBegin) { stack.push(ctm); if (args?.[0]) ctm = compose(ctm, args[0]); }
    else if (fn === OPS.paintFormXObjectEnd) ctm = stack.pop() || ctm;
    else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject || fn === OPS.paintImageMaskXObject) {
      const pts = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([x, y]) => applyM(ctm, x, y));
      const xs = pts.map(p => p[0]);
      const ys = pts.map(p => p[1]);
      // Only straight pictures (a turned one can't be covered and retyped)
      if (Math.abs(ctm[1]) > 1e-3 || Math.abs(ctm[2]) > 1e-3) return;
      out.push({ x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) });
    }
  });
  return out;
}

// A text-like item's box on screen, from where it sits in the PDF
function boxFor(pdf, view) {
  const { x, y, size, width, ascent, descent, angle = 0 } = pdf;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const at = (along, up) => applyM(view.transform, x + along * cos - up * sin, y + along * sin + up * cos);
  const tl = at(0, ascent * size);
  const tr = at(width, ascent * size);
  const bl = at(0, descent * size);
  const scale = Math.hypot(view.transform[0], view.transform[1]);
  return {
    left: (tl[0] / view.width) * 100,
    top: (tl[1] / view.height) * 100,
    width: (Math.hypot(tr[0] - tl[0], tr[1] - tl[1]) / view.width) * 100,
    height: (Math.hypot(bl[0] - tl[0], bl[1] - tl[1]) / view.height) * 100,
    turn: (Math.atan2(tr[1] - tl[1], tr[0] - tl[0]) * 180) / Math.PI,
    fontSize: ((size * scale) / view.width) * 100,
  };
}

// A picture's rectangle in % of the drawn page
function rectFor(r, view) {
  const a = applyM(view.transform, r.x0, r.y1);
  const b = applyM(view.transform, r.x1, r.y0);
  return {
    left: (Math.min(a[0], b[0]) / view.width) * 100,
    top: (Math.min(a[1], b[1]) / view.height) * 100,
    width: (Math.abs(b[0] - a[0]) / view.width) * 100,
    height: (Math.abs(b[1] - a[1]) / view.height) * 100,
  };
}

// The pictures that look like a line of text, as items
function pictureItems(pictures, texts, view, n) {
  const items = [];
  pictures.forEach((r, k) => {
    const w = r.x1 - r.x0;
    const h = r.y1 - r.y0;
    // A line of text: short and wide (not a photo, a logo block or a rule)
    if (h < 2 || h > 60 || w < 6 || w / h < 1.6) return;
    // Real text already there: nothing to read
    if (texts.some(t => t.pdf.x >= r.x0 && t.pdf.x <= r.x1 && t.pdf.y >= r.y0 && t.pdf.y <= r.y1)) return;
    // Until it's read: a box over the whole picture (baseline a fifth up)
    const pdf = { x: r.x0, y: r.y0 + h * 0.2, size: h * 0.8, width: w, ascent: 1, descent: -0.25, angle: 0 };
    const rect = rectFor(r, view);
    items.push({
      id: `${n}-p${k}`,
      page: n - 1,
      str: '',
      picture: { ...r, rect },
      view,
      pdf,
      box: { ...boxFor(pdf, view), sample: rect },
      fontKey: null,
      font: { base: 'Helvetica', bold: false, italic: false },
    });
  });
  return items;
}

let nextAdded = 1;

export default function PdfEditor({ active }) {
  const [doc, setDoc] = useState(null); // { id, name, bytes, pages: [{ key, num, url, items, width, height }] }
  const [edits, setEdits] = useState({}); // item id -> { text, bg, ink }
  // Undo / redo, one change at a time: the edits as they were before each
  // change (past) and the ones undone (future)
  const [history, setHistory] = useState({ past: [], future: [] });
  const changeEdits = (next) => {
    setHistory(h => ({ past: [...h.past, edits], future: [] }));
    setEdits(next);
  };
  const undo = () => {
    if (!history.past.length) return;
    setHistory(h => ({ past: h.past.slice(0, -1), future: [edits, ...h.future] }));
    setEdits(history.past[history.past.length - 1]);
  };
  const redo = () => {
    if (!history.future.length) return;
    setHistory(h => ({ past: [...h.past, edits], future: h.future.slice(1) }));
    setEdits(history.future[0]);
  };
  const resetEdits = () => {
    setEdits({});
    setHistory({ past: [], future: [] });
  };
  const [editing, setEditing] = useState(null); // item id
  const editingRef = useRef(null);
  editingRef.current = editing;
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
  // The document whose pages are popping out (another opened, or closed):
  // they keep showing its changes, in its fonts, until they're gone
  const leavingDoc = useRef(null);
  const editsRef = useRef({});
  const toast = useToast();

  const release = (d) => d?.pages.forEach(p => URL.revokeObjectURL(p.url));
  // Once a document's pages have popped out (they show their pictures until then)
  const releaseLater = (d) => setTimeout(() => release(d), MOTION_MS + 300);

  // The open document, kept for drawing pages sharper when zoomed in
  const viewRef = useRef(null);
  const dropView = () => {
    // Its fonts go once its pages have popped out (they show changed words
    // in them until then)
    const faces = viewRef.current?.faces || [];
    setTimeout(() => faces.forEach(f => document.fonts.delete(f)), MOTION_MS + 300);
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
      // Keeping each font's file and letters, to write new words in it
      view = await openPdf(bytes, undefined, { fontExtraProperties: true });
      const fonts = {};
      const pages = [];
      for (let n = 1; n <= view.numPages; n++) {
        const page = await view.getPage(n);
        const { canvas, viewport } = await renderPage(page, { cssWidth: PAGE_CSS_WIDTH });
        const url = URL.createObjectURL(await canvasToBlob(canvas, 'image/png'));
        const px = canvas.width;
        canvas.width = canvas.height = 0;
        const content = await page.getTextContent();
        const items = itemsOf(page, content, viewport, n, fonts);
        // Lines of text drawn as pictures (an email's header, say)
        // How the PDF's units land on the drawn page (for pictures, new text)
        const pageView = { transform: viewport.transform, width: viewport.width, height: viewport.height };
        try {
          const { OPS } = await loadPdfjs();
          items.push(...pictureItems(await picturesOf(page, OPS), items, pageView, n));
        } catch {
          // No pictures read: just the text
        }
        page.cleanup();
        pages.push({ num: n, url, px, items, view: pageView, width: viewport.width, height: viewport.height });
      }
      // A new document's pages pop in as the old one's pop out
      const id = nextDocId++;
      // Each of the PDF's own fonts, as a copy that takes real letters, for
      // typing, showing and saving new words in it
      const faces = [];
      await Promise.all(Object.values(fonts).map(async (info, k) => {
        const u = unicodeFontOf(info);
        if (!u || typeof FontFace !== 'function') return;
        try {
          const family = `pdf${id}-${k}`;
          const face = new FontFace(family, u.data);
          await face.load();
          document.fonts.add(face);
          faces.push(face);
          info.family = family;
        } catch {
          // Not a font the browser takes: the stand-in it is
        }
      }));
      pages.forEach(p => { p.key = `${id}-${p.num}`; });
      clearTimeout(holdTimer.current);
      setHold(0);
      resetZoom();
      // Kept open to draw the pages sharper when zoomed in
      dropView();
      viewRef.current = { id, view, faces };
      view = null;
      setDoc(prev => {
        if (prev) {
          leavingDoc.current = { fonts: prev.fonts, edits: editsRef.current };
          releaseLater(prev);
        }
        return { id, name: file.name, bytes, pages, fonts };
      });
      resetEdits();
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
  // A line's colours: as changed, as read sharp (a picture), or from the page
  const colorsFor = (item) => {
    const known = edits[item.id] || item.colors;
    if (known) return known;
    try {
      return sampleColors(imgRefs.current[`${doc.id}-${item.page + 1}`], item.box.sample || item.box);
    } catch {
      return { bg: [255, 255, 255], ink: [0, 0, 0] };
    }
  };
  const startEdit = (item) => {
    const edit = edits[item.id];
    const colors = colorsFor(item);
    cancelled.current = false;
    setDraftColors({ bg: colors.bg, ink: colors.ink });
    setDraft(edit?.text ?? item.str);
    setEditing(item.id);
    if (item.picture && !item.read) readPicture(item);
  };

  // A picture of text, tapped for the first time: its words are read and
  // put in the box (unless you've started typing), and the item takes their
  // size and line, so the new words sit where the old ones were
  // The picture as Tesseract reads it best: drawn fresh from the PDF so its
  // letters stand ~100px tall however small they are on the page (an
  // upscaled crop of the page on screen is a blur of a few pixels), with a
  // white margin around it. Falls back to the page on screen.
  const pictureCanvas = async (item) => {
    const r = item.picture.rect;
    const hUnits = item.picture.y1 - item.picture.y0;
    const wUnits = item.picture.x1 - item.picture.x0;
    const scale = Math.max(1, Math.min(16, 100 / hUnits, 6000 / wUnits));
    const make = (w, h) => {
      const pad = Math.round(h * 0.25);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(w) + 2 * pad);
      canvas.height = Math.max(1, Math.round(h) + 2 * pad);
      canvas.pad = pad;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return { canvas, ctx, pad };
    };
    const open = viewRef.current;
    if (open && open.id === doc.id) {
      try {
        const page = await open.view.getPage(item.page + 1);
        const viewport = page.getViewport({ scale, rotation: page.rotate });
        const left = (r.left / 100) * viewport.width;
        const top = (r.top / 100) * viewport.height;
        // Just the picture (its neighbours would read as more words), then
        // onto the white margin
        const crop = document.createElement('canvas');
        crop.width = Math.max(1, Math.round((r.width / 100) * viewport.width));
        crop.height = Math.max(1, Math.round((r.height / 100) * viewport.height));
        const cropCtx = crop.getContext('2d');
        cropCtx.fillStyle = '#ffffff';
        cropCtx.fillRect(0, 0, crop.width, crop.height);
        await page.render({ canvasContext: cropCtx, canvas: crop, viewport, transform: [1, 0, 0, 1, -left, -top] }).promise;
        const { canvas, ctx, pad } = make(crop.width, crop.height);
        ctx.drawImage(crop, pad, pad);
        crop.width = crop.height = 0;
        return canvas;
      } catch {
        // Drawn from the page on screen instead
      }
    }
    const img = imgRefs.current[`${doc.id}-${item.page + 1}`];
    if (!img?.naturalWidth) return null;
    const sw = (r.width / 100) * img.naturalWidth;
    const sh = (r.height / 100) * img.naturalHeight;
    const k = Math.max(1, Math.min(4, 100 / Math.max(1, sh)));
    const { canvas, ctx, pad } = make(sw * k, sh * k);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, (r.left / 100) * img.naturalWidth, (r.top / 100) * img.naturalHeight, sw, sh, pad, pad, canvas.width - 2 * pad, canvas.height - 2 * pad);
    return canvas;
  };

  const reading = useRef(new Map()); // picture id -> its read, under way
  const readPicture = (item, opts) => {
    if (!reading.current.has(item.id)) {
      const run = readPictureNow(item, opts).finally(() => reading.current.delete(item.id));
      reading.current.set(item.id, run);
    }
    return reading.current.get(item.id);
  };
  const readPictureNow = async (item, { quiet = false } = {}) => {
    const canvas = await pictureCanvas(item);
    if (!canvas) return;
    let found = null;
    try {
      found = await readLine(canvas);
    } catch (err) {
      if (!quiet) toast(err?.code === 'library' ? err.message : "couldn't read this picture — type the new words", { warn: true });
      return;
    }
    if (!found?.text) return;
    // Canvas pixels → the PDF's units
    const { x0, x1, y0, y1 } = item.picture;
    const { pad } = canvas;
    const toX = (px) => x0 + ((px - pad) / (canvas.width - 2 * pad)) * (x1 - x0);
    const toY = (py) => y1 - ((py - pad) / (canvas.height - 2 * pad)) * (y1 - y0);
    let pdf = item.pdf;
    if (Number.isFinite(found.baseline)) {
      const baseY = toY(found.baseline);
      const size = Math.max(2, (toY(found.top) - baseY) / 0.72); // tall letters stand ~0.72 of the size
      pdf = { x: toX(found.left), y: baseY, size, width: toX(found.right) - toX(found.left), ascent: 0.9, descent: -0.22, angle: 0 };
    }
    // Its colours, read sharp (small letters blur on the page on screen)
    const colors = colorsIn(canvas, pad, pad, canvas.width - 2 * pad, canvas.height - 2 * pad);
    const read = { ...item, read: true, str: found.text, colors, pdf, box: { ...boxFor(pdf, item.view), sample: item.picture.rect } };
    setDoc(prev => (!prev || prev.id !== doc.id ? prev : {
      ...prev,
      pages: prev.pages.map(p => (p.num !== item.page + 1 ? p : { ...p, items: p.items.map(q => (q.id === item.id ? read : q)) })),
    }));
    // Still being changed: its words and colours
    if (editingRef.current === item.id) {
      setDraft(d => (d === '' ? found.text : d));
      if (!editsRef.current[item.id]) setDraftColors(colors);
    }
    canvas.width = canvas.height = 0;
  };

  // The line being changed, saved; the box closes on blur (Enter, a tap
  // elsewhere), or moves on to the next line (Tab)
  const commit = (item) => {
    if (cancelled.current) { // Escape: the blur that follows doesn't save
      cancelled.current = false;
      return;
    }
    // Tab: already saved, and moved on to another line
    if (editingRef.current !== item.id) return;
    setEditing(null);
    finish(item);
  };
  const finish = (item) => {
    const text = draft;
    if (item.added && !text.trim() && !edits[item.id]) {
      dropAdded(item);
      return;
    }
    const colors = draftColors;
    const next = { ...edits };
    if (text === item.str) delete next[item.id];
    else next[item.id] = { text, bg: colors.bg, ink: colors.ink };
    // Only a real change is a step to undo
    if ((edits[item.id]?.text ?? null) === (next[item.id]?.text ?? null)) return;
    changeEdits(next);
  };

  const save = async (e) => {
    e.currentTarget.blur();
    if (!doc || busy) return;
    setBusy(true);
    try {
      const lib = await loadPdfLib();
      const { PDFDocument, StandardFonts, rgb, degrees, pushGraphicsState, popGraphicsState, setCharacterSqueeze } = lib;
      const pdf = await PDFDocument.load(doc.bytes);
      // Standard fonts, and the PDF's own fonts (written with fontkit), once each
      const fonts = new Map();
      const getFont = async (key) => {
        if (!fonts.has(key)) fonts.set(key, await pdf.embedFont(StandardFonts[key]));
        return fonts.get(key);
      };
      let fontkit = null;
      const originals = new Map();
      const getOriginal = async (key) => {
        if (!originals.has(key)) {
          let font = null;
          try {
            fontkit = fontkit || (await loadLibrary(() => import('@pdf-lib/fontkit'))).default;
            pdf.registerFontkit(fontkit);
            font = await pdf.embedFont(doc.fonts[key].unicode.data, { subset: false });
          } catch {
            font = null;
          }
          originals.set(key, font);
        }
        return originals.get(key);
      };
      const color = (c) => rgb(c[0] / 255, c[1] / 255, c[2] / 255);
      let lost = false;
      const all = doc.pages.flatMap(p => p.items);
      // The old words themselves come out of the page first (so copy, search
      // and what's drawn behind them are right); a line that can't come out
      // whole gets a patch over it instead
      const gone = new Set();
      doc.pages.forEach((p) => {
        const boxes = p.items.filter(item => edits[item.id] && !item.picture && !item.added).map(item => ({ id: item.id, ...item.pdf }));
        if (!boxes.length) return;
        try {
          removeText(lib, pdf.getPage(p.num - 1), boxes).forEach(id => gone.add(id));
        } catch {
          // Left in: patched over
        }
      });
      for (const item of all) {
        const edit = edits[item.id];
        if (!edit) continue;
        const page = pdf.getPage(item.page);
        const { x, y, size, width, ascent, descent, angle = 0 } = item.pdf;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const turn = degrees((angle * 180) / Math.PI);
        const at = (along) => ({ x: x + along * cos, y: y + along * sin });

        // Best: the PDF's own font (its real-letter copy), when it has every letter
        const info = doc.fonts?.[item.fontKey];
        let original = originalCanWrite(info, edit.text) ? await getOriginal(item.fontKey) : null;
        const kit = original?.embedder?.font;
        if (original && kit?.hasGlyphForCodePoint && [...edit.text].some(ch => ch !== ' ' && ch !== '\u00a0' && !kit.hasGlyphForCodePoint(ch.codePointAt(0)))) original = null;

        let runs = []; // [{ text, along }] to write, and how wide it all is
        let newWidth = 0;
        let font;
        let squeeze = 1;
        if (original) {
          // Word by word, in the font's own codes; the spaces are the PDF's own width
          font = original;
          const space = (info.spaceWidth || 0.278) * size;
          let word = '';
          const flush = () => {
            if (!word) return;
            runs.push({ text: word, along: newWidth });
            newWidth += original.widthOfTextAtSize(word, size);
            word = '';
          };
          for (const ch of edit.text) {
            if (ch === ' ' || ch === '\u00a0') { flush(); newWidth += space; } else word += ch;
          }
          flush();
        } else {
          // Else the closest standard font, squeezed to the original's room
          font = await getFont(standardFontKey(item.font));
          const safe = encodable(font, edit.text);
          lost = lost || safe.lost;
          squeeze = item.str ? squeezeFor(width, font.widthOfTextAtSize(item.str, size)) : 1;
          if (safe.text) runs = [{ text: safe.text, along: 0 }];
          newWidth = safe.text ? font.widthOfTextAtSize(safe.text, size) * squeeze : 0;
        }

        const pad = size * PAD;
        if (item.picture) {
          // A picture of text: covered whole (and as far as the new words reach)
          const { x0, y0, x1, y1 } = item.picture;
          page.drawRectangle({
            x: x0 - 0.5,
            y: y0 - 0.5,
            width: Math.max(x1, x + newWidth) - x0 + 1,
            height: y1 - y0 + 1,
            color: color(edit.bg),
            borderWidth: 0,
          });
        } else if (!gone.has(item.id) && !item.added) {
        // The patch's corner: back along the baseline and down from it, turned with the text
        const along = -pad;
        const up = descent * size - pad;
        page.drawRectangle({
          x: x + along * cos - up * sin,
          y: y + along * sin + up * cos,
          width: Math.max(width, newWidth) + pad * 2,
          height: (ascent - descent) * size + pad * 2,
          rotate: turn,
          color: color(edit.bg),
          borderWidth: 0,
        });
        }
        if (squeeze !== 1) page.pushOperators(pushGraphicsState(), setCharacterSqueeze(squeeze * 100));
        runs.forEach((r) => page.drawText(r.text, { ...at(r.along), size, font, color: color(edit.ink), rotate: turn }));
        if (squeeze !== 1) page.pushOperators(popGraphicsState());
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

  // How words are shown: in the PDF's own font when it has every letter,
  // else in the closest standard font
  // squeezed or stretched to take the original's room
  const lookOf = (item, text, typing = false, fonts = doc?.fonts) => {
    const stand = cssFont(item.font);
    const info = fonts?.[item.fontKey];
    // The PDF's own font (its real-letter copy): when it has every letter, or
    // while typing (any letter it lacks shows in the stand-in meanwhile)
    if (info?.family && (typing || originalCanWrite(info, text))) {
      return { css: { fontFamily: `"${info.family}", ${stand.fontFamily}`, fontWeight: 400, fontStyle: 'normal' }, text, squeeze: 1 };
    }
    return { css: stand, text, squeeze: squeezeFor(item.pdf.width / item.pdf.size, cssWidthEm(stand, item.str)) };
  };

  // Each changed line's baseline, measured where it's actually drawn, is
  // nudged onto the PDF's own (ascent below the top of its box). In ems, so
  // it holds at any zoom; again once fonts have loaded.
  const alignRuns = useCallback(() => {
    dropBox.current?.querySelectorAll('.pdf-run').forEach((run) => {
      const mark = run.lastElementChild;
      const box = run.parentElement;
      const px = parseFloat(getComputedStyle(box).fontSize);
      if (!mark || !(px > 0)) return;
      // Where the baseline sits from the box's top, in ems, before any
      // nudge. Straight text: measured exactly (to a fraction of a pixel)
      // from where it's drawn, less the nudge already on it; turned text:
      // its layout position (whole pixels). (Both rects carry the box's
      // lift, so it cancels out.)
      const before = parseFloat(run.dataset.nudge || 0);
      // (a page still popping in is drawn at less than full size: undone)
      const rect = box.getBoundingClientRect();
      const scale = box.offsetHeight ? rect.height / box.offsetHeight : 1;
      const baseline = run.dataset.turned
        ? mark.offsetTop / px
        : (mark.getBoundingClientRect().top - rect.top) / (scale || 1) / px - before;
      const nudge = parseFloat(run.dataset.asc) - parseFloat(run.dataset.lift || 0) - baseline;
      run.dataset.nudge = String(nudge);
      const squeeze = parseFloat(run.dataset.squeeze) || 1;
      const t = `translateY(${nudge.toFixed(4)}em)${squeeze !== 1 ? ` scaleX(${squeeze})` : ''}`;
      if (run.style.transform !== t) run.style.transform = t;
    });
  }, []);
  useLayoutEffect(() => { alignRuns(); });
  useEffect(() => {
    const again = () => alignRuns();
    document.fonts?.addEventListener?.('loadingdone', again);
    return () => document.fonts?.removeEventListener?.('loadingdone', again);
  }, [alignRuns]);

  // ── New text ──
  // Double-click an empty spot on a page (or tap one with "add text" on):
  // a new line starts there, in the size and font of the nearest text,
  // upright on screen. Left empty, it goes again.
  const [adding, setAdding] = useState(false);
  const addAt = (page, e) => {
    const view = page.view;
    if (!view || !doc) return;
    const r = e.currentTarget.getBoundingClientRect();
    const fx = ((e.clientX - r.left) / r.width) * view.width;
    const fy = ((e.clientY - r.top) / r.height) * view.height;
    const [a, b, c, d, e0, f0] = view.transform;
    const det = a * d - b * c;
    if (!det) return;
    const x = (d * (fx - e0) - c * (fy - f0)) / det;
    const y = (-b * (fx - e0) + a * (fy - f0)) / det;
    // Upright on screen: the page's own turn, undone
    const angle = Math.atan2(-b / det, d / det);
    const near = page.items
      .filter(item => !item.picture && !item.added)
      .map((item) => {
        // How far from the nearest point of its line (not just its start)
        const { x: lx, y: ly, width, angle: la = 0, size: ls } = item.pdf;
        const cos = Math.cos(la);
        const sin = Math.sin(la);
        const along = Math.max(0, Math.min(width, (x - lx) * cos + (y - ly) * sin));
        const up = (y - ly) * cos - (x - lx) * sin - ls * 0.35; // from the middle of its letters
        return { item, far: Math.hypot((x - lx) * cos + (y - ly) * sin - along, up) };
      })
      .sort((p, q) => p.far - q.far)[0]?.item;
    const size = near?.pdf.size ?? 12;
    // The tap marks the middle of the letters: the baseline a little below it
    const down = size * 0.35;
    const pdf = {
      x: x + down * Math.sin(angle),
      y: y - down * Math.cos(angle),
      size,
      width: 0,
      ascent: near?.pdf.ascent ?? 0.8,
      descent: near?.pdf.descent ?? -0.2,
      angle,
    };
    const item = {
      id: `${page.num}-new${nextAdded++}`,
      page: page.num - 1,
      str: '',
      added: true,
      view,
      pdf,
      box: boxFor(pdf, view),
      fontKey: near?.fontKey ?? null,
      font: near?.font ?? { base: 'Helvetica', bold: false, italic: false },
    };
    item.colors = { bg: colorsFor(item).bg, ink: near ? colorsFor(near).ink : [0, 0, 0] };
    setDoc(prev => (!prev || prev.id !== doc.id ? prev : {
      ...prev,
      pages: prev.pages.map(p => (p.num !== page.num ? p : { ...p, items: [...p.items, item] })),
    }));
    setAdding(false);
    startEdit(item);
  };
  // A new line left empty: gone again
  const dropAdded = (item) => {
    setDoc(prev => (!prev ? prev : {
      ...prev,
      pages: prev.pages.map(p => (p.num !== item.page + 1 ? p : { ...p, items: p.items.filter(q => q.id !== item.id) })),
    }));
  };

  // ── Find and replace ──
  // Every line holding the words (any case), as it reads now; replace all
  // is one change to undo. Open, it reads the pictures of text too, one by
  // one, so an email's header can be found.
  const [findOpen, setFindOpen] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const textOf = (item) => edits[item.id]?.text ?? item.str;
  const findKey = findOpen && doc ? findText.toLowerCase() : '';
  const matches = new Set();
  if (findKey.trim()) {
    doc.pages.forEach(p => p.items.forEach((item) => {
      if (textOf(item).toLowerCase().includes(findKey)) matches.add(item.id);
    }));
  }
  const replaceAll = () => {
    if (!matches.size) return;
    const re = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const next = { ...edits };
    doc.pages.forEach(p => p.items.forEach((item) => {
      if (!matches.has(item.id)) return;
      const text = textOf(item).replace(re, () => replaceText);
      const colors = colorsFor(item);
      if (text === item.str) delete next[item.id];
      else next[item.id] = { text, bg: colors.bg, ink: colors.ink };
    }));
    changeEdits(next);
  };
  const pictureIds = doc ? doc.pages.flatMap(p => p.items.filter(item => item.picture && !item.read).map(item => item.id)).join(',') : '';
  useEffect(() => {
    if (!findOpen || !pictureIds) return undefined;
    let stop = false;
    (async () => {
      for (const id of pictureIds.split(',')) {
        if (stop) return;
        const item = docRef.current?.pages.flatMap(p => p.items).find(q => q.id === id);
        if (item && !item.read) await readPicture(item, { quiet: true }).catch(() => {});
      }
    })();
    return () => { stop = true; };
    // Each picture once: read ones drop out of the list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [findOpen, pictureIds]);

  // Ctrl + Z / Ctrl + Shift + Z (or Y) undo and redo, Ctrl + F finds; not
  // while typing (the text box has its own undo)
  const keys = useRef({});
  keys.current = { undo, redo, open: () => setFindOpen(true), has: !!doc };
  useEffect(() => {
    if (!active) return undefined;
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || !keys.current.has) return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) keys.current.undo();
      else if ((k === 'z' && e.shiftKey) || k === 'y') keys.current.redo();
      else if (k === 'f') {
        keys.current.open();
        requestAnimationFrame(() => findRef.current?.focus());
      } else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);
  const findRef = useRef(null);

  editsRef.current = edits;
  const editCount = Object.keys(edits).length;
  const textCount = doc ? doc.pages.reduce((n, p) => n + p.items.filter(item => !item.added || edits[item.id]).length, 0) : 0;
  const close = () => {
    leavingDoc.current = doc ? { fonts: doc.fonts, edits } : null;
    dropView();
    releaseLater(doc);
    holdWhileLeaving();
    setDoc(null);
    resetEdits();
    setEditing(null);
  };

  return (
    <div className="tool">
      <p className="tool-desc">click any text in a PDF to change it</p>
      {/* The same box as PDF tools: a fixed size that scrolls inside (the
          page stays still); the pages pop in and out like PDF tools' cards */}
      <div
        ref={dropBox}
        className={`tool-box pdf-drop editor-drop ${doc ? 'has-pages' : ''} ${dragging ? 'dragging' : ''} ${adding && doc ? 'adding' : ''}`}
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
            renderItem={(p, { leaving }) => (
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
                <div
                  className="pdf-text-layer"
                  onClick={(e) => { if (adding && !leaving && e.target === e.currentTarget) addAt(p, e); }}
                  onDoubleClick={(e) => { if (!leaving && e.target === e.currentTarget) addAt(p, e); }}
                >
                  {p.items.map(item => {
                    // (a page on its way out shows its own document's changes)
                    const gone = leaving ? leavingDoc.current : null;
                    const edit = (gone ? gone.edits : edits)[item.id];
                    const typing = !gone && editing === item.id && draftColors;
                    // A new line with nothing in it (undone): not shown
                    if (item.added && !edit && !typing) return null;
                    const look = lookOf(item, typing ? draft : (edit ? edit.text : item.str), !!typing, gone ? gone.fonts : doc?.fonts);
                    // The box runs from the PDF font's ascent to its descent; the
                    // text sits with its baseline on the PDF's (ascent below the
                    // top), however the stand-in font is proportioned
                    // (the text line is exactly 1em tall, moved down by padding
                    // or up by a shift)
                    const { ascent, descent } = item.pdf;
                    const shift = ascent - baselineOf(look.css);
                    const padTop = Math.max(0, shift);
                    const padBottom = Math.max(0, ascent - descent - shift - 1);
                    const pos = {
                      left: `${item.box.left}%`,
                      top: `${item.box.top}%`,
                      minWidth: `${item.box.width}%`,
                      height: `${padTop + 1 + padBottom}em`,
                      paddingTop: `${padTop}em`,
                      paddingBottom: `${padBottom}em`,
                      '--fs': item.box.fontSize,
                      // Turned with the text (about its top-left corner)
                      // (the shift up goes along the text's own up, so after the turn)
                      // (and squeezed to the original's room, when it's a stand-in)
                      transform: `${item.box.turn ? `rotate(${item.box.turn}deg) ` : ''}translateY(${Math.min(0, shift)}em)${typing && look.squeeze !== 1 ? ` scaleX(${look.squeeze})` : ''}`,
                      ...look.css,
                    };
                    // A picture of text being changed: covered whole on screen too
                    const cover = item.picture && (typing || edit) ? (
                      <div
                        key={`${item.id}-cover`}
                        className="pdf-pic-cover"
                        style={{
                          left: `${item.picture.rect.left}%`,
                          top: `${item.picture.rect.top}%`,
                          width: `${item.picture.rect.width}%`,
                          height: `${item.picture.rect.height}%`,
                          background: rgbCss((typing ? draftColors : edit).bg),
                        }}
                      />
                    ) : null;
                    if (typing) {
                      const colors = draftColors;
                      return [cover, (
                        <input
                          key={item.id}
                          className="pdf-text-input"
                          style={{ ...pos, background: rgbCss(colors.bg), color: rgbCss(colors.ink), width: `${cssWidthEm(look.css, draft, { cache: false }) + 0.3}em` }}
                          value={draft}
                          autoFocus
                          onChange={(e) => setDraft(e.target.value)}
                          onBlur={() => commit(item)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') e.currentTarget.blur();
                            if (e.key === 'Tab') {
                              // On to the next line (Shift: the one before), saving this one
                              e.preventDefault();
                              const all = doc.pages.flatMap(pg => pg.items);
                              const next = all[all.findIndex(q => q.id === item.id) + (e.shiftKey ? -1 : 1)];
                              finish(item);
                              if (next) startEdit(next);
                              else setEditing(null);
                            }
                            if (e.key === 'Escape') {
                              cancelled.current = true;
                              setEditing(null);
                            }
                          }}
                          aria-label="Change text"
                          spellCheck={false}
                        />
                      )];
                    }
                    return [cover, (
                      <button
                        key={item.id}
                        className={`pdf-text-item ${edit ? 'edited' : ''} ${!gone && matches.has(item.id) ? 'match' : ''}`}
                        style={edit ? { ...pos, background: rgbCss(edit.bg), color: rgbCss(edit.ink) } : pos}
                        onClick={() => startEdit(item)}
                        title={edit ? `was: ${item.str || 'a picture of text'}` : item.picture ? 'Change the words in this picture' : 'Change this text'}
                      >
                        {edit ? (
                          // The words, squeezed to the original's room, and a mark on
                          // their baseline: measured once drawn, they're nudged so it
                          // lands exactly on the PDF's (whatever the font's proportions)
                          <span className="pdf-run" data-asc={ascent} data-lift={Math.min(0, shift)} data-squeeze={look.squeeze} data-turned={item.box.turn ? '1' : undefined}>
                            {look.text}<span className="pdf-base" />
                          </span>
                        ) : ''}
                      </button>
                    )];
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

      {/* Find and replace: opens like the image options (the panel open) */}
      <Collapse open={!!doc && findOpen} className="options-collapse">
        <div className="options-panel">
          <FlipRow className="field-grid">
            <label className="field">
              find
              <input
                ref={findRef}
                className="text-input find-input"
                value={findText}
                onChange={(e) => setFindText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') setFindOpen(false); }}
                spellCheck={false}
                aria-label="Find"
              />
            </label>
            <label className="field">
              with
              <input
                className="text-input find-input"
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') replaceAll(); if (e.key === 'Escape') setFindOpen(false); }}
                spellCheck={false}
                aria-label="Replace with"
              />
            </label>
            <span className="field">matches <Count value={matches.size} /></span>
            <button className="btn" onClick={(e) => { e.currentTarget.blur(); replaceAll(); }} disabled={!matches.size}>
              replace all
            </button>
          </FlipRow>
        </div>
      </Collapse>

      <FlipRow>
        <button className="btn btn-icon" onClick={(e) => { e.currentTarget.blur(); inputRef.current?.click(); }} title="Open a PDF" aria-label="Open a PDF">
          <FileUp size={14} />
        </button>
        <button className={`btn btn-primary ${done.save ? 'btn-done' : ''}`} onClick={save} disabled={!doc || !editCount || busy}>
          <Download size={14} /> save pdf
        </button>
        {/* One change at a time, back and forth */}
        <button className="btn btn-icon" onClick={(e) => { e.currentTarget.blur(); undo(); }} disabled={!doc || !history.past.length} title="Undo" aria-label="Undo">
          <Undo2 size={14} />
        </button>
        <button className="btn btn-icon" onClick={(e) => { e.currentTarget.blur(); redo(); }} disabled={!doc || !history.future.length} title="Redo" aria-label="Redo">
          <Redo2 size={14} />
        </button>
        <button
          className={`btn btn-icon ${adding && doc ? 'btn-on' : ''}`}
          onClick={(e) => { e.currentTarget.blur(); setAdding(a => !a); }}
          disabled={!doc}
          title="Add text: tap a spot on a page (or double-click one)"
          aria-label="Add text"
          aria-pressed={adding && !!doc}
        >
          <Type size={14} />
        </button>
        <button
          className={`btn btn-icon ${findOpen && doc ? 'btn-on' : ''}`}
          onClick={(e) => {
            e.currentTarget.blur();
            const open = !findOpen;
            setFindOpen(open);
            if (open) requestAnimationFrame(() => findRef.current?.focus({ preventScroll: true }));
          }}
          disabled={!doc}
          title="Find and replace (Ctrl + F)"
          aria-label="Find and replace"
          aria-pressed={findOpen && !!doc}
        >
          <Replace size={14} />
        </button>
        <button className="btn" onClick={(e) => { e.currentTarget.blur(); close(); }} disabled={!doc}>
          close
        </button>
      </FlipRow>
    </div>
  );
}
