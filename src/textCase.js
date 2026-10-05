// Text case conversions for the case converter. Multi-line text is
// converted line by line, so line breaks survive every mode.

const perLine = (fn) => (text) => text.split('\n').map(fn).join('\n');

// Words for camel/snake/kebab: split on anything that isn't a letter or
// digit, and on lower→Upper and ACRONYMWord boundaries ("parseHTMLText"
// → parse, HTML, Text).
export function splitWords(line) {
  return line
    // An apostrophe inside a word keeps it one word ("don't" → "dont", not "don t")
    .replace(/(\p{L})['’](?=\p{L})/gu, '$1')
    .replace(/([\p{Ll}\p{N}])(\p{Lu})/gu, '$1 $2')
    .replace(/(\p{Lu}+)(\p{Lu}\p{Ll})/gu, '$1 $2')
    .split(/[^\p{L}\p{M}\p{N}]+/u) // (accents and vowel signs are part of their letter)
    .filter(Boolean);
}

const capitalize = (w) => (w ? w[0].toUpperCase() + w.slice(1) : w);

export const toLower = (text) => text.toLowerCase();
export const toUpper = (text) => text.toUpperCase();

// Every word capitalized ("well-known" → "Well-Known"); not after an
// apostrophe ("don't" → "Don't").
export const toTitle = (text) =>
  text.toLowerCase().replace(/(^|[\s\-–—/([{"“‘«])(\p{L})/gu, (_, before, letter) => before + letter.toUpperCase());

// First letter of each sentence (and line) capitalized; a lone "i" too.
export const toSentence = (text) =>
  text
    .toLowerCase()
    // (after leading spaces and opening quotes or brackets too: '"hello"')
    // (not after an abbreviation: "i.e. this", "e.g. that", "Dr. Smith"; "etc." often ends one)
    .replace(/(^|(?<!\b(?:i\.e|e\.g|vs|mr|mrs|ms|dr))[.!?]\s+|\n)([\s"“‘'«([¿¡]*)(\p{L})/gu, (_, before, open, letter) => before + open + letter.toUpperCase())
    // (not "i.e.", but "so do i." yes)
    .replace(/(^|[^\p{L}\p{N}'’.])i(?=$|[^\p{L}\p{N}.]|\.(?!\p{L}))/gu, '$1I');

export const toCamel = perLine((line) => {
  const words = splitWords(line).map(w => w.toLowerCase());
  return words.map((w, i) => (i === 0 ? w : capitalize(w))).join('');
});

export const toSnake = perLine((line) => splitWords(line).map(w => w.toLowerCase()).join('_'));

export const toKebab = perLine((line) => splitWords(line).map(w => w.toLowerCase()).join('-'));

// Trims each line, turns runs of spaces/tabs (and non-breaking spaces) into
// one space, keeps at most one blank line in a row, and drops blank lines
// at the start and end.
export const tidySpaces = (text) =>
  text
    .replace(/\r\n?/g, '\n')
    .replace(/[\t  -   　 ]+/g, ' ')
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+|\n+$/g, '');

export const CASES = [
  { key: 'lower',    label: 'lowercase',     fn: toLower },
  { key: 'upper',    label: 'UPPERCASE',     fn: toUpper },
  { key: 'title',    label: 'Title Case',    fn: toTitle },
  { key: 'sentence', label: 'Sentence case', fn: toSentence },
  { key: 'camel',    label: 'camelCase',     fn: toCamel },
  { key: 'snake',    label: 'snake_case',    fn: toSnake },
  { key: 'kebab',    label: 'kebab-case',    fn: toKebab },
  { key: 'tidy',     label: 'tidy spaces',   fn: tidySpaces },
];

// Characters (as people see them: emoji and accents count once), words, lines
let segmenter = null;
export function textStats(text) {
  if (!text) return { chars: 0, words: 0, lines: 0 };
  let chars;
  // Plain ASCII: one letter a character (a "\r\n" counts once); counting
  // a megabyte by graphemes took ~280ms a key
  if (!/[^\t\n\r -~]/.test(text)) {
    chars = text.length - (text.match(/\r\n/g)?.length || 0);
  } else if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    segmenter = segmenter || new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    chars = 0;
    for (const _ of segmenter.segment(text)) chars++; // eslint-disable-line no-unused-vars
  } else {
    chars = [...text].length;
  }
  const trimmed = text.trim();
  const words = trimmed ? trimmed.split(/\s+/u).length : 0;
  const lines = text.split('\n').length;
  return { chars, words, lines };
}
