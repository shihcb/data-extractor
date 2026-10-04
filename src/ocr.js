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
  const text = (line ? line.text : data.text || '').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  if (!line) return { text };
  const { bbox, baseline } = line;
  const base = baseline && Number.isFinite(baseline.y0) ? (baseline.y0 + baseline.y1) / 2 : bbox.y1;
  return {
    text,
    baseline: base,
    left: bbox.x0,
    right: bbox.x1,
    top: bbox.y0,
  };
}
