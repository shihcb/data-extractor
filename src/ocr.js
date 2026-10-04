// Reading words from a picture of text (Tesseract, run in the browser).
//
// Some PDFs show text as pictures: Apple Mail prints an email's header
// (From, Subject, Date, To) that way, so there's no text there to change.
// The PDF editor reads those pictures so they can be changed like text.
// Everything Tesseract needs is served by the app from /ocr/ (see
// vite.config.js) and only fetched the first time a picture is read.

import { loadLibrary } from './utils';

const BASE = `${import.meta.env.BASE_URL}ocr/`;

let workerPromise = null;
function ocrWorker() {
  if (!workerPromise) {
    workerPromise = loadLibrary(() => import('tesseract.js'))
      .then(async ({ createWorker }) => {
        const worker = await createWorker('eng', 1, {
          workerPath: `${BASE}worker.min.js`,
          corePath: BASE,
          langPath: BASE,
          gzip: true,
          workerBlobURL: false,
        });
        // One line of text per picture
        await worker.setParameters({ tessedit_pageseg_mode: '7', preserve_interword_spaces: '1' });
        return worker;
      })
      .catch((err) => {
        workerPromise = null;
        throw err;
      });
  }
  return workerPromise;
}

// Reads the line of text in `canvas`. Returns its words and where they sit,
// in the canvas's pixels: the baseline's height, where the text starts and
// ends, and how tall its letters stand above the baseline — or null.
export async function readLine(canvas) {
  const worker = await ocrWorker();
  const { data } = await worker.recognize(canvas, {}, { text: true, blocks: true });
  const lines = (data.blocks || []).flatMap(b => b.paragraphs.flatMap(p => p.lines));
  const line = lines.find(l => l.text.trim()) || null;
  // Specks at the ends read as lone marks or letters ("~ From:", "h From:"):
  // short words Tesseract isn't sure of are dropped from either end
  const words = line ? line.words.map(w => ({ text: w.text.trim(), sure: w.confidence, bbox: w.bbox })).filter(w => w.text) : [];
  const speck = (w) => w.text.length <= 2 && (w.sure < 60 || !/[\p{L}\p{N}]/u.test(w.text));
  while (words.length > 1 && speck(words[0])) words.shift();
  while (words.length > 1 && speck(words[words.length - 1])) words.pop();
  const text = line ? words.map(w => w.text).join(' ') : (data.text || '').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  if (!line) return { text };
  const { bbox, baseline } = line;
  const base = baseline && Number.isFinite(baseline.y0) ? (baseline.y0 + baseline.y1) / 2 : bbox.y1;
  return {
    text,
    baseline: base,
    left: words.length ? words[0].bbox.x0 : bbox.x0,
    right: words.length ? words[words.length - 1].bbox.x1 : bbox.x1,
    top: bbox.y0,
  };
}
