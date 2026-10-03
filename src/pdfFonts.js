// Matching the PDF editor's new words to the PDF's own fonts.
//
// Best: the font the PDF itself uses. PDFs carry their fonts (usually only
// the letters they need), and pdf.js hands them over: the font file, which
// character codes stand for which letters, and where each code sits inside
// the font. When every letter of the new words is in there, the new words
// are drawn in exactly the original font, on screen and in the saved PDF.
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

// Each letter's code inside the original font (null for a space), or null
// when a letter isn't in it
export function originalGlyphs(info, text) {
  if (!info?.data || !text) return null;
  const out = [];
  for (const ch of text) {
    if (ch === ' ' || ch === ' ') {
      out.push(null);
      continue;
    }
    const code = info.codeOf.get(ch);
    const fc = code === undefined ? undefined : info.fontChar[code];
    if (typeof fc !== 'number') return null;
    out.push(fc);
  }
  return out;
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
export function cssWidthEm(css, text) {
  const key = `${css.fontFamily}|${css.fontWeight}|${css.fontStyle}|${text}`;
  if (measured.has(key)) return measured.get(key);
  const ctx = measureCanvas?.getContext('2d');
  if (!ctx) return 0;
  ctx.font = `${css.fontStyle} ${css.fontWeight} 100px ${css.fontFamily}`;
  const w = ctx.measureText(text).width / 100;
  measured.set(key, w);
  return w;
}
