// Matching the PDF editor's new words to the PDF's own fonts.
//
// Best: the font the PDF itself uses. PDFs carry their fonts (usually only
// the letters they need), and pdf.js hands them over: the font file, which
// character codes stand for which letters, and where each code sits inside
// the font. A copy of the font is made that takes real letters (below), and
// when every letter of the new words is in it they're typed, shown and
// saved in exactly the original font.
//
// Otherwise: the closest of the standard PDF fonts (Helvetica, Times,
// Courier, each plain / bold / italic), picked from what the font says it
// is (serif, fixed-width, bold, italic) and its name, and squeezed or
// stretched so its letters take the same room as the original's.

// What we know about one of the PDF's fonts (from pdf.js, opened with
// fontExtraProperties so it keeps all of this)
export function fontInfoOf(font, cssFamily = '') {
  if (!font || font instanceof Error) return null;
  const codeOf = new Map(); // letter -> character code in the PDF
  const map = font.toUnicode?._map;
  if (Array.isArray(map)) {
    map.forEach((u, code) => {
      if (typeof u === 'string' && u.length && !codeOf.has(u)) codeOf.set(u, code);
    });
  }
  const spaceCode = codeOf.get(' ');
  const widths = font.widths || null;
  const spaceWidth = spaceCode !== undefined && widths?.[spaceCode] > 0 ? widths[spaceCode] / 1000 : null;
  const usable = !!font.data && !font.missingFile && !font.isType3Font && !font.vertical && codeOf.size > 0;
  return {
    name: font.name || '',
    loadedName: font.loadedName,
    data: usable ? font.data : null,
    codeOf,
    fontChar: font.toFontChar || [],
    spaceWidth, // as a share of the font size
    style: pickStandard(font.name || '', cssFamily, {
      bold: font.bold || font.black,
      italic: font.italic,
      serif: font.isSerifFont,
      mono: font.isMonospace,
    }),
  };
}

// The closest standard PDF font
export function pickStandard(name = '', family = '', flags = {}) {
  // "ABCDEF+Some-FontBold" → "some font bold"
  const n = `${name.replace(/^[A-Z]{6}\+/, '')} ${family}`
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_,]+/g, ' ')
    .toLowerCase();
  const bold = !!flags.bold || /\b(bold|black|heavy|semi ?bold|demi ?bold|extra ?bold|ultra ?bold|bd|w[6-9])\b/.test(n);
  const italic = !!flags.italic || /\b(italic|oblique|slanted|it)\b/.test(n);
  let base = 'Helvetica';
  if (flags.mono || /mono|courier|consol|menlo|typewriter|fixed|\bcode\b|monaco|inconsolata/.test(n) || family === 'monospace') {
    base = 'Courier';
  } else if (
    !/sans/.test(n)
    && (flags.serif || family === 'serif'
      || /serif|times|georgia|garamond|roman|cambria|minion|baskerville|palatino|book ?antiqua|caslon|bodoni|didot|charter|merriweather|playfair|lora|century|constantia|sabon|utopia|tinos/.test(n))
  ) {
    base = 'Times';
  }
  return { base, bold, italic };
}

export function standardFontKey({ base, bold, italic }) {
  if (base === 'Times') return bold && italic ? 'TimesRomanBoldItalic' : bold ? 'TimesRomanBold' : italic ? 'TimesRomanItalic' : 'TimesRoman';
  const suffix = bold && italic ? 'BoldOblique' : bold ? 'Bold' : italic ? 'Oblique' : '';
  return `${base}${suffix}`;
}

export const cssFont = ({ base, bold, italic }) => ({
  fontFamily: base === 'Times' ? '"Times New Roman", Times, serif' : base === 'Courier' ? '"Courier New", Courier, monospace' : 'Helvetica, Arial, sans-serif',
  fontWeight: bold ? 700 : 400,
  fontStyle: italic ? 'italic' : 'normal',
});

// How much a standard font's letters must be squeezed (< 1) or stretched
// (> 1) to take the original's room, kept within reason
export const squeezeFor = (originalWidth, standInWidth) =>
  (originalWidth > 0 && standInWidth > 0 ? Math.min(1.35, Math.max(0.7, originalWidth / standInWidth)) : 1);

// The same, measured on screen for a CSS font (in ems), for the preview
const measureCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
const measured = new Map();
// `cache: false` for text being typed (a new key each letter, and the PDF's
// own font may still be loading)
export function cssWidthEm(css, text, { cache = true } = {}) {
  const key = `${css.fontFamily}|${css.fontWeight}|${css.fontStyle}|${text}`;
  if (cache && measured.has(key)) return measured.get(key);
  const ctx = measureCanvas?.getContext('2d');
  if (!ctx) return 0;
  ctx.font = `${css.fontStyle} ${css.fontWeight} 100px ${css.fontFamily}`;
  const w = ctx.measureText(text).width / 100;
  if (cache) measured.set(key, w);
  return w;
}

