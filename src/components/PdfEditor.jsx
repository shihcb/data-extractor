import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Download, FileUp, Undo2 } from 'lucide-react';
import { closePdf, loadPdfLib, openPdf, renderPage, isPasswordError } from '../pdf';
import { baseName, canvasToBlob, downloadBlob, isPdfFile, useDoneFlags, usePastedFiles } from '../utils';
import { MOTION_MS } from '../motion';
import { useToast } from '../toastContext';
import Count from './Count';
import AutoHeight from './AutoHeight';
import FadeText from './FadeText';
import FlipRow from './FlipRow';
import MotionList from './MotionList';

// Changing text in a PDF the reliable way (what browser PDF editors do):
// the old words are covered with a patch the colour of the paper behind
// them, and the new words are written on top in a standard font close to
// the original, at the same spot and size. Everything else is untouched.

const PAGE_CSS_WIDTH = 820;
const PAD = 0.12; // patch margin, as a share of the font size

const plural = (n, word) => (n === 1 ? word : `${word}s`);

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
  const [hold, setHold] = useState(0);
  const holdTimer = useRef(null);
  const holdWhileLeaving = () => {
    const inner = dropBox.current?.firstElementChild;
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
        canvas.width = canvas.height = 0;
        const content = await page.getTextContent();
        const items = [];
        content.items.forEach((item, i) => {
          if (!item.str || !item.str.trim()) return;
          const [a, b, c, d, e, f] = item.transform;
          // Only straight, left-to-right text on unrotated pages can be retyped in place
          if (page.rotate || Math.abs(b) > 1e-3 || Math.abs(c) > 1e-3 || a <= 0 || d <= 0 || item.dir === 'ttb') return;
          const style = content.styles[item.fontName] || {};
          const size = d;
          const ascent = style.ascent || 0.8;
          const descent = style.descent || -0.2;
          const width = item.width || size * item.str.length * 0.5;
          const [x1, y1] = viewport.convertToViewportPoint(e, f + ascent * size);
          const [x2, y2] = viewport.convertToViewportPoint(e + width, f + descent * size);
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
            pdf: { x: e, y: f, size, width, ascent, descent },
            // In % of the drawn page, for showing
            box: {
              left: (Math.min(x1, x2) / viewport.width) * 100,
              top: (Math.min(y1, y2) / viewport.height) * 100,
              width: (Math.abs(x2 - x1) / viewport.width) * 100,
              height: (Math.abs(y2 - y1) / viewport.height) * 100,
              fontSize: ((size * viewport.scale) / viewport.width) * 100, // in cqw
            },
            font: pickFont(realName, style.fontFamily),
          });
        });
        page.cleanup();
        pages.push({ num: n, url, items, width: viewport.width, height: viewport.height });
      }
      // A new document's pages pop in as the old one's pop out
      const id = nextDocId++;
      pages.forEach(p => { p.key = `${id}-${p.num}`; });
      clearTimeout(holdTimer.current);
      setHold(0);
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

  useEffect(() => () => release(docRef.current), []);

  const cancelled = useRef(false);
  const startEdit = (item) => {
    const edit = edits[item.id];
    let colors = edit;
    if (!colors) {
      try {
        colors = sampleColors(imgRefs.current[`${doc.id}-${item.page + 1}`], item.box);
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
      const { PDFDocument, StandardFonts, rgb } = await loadPdfLib();
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
        const { x, y, size, width, ascent, descent } = item.pdf;
        const newWidth = safe.text ? font.widthOfTextAtSize(safe.text, size) : 0;
        const pad = size * PAD;
        page.drawRectangle({
          x: x - pad,
          y: y + descent * size - pad,
          width: Math.max(width, newWidth) + pad * 2,
          height: (ascent - descent) * size + pad * 2,
          color: color(edit.bg),
          borderWidth: 0,
        });
        if (safe.text) page.drawText(safe.text, { x, y, size, font, color: color(edit.ink) });
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
  const close = () => {
    releaseLater(doc);
    holdWhileLeaving();
    setDoc(null);
    setEdits({});
    setEditing(null);
  };

  return (
    <div className="tool">
      {/* The same box as PDF tools: a fixed size that scrolls inside (the
          page stays still); the pages pop in and out like PDF tools' cards */}
      <div
        ref={dropBox}
        className={`tool-box pdf-drop editor-drop ${doc ? 'has-pages' : ''} ${dragging ? 'dragging' : ''}`}
        // Empty: anywhere opens the picker; with a PDF, only the space around it
        onClick={(e) => { if (!doc || e.target === e.currentTarget || e.target.classList.contains('pdf-drop-inner')) inputRef.current?.click(); }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false); }}
        onDrop={(e) => { e.preventDefault(); setDragging(false); openFile(e.dataTransfer?.files || []); }}
        aria-label="Open a PDF"
      >
        <div
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
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onChange={(e) => { openFile(e.target.files || []); e.target.value = ''; }}
      />

      <AutoHeight className="tool-meta" aria-live="polite">
        <FadeText k={doc ? 'doc' : 'empty'}>
        {doc ? (
          <>
            <Count value={doc.pages.length} /> {plural(doc.pages.length, 'page')} · <Count value={editCount} /> {plural(editCount, 'change')} · click any text to change it
          </>
        ) : 'click any text in a PDF to change it'}
      </FadeText>
      </AutoHeight>

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
