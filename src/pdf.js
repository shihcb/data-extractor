// PDF libraries, loaded only when a PDF feature is first used (they're
// large). pdf.js reads and draws PDFs; pdf-lib writes them.
//
// pdf.js's legacy build: the modern one needs very recent browsers
// (older iPhones fail). Its fonts, character maps and image decoders are
// copied to /pdfjs/ by the build (see vite.config.js).

import { loadLibrary } from './utils';

let pdfjsPromise = null;
export function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = loadLibrary(() => Promise.all([
      import('pdfjs-dist/legacy/build/pdf.min.mjs'),
      import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
    ])).then(([pdfjs, worker]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjs;
    }).catch((err) => {
      pdfjsPromise = null; // let a later try load it again (e.g. back online)
      throw err;
    });
  }
  return pdfjsPromise;
}

let pdfLibPromise = null;
export function loadPdfLib() {
  if (!pdfLibPromise) {
    pdfLibPromise = loadLibrary(() => import('pdf-lib')).catch((err) => {
      pdfLibPromise = null;
      throw err;
    });
  }
  return pdfLibPromise;
}

const ASSET_BASE = `${import.meta.env.BASE_URL}pdfjs/`;

// Opens a PDF for reading/drawing. `data` is an ArrayBuffer; pdf.js takes
// ownership of what it's given, so it gets its own copy.
// `options`: more pdf.js options (the editor keeps fonts' details).
export async function openPdf(data, password, options = {}) {
  const pdfjs = await loadPdfjs();
  const task = pdfjs.getDocument({
    ...options,
    data: new Uint8Array(data.slice(0)),
    password,
    cMapUrl: `${ASSET_BASE}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${ASSET_BASE}standard_fonts/`,
    wasmUrl: `${ASSET_BASE}wasm/`,
  });
  return task.promise;
}

// Draws one page into a new canvas, `cssWidth` wide (at the screen's
// pixel density, capped so huge pages don't run out of memory).
export async function renderPage(page, { cssWidth, scale: fixedScale, rotation = 0, maxPixels = 8e6 } = {}) {
  const base = page.getViewport({ scale: 1, rotation: (page.rotate + rotation) % 360 });
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let scale = fixedScale ?? (cssWidth / base.width) * dpr;
  if (base.width * base.height * scale * scale > maxPixels) {
    scale = Math.sqrt(maxPixels / (base.width * base.height));
  }
  const viewport = page.getViewport({ scale, rotation: (page.rotate + rotation) % 360 });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const ctx = canvas.getContext('2d');
  // White behind the page: PDFs are drawn on paper, transparent otherwise
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, canvas, viewport }).promise;
  return { canvas, viewport, scale };
}

export const isPasswordError = (err) => err && (err.name === 'PasswordException' || /password/i.test(err.message || ''));

// Lets go of a document opened with openPdf (pdf.js 6 closes it through
// its loading task; older versions had destroy() on the document).
export function closePdf(doc) {
  if (!doc) return;
  try {
    if (doc.loadingTask?.destroy) doc.loadingTask.destroy();
    else doc.destroy?.();
  } catch {
    // already closed
  }
}

// Why a PDF the editing library refused can't be used: one it can only
// refuse for being encrypted may just be locked against changes (opens
// without a password — bank statements often are), or need a password
export async function whyRefused(bytes, err) {
  if (!/encrypt/i.test(err?.message || '')) return 'broken';
  try {
    closePdf(await openPdf(bytes));
    return 'locked';
  } catch (e) {
    return isPasswordError(e) ? 'password' : 'broken';
  }
}

// What a toast says about a file that couldn't be opened
export const refusedWords = (why) => (why === 'locked'
  ? "is locked against changes, so it can't be changed here"
  : why === 'password' ? 'is password-protected' : "isn't a PDF this can open");
