// Find and replace's matching (the PDF editor): what counts as the same
// words. Always regardless of case, and of what doesn't change a word:
// accents ("cafe" finds "café"), ligatures (ﬁ), curly quotes, the many
// dashes, odd spaces (no-break, thin) and how many there are. Words that
// were read off a picture (OCR) also forgive what Tesseract mixes up: 0 / O,
// 1 / l / I / |, "rn" for "m", "vv" for "w", and spaces it dropped or added
// ("Google Play" finds "GooglePlay").
//
// Each kept letter remembers where it came from, so a match is a stretch of
// the original text, and replace all swaps exactly that stretch.

const QUOTE1 = /[‘’‚‛′`´]/g;
const QUOTE2 = /[“”„‟″]/g;
const DASH = /[‐-―−﹘﹣－]/g;
const SPACE = /[\s  -   　]/;
const GONE = /[­​-‍⁠﻿]|\p{M}/u; // soft hyphen, zero-width, accents

// One letter as it's compared (lowercase, its accents off, ligatures spread)
function plain(ch) {
  return ch
    .normalize('NFKD')
    .replace(QUOTE1, "'")
    .replace(QUOTE2, '"')
    .replace(DASH, '-')
    .toLowerCase();
}

// What an OCR'd letter is taken as: the ones Tesseract mixes up, as one
const ocrLetter = (c) => (c === '0' ? 'o' : '1il|!'.includes(c) ? 'l' : c);

// `text` as it's compared, with where each of its letters came from
// (`from[k]` is the original index of folded letter k; `to[k]` the index
// just past it)
export function fold(text, { ocr = false } = {}) {
  let s = '';
  const from = [];
  const to = [];
  let lastSpace = true; // (spaces at the start dropped)
  for (let i = 0; i < text.length;) {
    const cp = text.codePointAt(i);
    const ch = String.fromCodePoint(cp);
    const end = i + ch.length;
    if (SPACE.test(ch)) {
      // A run of spaces is one; in OCR'd words, none at all
      if (!ocr && !lastSpace) { s += ' '; from.push(i); to.push(end); }
      lastSpace = true;
      i = end;
      continue;
    }
    for (const c of plain(ch)) {
      if (GONE.test(c)) continue;
      s += ocr ? ocrLetter(c) : c;
      // (one entry per unit of the folded string: an emoji takes two)
      for (let u = 0; u < c.length; u++) { from.push(i); to.push(end); }
    }
    lastSpace = false;
    i = end;
  }
  if (s.endsWith(' ')) { s = s.slice(0, -1); from.pop(); to.pop(); }
  if (ocr) {
    // Pairs read as one letter (and the other way round): "rn" ↔ "m",
    // "vv" ↔ "w"; both sides fold the same way, so either reading matches
    let out = '';
    const f2 = [];
    const t2 = [];
    for (let k = 0; k < s.length; k++) {
      const pair = s[k] + (s[k + 1] || '');
      if (pair === 'rn' || pair === 'vv') {
        out += pair === 'rn' ? 'm' : 'w';
        f2.push(from[k]);
        t2.push(to[k + 1]);
        k++;
      } else {
        out += s[k];
        f2.push(from[k]);
        t2.push(to[k]);
      }
    }
    return { s: out, from: f2, to: t2 };
  }
  return { s, from, to };
}

// Where `query` is found in `text`: [start, end) stretches of the original
// text, left to right, not overlapping. Empty when nothing is looked for.
export function findIn(text, query, { ocr = false } = {}) {
  const q = fold(query, { ocr }).s;
  if (!q || !text) return [];
  const t = fold(text, { ocr });
  const out = [];
  for (let k = t.s.indexOf(q); k !== -1; k = t.s.indexOf(q, k + q.length)) {
    out.push([t.from[k], t.to[k + q.length - 1]]);
  }
  return out;
}

// `text` with every match of `query` swapped for `replacement`
export function replaceIn(text, query, replacement, opts) {
  const hits = findIn(text, query, opts);
  if (!hits.length) return text;
  let out = '';
  let at = 0;
  for (const [a, b] of hits) {
    out += text.slice(at, a) + replacement;
    at = b;
  }
  return out + text.slice(at);
}