// ── A copy of the PDF's font that understands real letters ─────────────
//
// pdf.js puts a font's letters under private codes of its own, so typing
// "a" in that font shows nothing. This rewrites the font's character map
// (its "cmap" table) so each letter sits under its real Unicode instead:
// then the very same font can be typed in, shown and saved with real text.

const u16 = (dv, o) => dv.getUint16(o);
const u32 = (dv, o) => dv.getUint32(o);

function tablesOf(data) {
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const n = u16(dv, 4);
  const tables = [];
  for (let i = 0; i < n; i++) {
    const r = 12 + i * 16;
    const tag = String.fromCharCode(data[r], data[r + 1], data[r + 2], data[r + 3]);
    const offset = u32(dv, r + 8);
    const length = u32(dv, r + 12);
    tables.push({ tag, bytes: data.subarray(offset, offset + length) });
  }
  return { version: u32(dv, 0), tables };
}

// Every code the font's cmap knows → its glyph
function readCmap(cmap) {
  const dv = new DataView(cmap.buffer, cmap.byteOffset, cmap.byteLength);
  const glyphOf = new Map();
  const subs = u16(dv, 2);
  for (let i = 0; i < subs; i++) {
    const at = u32(dv, 4 + i * 8 + 4);
    const format = u16(dv, at);
    if (format === 4) {
      const segX2 = u16(dv, at + 6);
      const ends = at + 14;
      const starts = ends + segX2 + 2;
      const deltas = starts + segX2;
      const ranges = deltas + segX2;
      for (let s = 0; s < segX2; s += 2) {
        const end = u16(dv, ends + s);
        const start = u16(dv, starts + s);
        const delta = u16(dv, deltas + s);
        const range = u16(dv, ranges + s);
        for (let c = start; c <= end && c !== 0xffff; c++) {
          let g;
          if (!range) g = (c + delta) & 0xffff;
          else {
            const raw = u16(dv, ranges + s + range + 2 * (c - start));
            g = raw ? (raw + delta) & 0xffff : 0;
          }
          if (g && !glyphOf.has(c)) glyphOf.set(c, g);
        }
      }
    } else if (format === 12) {
      const groups = u32(dv, at + 12);
      for (let k = 0; k < groups; k++) {
        const g0 = at + 16 + k * 12;
        const start = u32(dv, g0);
        const end = u32(dv, g0 + 4);
        const glyph = u32(dv, g0 + 8);
        for (let c = start; c <= end; c++) if (!glyphOf.has(c)) glyphOf.set(c, glyph + (c - start));
      }
    }
  }
  return glyphOf;
}

// A cmap from [codePoint, glyph] pairs (format 4 for the basic plane, 12 for the rest)
function buildCmap(pairs) {
  // Letters in a row whose glyphs are in a row too share one range (one per
  // letter overflowed the table's 16-bit sizes for a big CJK font)
  const ranges = [];
  [...pairs].sort((p, q) => p[0] - q[0]).forEach(([c, g]) => {
    const last = ranges[ranges.length - 1];
    if (last && c === last.end + 1 && g - c === last.delta && (c > 0xffff) === (last.end > 0xffff)) last.end = c;
    else if (!last || c !== last.end) ranges.push({ start: c, end: c, delta: g - c });
  });
  // Format 4 (the letters up to U+FFFE) while it fits; past that everything
  // goes in format 12, and format 4 holds just its closing range
  let bmp = ranges.filter(r => r.end < 0xffff);
  const fits = 16 + (bmp.length + 1) * 8 <= 0xffff;
  const wide = fits ? ranges.filter(r => r.start > 0xffff) : ranges.filter(r => r.end !== 0xffff);
  if (!fits) bmp = [];
  const segCount = bmp.length + 1;
  const f4Len = 16 + segCount * 8;
  const f12Len = wide.length ? 16 + wide.length * 12 : 0;
  const subs = wide.length ? 2 : 1;
  const head = 4 + subs * 8;
  const out = new Uint8Array(head + f4Len + f12Len);
  const dv = new DataView(out.buffer);
  dv.setUint16(2, subs);
  dv.setUint16(4, 3); dv.setUint16(6, 1); dv.setUint32(8, head);
  if (wide.length) { dv.setUint16(12, 3); dv.setUint16(14, 10); dv.setUint32(16, head + f4Len); }
  // format 4: one segment per range, then the closing 0xFFFF
  let o = head;
  const pow = 2 ** Math.floor(Math.log2(segCount));
  dv.setUint16(o, 4); dv.setUint16(o + 2, f4Len);
  dv.setUint16(o + 6, segCount * 2); dv.setUint16(o + 8, pow * 2);
  dv.setUint16(o + 10, Math.log2(pow)); dv.setUint16(o + 12, segCount * 2 - pow * 2);
  const ends = o + 14;
  const starts = ends + segCount * 2 + 2;
  const deltas = starts + segCount * 2;
  const offsets = deltas + segCount * 2;
  bmp.forEach((r, i) => {
    dv.setUint16(ends + i * 2, r.end);
    dv.setUint16(starts + i * 2, r.start);
    dv.setUint16(deltas + i * 2, r.delta & 0xffff);
    dv.setUint16(offsets + i * 2, 0);
  });
  const last = bmp.length;
  dv.setUint16(ends + last * 2, 0xffff); dv.setUint16(starts + last * 2, 0xffff);
  dv.setUint16(deltas + last * 2, 1); dv.setUint16(offsets + last * 2, 0);
  if (wide.length) {
    o = head + f4Len;
    dv.setUint16(o, 12); dv.setUint32(o + 4, f12Len); dv.setUint32(o + 12, wide.length);
    wide.forEach((r, i) => {
      dv.setUint32(o + 16 + i * 12, r.start); dv.setUint32(o + 20 + i * 12, r.end); dv.setUint32(o + 24 + i * 12, r.start + r.delta);
    });
  }
  return out;
}

