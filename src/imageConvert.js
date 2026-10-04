import { canvasToBlob } from './utils';
import { loadPdfLib } from './pdf';

export const IMAGE_FORMATS = [
  { key: 'png',  label: 'PNG',  mime: 'image/png',  lossy: false },
  { key: 'jpg',  label: 'JPG',  mime: 'image/jpeg', lossy: true },
  { key: 'webp', label: 'WEBP', mime: 'image/webp', lossy: true },
  { key: 'pdf',  label: 'PDF',  mime: 'image/jpeg', lossy: true }, // pages hold JPEGs
];

const EXT_FOR_MIME = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

// Biggest canvas every browser can make (iOS Safari: 16.7M pixels, and
// 16384px a side elsewhere).
const MAX_PIXELS = 16777216;
const MAX_SIDE = 16384;

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    // Decoded off the main thread before it's used, so drawing it later
    // (preview, slide-in) doesn't stall a frame
    img.onload = () => (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(() => resolve(img));
    img.onerror = () => reject(new Error('could not open image'));
    img.src = url;
  });
}

// A small copy for the file row (80px, sharp on 2x screens): drawing the
// full image at 40px on every frame of the row's slide made it stutter
export async function makeThumb(img) {
  const s = Math.min(1, 320 / Math.max(img.naturalWidth, img.naturalHeight)); // a card's picture, sharp at 2×
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * s));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * s));
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await canvasToBlob(canvas, 'image/png');
  return URL.createObjectURL(blob);
}

// The output size for an image of w × h with the resize settings.
// { mode: 'percent', percent } or { mode: 'width', width }.
export function targetSize(w, h, { mode, percent, width }) {
  let scale = 1;
  if (mode === 'width' && Number.isFinite(width) && width > 0) scale = width / w;
  else if (mode === 'percent' && Number.isFinite(percent) && percent > 0) scale = percent / 100;
  let tw = Math.max(1, Math.round(w * scale));
  let th = Math.max(1, Math.round(h * scale));
  let clamped = false;
  const fit = Math.min(1, MAX_SIDE / tw, MAX_SIDE / th, Math.sqrt(MAX_PIXELS / (tw * th)));
  if (fit < 1) {
    tw = Math.max(1, Math.floor(tw * fit));
    th = Math.max(1, Math.floor(th * fit));
    clamped = true;
  }
  return { width: tw, height: th, clamped };
}

// Draws the image at the target size. JPG (and PDF pages) have no
// transparency, so those get white behind them instead of black.
export function drawImage(img, size, { opaque }) {
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('image too large for this device');
  if (opaque) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size.width, size.height);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, size.width, size.height);
  return canvas;
}

// Converts one image. Returns the encoded blob, its real extension (a
// browser that can't make WEBP hands back PNG — the name follows what it
// actually is) and the output size.
export async function encodeImage(img, { format, resize, quality }) {
  const fmt = IMAGE_FORMATS.find(f => f.key === format) || IMAGE_FORMATS[0];
  const size = targetSize(img.naturalWidth, img.naturalHeight, resize);
  const canvas = drawImage(img, size, { opaque: fmt.mime === 'image/jpeg' });
  const blob = await canvasToBlob(canvas, fmt.mime, fmt.lossy ? quality / 100 : undefined);
  canvas.width = canvas.height = 0; // free the memory now (Safari keeps it otherwise)
  return {
    blob,
    ext: EXT_FOR_MIME[blob.type] || fmt.key,
    fellBack: blob.type !== fmt.mime,
    ...size,
  };
}

// One PDF with a page per image (each page the image's size at 96 dpi).
export async function jpegsToPdf(pages) {
  const { PDFDocument } = await loadPdfLib();
  const doc = await PDFDocument.create();
  for (const { blob, width, height } of pages) {
    const image = await doc.embedJpg(new Uint8Array(await blob.arrayBuffer()));
    const w = width * 0.75;
    const h = height * 0.75;
    const page = doc.addPage([w, h]);
    page.drawImage(image, { x: 0, y: 0, width: w, height: h });
  }
  const bytes = await doc.save();
  return new Blob([bytes], { type: 'application/pdf' });
}

// What an image comes out as with these settings, worked out off the page's
// thread where the browser can (a worker with OffscreenCanvas; the image is
// decoded in the background too), else on it.
let worker = null;
let nextJob = 1;
const jobs = new Map();
function getWorker() {
  if (worker !== null) return worker;
  try {
    if (typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap !== 'function') throw new Error('no');
    worker = new Worker(new URL('./estimateWorker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const job = jobs.get(e.data.id);
      if (!job) return;
      jobs.delete(e.data.id);
      if (e.data.error) job.reject(new Error(e.data.error));
      else job.resolve(e.data);
    };
    worker.onerror = () => {
      jobs.forEach(j => j.reject(new Error('worker failed')));
      jobs.clear();
      worker.terminate();
      worker = false; // don't try again: the page's thread does it from now on
    };
  } catch {
    worker = false;
  }
  return worker;
}

export async function estimateImage(item, { format, resize, quality }) {
  const w = getWorker();
  const fmt = IMAGE_FORMATS.find(f => f.key === format) || IMAGE_FORMATS[0];
  if (!w) {
    const out = await encodeImage(item.img, { format, resize, quality });
    return { width: out.width, height: out.height, size: out.blob.size, ext: out.ext, fellBack: out.fellBack, clamped: out.clamped };
  }
  const size = targetSize(item.img.naturalWidth, item.img.naturalHeight, resize);
  // The photo is decoded once per image and kept; each estimate sends the
  // worker a quick copy of it (decoding a 24-megapixel photo again on every
  // settings change was heavy work for a phone)
  // (a file the browser can't decode that way, an SVG say: from the image
  // already drawn on the page instead; if that fails too, on the page's thread)
  if (!item._bitmap) item._bitmap = createImageBitmap(item.file).catch(() => createImageBitmap(item.img));
  let bitmap;
  try {
    bitmap = await createImageBitmap(await item._bitmap);
  } catch {
    item._bitmap = null;
    const out = await encodeImage(item.img, { format, resize, quality });
    return { width: out.width, height: out.height, size: out.blob.size, ext: out.ext, fellBack: out.fellBack, clamped: out.clamped };
  }
  const id = nextJob++;
  const res = await new Promise((resolve, reject) => {
    jobs.set(id, { resolve, reject });
    w.postMessage({
      id, bitmap, width: size.width, height: size.height, mime: fmt.mime,
      quality: fmt.lossy ? quality / 100 : undefined, opaque: fmt.mime === 'image/jpeg',
    }, [bitmap]);
  });
  return {
    width: size.width, height: size.height, size: res.size, clamped: size.clamped,
    ext: EXT_FOR_MIME[res.type] || fmt.key, fellBack: res.type !== fmt.mime,
  };
}
