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
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('could not open image'));
    img.src = url;
  });
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
