// Formatter tab transforms. Each takes text and returns text, or throws an
// Error with a message worth showing.

export function jsonPretty(text) {
  return JSON.stringify(parseJson(text), null, 2);
}

export function jsonMinify(text) {
  return JSON.stringify(parseJson(text));
}

export function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`not valid JSON: ${jsonErrorWhere(text, err)}`);
  }
}

// "line 3, column 7" from the position in the browser's message
function jsonErrorWhere(text, err) {
  const msg = String(err?.message || '');
  const lc = /line (\d+) column (\d+)/i.exec(msg);
  if (lc) return `line ${lc[1]}, column ${lc[2]}`;
  const pos = /position (\d+)/i.exec(msg);
  if (pos) {
    const before = text.slice(0, Number(pos[1]));
    const line = before.split('\n').length;
    const col = before.length - before.lastIndexOf('\n');
    return `line ${line}, column ${col}`;
  }
  return msg.replace(/^JSON\.parse:\s*/i, '') || 'check the text';
}

export const urlEncode = (text) => encodeURIComponent(text);

export function urlDecode(text) {
  try {
    return decodeURIComponent(text);
  } catch {
    throw new Error('not valid URL encoding (a stray % somewhere?)');
  }
}

// Base64 of the text as UTF-8 (so emoji and accents survive)
export function base64Encode(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

// Takes standard or URL-safe Base64, with or without padding or line breaks
export function base64Decode(text) {
  let s = text.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  if (!/^[A-Za-z0-9+/]*=*$/.test(s) || s.replace(/=+$/, '').length % 4 === 1) {
    throw new Error('not valid Base64');
  }
  s = s.replace(/=+$/, '');
  s += '='.repeat((4 - (s.length % 4)) % 4);
  let bin;
  try {
    bin = atob(s);
  } catch {
    throw new Error('not valid Base64');
  }
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error("that Base64 isn't text (it's a file or binary data)");
  }
}

export const FORMATTERS = [
  { key: 'pretty', label: 'JSON pretty', fn: jsonPretty },
  { key: 'minify', label: 'JSON minify', fn: jsonMinify },
  { key: 'urlenc', label: 'URL encode', fn: urlEncode },
  { key: 'urldec', label: 'URL decode', fn: urlDecode },
  { key: 'b64enc', label: 'Base64 encode', fn: base64Encode },
  { key: 'b64dec', label: 'Base64 decode', fn: base64Decode },
];

// What the text looks like (shown under the box)
export function detectKind(text) {
  const t = text.trim();
  if (!t) return '';
  if (t.length < 2_000_000 && /^[[{"]|^(true|false|null|-?\d)/.test(t)) {
    try {
      JSON.parse(t);
      return 'valid JSON';
    } catch {
      if (/^[[{]/.test(t)) return 'looks like JSON, but has an error';
    }
  }
  if (t.length > 8 && /^[A-Za-z0-9+/_-]+={0,2}$/.test(t) && t.length % 4 !== 1) return 'might be Base64';
  if (/%[0-9A-Fa-f]{2}/.test(t)) return 'has URL encoding';
  return '';
}
