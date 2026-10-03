import { useCallback, useEffect, useRef, useState } from 'react';

// Copies text; falls back to a hidden textarea where the async clipboard
// API isn't allowed (older Safari, non-secure origins).
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

// Copies an image. Browsers only take PNG on the clipboard, so anything
// else is redrawn as PNG first. Safari needs the ClipboardItem to be made
// synchronously inside the click, holding a promise for the data.
export async function copyImageBlob(blobOrPromise) {
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') return false;
  const asPng = Promise.resolve(blobOrPromise).then(async (blob) => {
    if (blob.type === 'image/png') return blob;
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext('2d').drawImage(bitmap, 0, 0);
    bitmap.close?.();
    return canvasToBlob(canvas, 'image/png');
  });
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': asPng })]);
    return true;
  } catch {
    return false;
  }
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Long enough for slow devices to start the download
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export const canvasToBlob = (canvas, mime, quality) =>
  new Promise((resolve, reject) => {
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('could not encode image'))), mime, quality);
  });

export function formatBytes(n) {
  if (!Number.isFinite(n)) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export const baseName = (name) => (name || 'file').replace(/\.[^./\\]+$/, '') || 'file';

export const isPdfFile = (f) =>
  !!f && (f.type === 'application/pdf' || /\.pdf$/i.test(f.name || ''));

export const isImageFile = (f) => !!f && f.type.startsWith('image/');

// Unique names inside a zip ("page.png", "page (2).png", …)
export function uniqueNamer() {
  const used = new Map();
  return (name) => {
    const n = used.get(name) || 0;
    used.set(name, n + 1);
    if (!n) return name;
    const dot = name.lastIndexOf('.');
    return dot > 0 ? `${name.slice(0, dot)} (${n + 1})${name.slice(dot)}` : `${name} (${n + 1})`;
  };
}

// A short-lived "done" flag per key (the green flash on a button)
export function useDoneFlags(ms = 1800) {
  const [flags, setFlags] = useState({});
  const timers = useRef({});
  const flag = useCallback((key) => {
    clearTimeout(timers.current[key]);
    setFlags(f => ({ ...f, [key]: true }));
    timers.current[key] = setTimeout(() => setFlags(f => ({ ...f, [key]: false })), ms);
  }, [ms]);
  useEffect(() => {
    const t = timers.current;
    return () => Object.values(t).forEach(clearTimeout);
  }, []);
  return [flags, flag];
}

// Window-wide paste / drop of files while a tab is open
export function usePastedFiles(active, accept, onFiles) {
  const handler = useRef(onFiles);
  handler.current = onFiles;
  useEffect(() => {
    if (!active) return;
    const onPaste = (e) => {
      const files = [...(e.clipboardData?.files || [])].filter(accept);
      if (!files.length) return;
      e.preventDefault();
      handler.current(files);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [active, accept]);
}

// A file this page needs (a library loaded on first use) is gone: the app
// was updated since the page opened, and each update renames those files.
// Reload once to pick up the new version (not again within half a minute,
// so a real network problem can't loop). True when it's reloading.
export function reloadForUpdate() {
  try {
    const last = Number(sessionStorage.getItem('reloaded-for-update')) || 0;
    if (Date.now() - last < 30000) return false;
    sessionStorage.setItem('reloaded-for-update', String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

// Loads a library on first use; if its file is missing because the app was
// updated, the page reloads (and this never settles) instead of failing
export function loadLibrary(load) {
  return load().catch((err) => {
    if (reloadForUpdate()) return new Promise(() => {});
    const e = new Error("couldn't load this tool — check your connection");
    e.code = 'library';
    e.cause = err;
    throw e;
  });
}
