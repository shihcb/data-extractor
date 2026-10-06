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

// ── Saving ─────────────────────────────────────────────────────
// Every save button: the share sheet (Save to Files, AirDrop, any app),
// every file as itself — never a zip — or, where a browser can't share
// files, each one downloaded. `files`: [{ blob, name }].
//
// A browser lets a page open the share sheet only just after a tap; a save
// that took a while (several images converted, a PDF built) has missed
// that moment, so the files wait in a small "ready to save" pop-up and one
// more tap opens the sheet (App.jsx listens for "toolbox:save-ready").
// Resolves 'shared', 'downloaded' or 'cancelled'.
const fileOf = ({ blob, name }) => (blob instanceof File && blob.name === name
  ? blob
  : new File([blob], name, { type: blob.type || 'application/octet-stream' }));

export function shareFiles(files) {
  return navigator.share({ files }).then(() => 'shared', (err) => {
    if (err?.name === 'AbortError') return 'cancelled';
    throw err;
  });
}

export async function saveFiles(entries) {
  const files = entries.map(fileOf);
  if (!files.length) return 'cancelled';
  let canShare = false;
  try { canShare = !!navigator.canShare?.({ files }); } catch { canShare = false; }
  if (canShare) {
    // The tap's moment already gone: ask for one more tap
    if (navigator.userActivation && !navigator.userActivation.isActive) return askToSave(files);
    try {
      return await shareFiles(files);
    } catch (err) {
      if (err?.name === 'NotAllowedError') return askToSave(files);
      // (anything else: downloaded instead)
    }
  }
  for (let i = 0; i < files.length; i++) {
    if (i) await new Promise(r => setTimeout(r, 250)); // (one after another: browsers drop a burst)
    downloadBlob(files[i], files[i].name);
  }
  return 'downloaded';
}

function askToSave(files) {
  return new Promise((resolve) => {
    window.dispatchEvent(new CustomEvent('toolbox:save-ready', { detail: { files, resolve } }));
  });
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

// A file name short enough for a toast, cut in the middle so its ending
// (and the reason after it) still shows
export function shortName(name, max = 28) {
  if (!name || name.length <= max) return name;
  const tail = Math.ceil((max - 1) * 0.4);
  return `${name.slice(0, max - 1 - tail)}…${name.slice(-tail)}`;
}

// A card removed from the keyboard: focus goes on to the next card's same
// button (or the one before; with none left, the tool's first button), not
// left on the leaving copy and then dropped to the top of the page
export function keepFocusAfterRemove(btn) {
  if (!btn) return;
  const list = btn.closest('.motion-list') || btn.closest('.tool');
  const title = btn.getAttribute('title');
  const all = [...(list?.querySelectorAll(`button[title="${title}"]`) || [])].filter(b => !b.closest('[aria-hidden="true"]'));
  const i = all.indexOf(btn);
  const next = all[i + 1] || all[i - 1];
  const tool = btn.closest('.tool');
  requestAnimationFrame(() => {
    const to = next?.isConnected && !next.closest('[aria-hidden="true"]') ? next : tool?.querySelector('.btn:not(:disabled)');
    to?.focus({ preventScroll: true });
  });
}

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
  // Every name given out so far: "x (2).png" made for a second "x.png" is
  // taken, so a real "x (2).png" after it becomes "x (3).png" (it used to
  // get the same name, and one file overwrote the other in the zip)
  const given = new Set();
  return (name) => {
    let candidate = name;
    const dot = name.lastIndexOf('.');
    for (let n = 2; given.has(candidate.toLowerCase()); n++) {
      candidate = dot > 0 ? `${name.slice(0, dot)} (${n})${name.slice(dot)}` : `${name} (${n})`;
    }
    given.add(candidate.toLowerCase());
    return candidate;
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

// Is the file a failed import asked for really gone (the app was updated
// and renamed it), not just out of reach (offline, a dropped connection)?
// (Safari's error doesn't say which file: then, is the app's start page now
// loading a different main script than this page did?)
async function fileIsGone(err) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  try {
    const url = String(err?.message || '').match(/https?:\/\/\S+?\.m?js/)?.[0];
    if (url) {
      const res = await fetch(url, { method: 'HEAD', cache: 'no-store' });
      return res.status === 404 || (res.ok && (res.headers.get('content-type') || '').includes('text/html'));
    }
    const mine = document.querySelector('script[type="module"][src]')?.getAttribute('src');
    if (!mine) return false;
    const page = await fetch(import.meta.env?.BASE_URL || '/', { cache: 'no-store' });
    if (!page.ok) return false;
    return !(await page.text()).includes(mine);
  } catch {
    return false; // can't reach it: a connection problem, not an update
  }
}

// Loads a library on first use. If its file is gone because the app was
// updated, the page reloads (and this never settles) — unless `reload` is
// false (while saving: a reload would throw away the work being saved).
// Anything else (offline, a flaky connection) fails with a message, and
// the page stays as it is.
// Tabs holding work (anything their bottom bar would act on: pages, images,
// text): an update's reload would throw it all away, so then it isn't done
export const workHeld = new Set();

export function loadLibrary(load, { reload = true } = {}) {
  return load().catch(async (err) => {
    const gone = await fileIsGone(err);
    if (gone && reload && !workHeld.size && reloadForUpdate()) return new Promise(() => {});
    if (gone) {
      const e = new Error('the app was updated — reload the page to use this (save your work first)');
      e.code = 'library';
      e.cause = err;
      throw e;
    }
    const e = new Error("couldn't load this tool — check your connection");
    e.code = 'library';
    e.cause = err;
    throw e;
  });
}