function checksum(bytes) {
  let sum = 0;
  for (let i = 0; i < bytes.length; i += 4) {
    sum = (sum + (((bytes[i] << 24) | ((bytes[i + 1] || 0) << 16) | ((bytes[i + 2] || 0) << 8) | (bytes[i + 3] || 0)) >>> 0)) >>> 0;
  }
  return sum;
}

// The font again, with this cmap in place of its own
function withCmap(data, cmap) {
  const { version, tables } = tablesOf(data);
  const list = tables.map(t => (t.tag === 'cmap' ? { tag: 'cmap', bytes: cmap } : t));
  const n = list.length;
  const headerLen = 12 + n * 16;
  const size = list.reduce((s, t) => s + ((t.bytes.length + 3) & ~3), headerLen);
  const out = new Uint8Array(size);
  const dv = new DataView(out.buffer);
  const pow = 2 ** Math.floor(Math.log2(n));
  dv.setUint32(0, version); dv.setUint16(4, n);
  dv.setUint16(6, pow * 16); dv.setUint16(8, Math.log2(pow)); dv.setUint16(10, n * 16 - pow * 16);
  let at = headerLen;
  list.forEach((t, i) => {
    const r = 12 + i * 16;
    for (let k = 0; k < 4; k++) out[r + k] = t.tag.charCodeAt(k);
    dv.setUint32(r + 4, checksum(t.bytes));
    dv.setUint32(r + 8, at);
    dv.setUint32(r + 12, t.bytes.length);
    out.set(t.bytes, at);
    at += (t.bytes.length + 3) & ~3;
  });
  return out;
}

// The real-letter copy of a font, and which letters it has (once per font)
export function unicodeFontOf(info) {
  if (!info?.data) return null;
  if (info.unicode !== undefined) return info.unicode;
  let result = null;
  try {
    const { tables } = tablesOf(info.data);
    const cmap = tables.find(t => t.tag === 'cmap');
    if (cmap) {
      const glyphOf = readCmap(cmap.bytes);
      const pairs = [];
      const letters = new Set();
      info.codeOf.forEach((code, letter) => {
        const chars = [...letter];
        if (chars.length !== 1) return;
        const fc = info.fontChar[code];
        const g = typeof fc === 'number' ? glyphOf.get(fc) : undefined;
        const cp = letter.codePointAt(0);
        if (g && !letters.has(cp)) {
          letters.add(cp);
          pairs.push([cp, g]);
        }
      });
      pairs.sort((a, b) => a[0] - b[0]);
      if (pairs.length) result = { data: withCmap(info.data, buildCmap(pairs)), letters };
    }
  } catch {
    result = null;
  }
  info.unicode = result;
  return result;
}

// Whether the real-letter copy can write all of this text (spaces aside)
export function originalCanWrite(info, text) {
  const u = info?.unicode;
  if (!u || !text) return false;
  for (const ch of text) {
    if (ch === ' ' || ch === ' ') continue;
    if (!u.letters.has(ch.codePointAt(0))) return false;
  }
  return true;
}
