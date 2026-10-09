// Reading words from a picture of text (Tesseract, run in the browser).
//
// Some PDFs show text as pictures: Apple Mail prints an email's header
// (From, Subject, Date, To) that way, and a scanned or photographed page is
// one picture of everything on it — no text there to change. The PDF editor
// reads those pictures so they can be changed like text. Everything
// Tesseract needs is served by the app from /ocr/ (see vite.config.js) and
// only fetched the first time a picture is read.

import { loadLibrary } from './utils';

const BASE = `${import.meta.env.BASE_URL}ocr/`;

let workerPromise = null;
function ocrWorker() {
  if (!workerPromise) {
    workerPromise = loadLibrary(() => import('tesseract.js'))
      .then(({ createWorker }) => createWorker('eng', 1, {
        workerPath: `${BASE}worker.min.js`,
        corePath: BASE,
        langPath: BASE,
        gzip: true,
        workerBlobURL: false,
      }))
      .catch((err) => {
        workerPromise = null;
        throw err;
      });
  }
  return workerPromise;
}

// One read at a time, each with its own layout setting (one line, or a
// whole page): a page read and a line read can't mix their settings
let queue = Promise.resolve();
let mode = null;
function read(canvas, psm) {
  const run = queue.then(async () => {
    const worker = await ocrWorker();
    try {
      if (mode !== psm) {
        await worker.setParameters({ tessedit_pageseg_mode: psm, preserve_interword_spaces: '1' });
        mode = psm;
      }
      const { data } = await worker.recognize(canvas, {}, { text: true, blocks: true });
      return data;
    } catch (err) {
      // A worker that failed (out of memory on a phone, say) isn't used
      // again: the next read starts a fresh one
      workerPromise = null;
      mode = null;
      worker.terminate().catch(() => {});
      throw err;
    }
  });
  queue = run.catch(() => {});
  return run;
}

const linesOf = (data) => (data.blocks || []).flatMap(b => b.paragraphs.flatMap(p => p.lines));
const wordsOf = (line) => line.words.map(w => ({ text: tidy(w.text.trim()), sure: w.confidence, bbox: w.bbox, symbols: w.symbols || [] })).filter(w => w.text);

// Letters and numbers Tesseract mixes up, put right by the word around
// them (same length, so its letters' places hold): in a number, O → 0 and
// l / I / | → 1 ("1O5", "$4l.20"); in a word, 0 → O ("C0MPANY", "g0ld").
// Only where the rest of the word leaves no doubt: mostly one or the other.
export function tidy(text) {
  return text.replace(/[\p{L}\p{N}|][\p{L}\p{N}|.,:/-]*/gu, (w) => {
    const digits = (w.match(/\p{N}/gu) || []).length;
    const mixed = (w.match(/[OoIl|]/g) || []).length;
    if (mixed && digits >= 2 && digits > mixed && !/[^\p{N}OoIl|.,:/-]/u.test(w)) {
      return w.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1');
    }
    const zeros = (w.match(/0/g) || []).length;
    const letters = (w.match(/\p{L}/gu) || []).length;
    if (zeros && letters >= 2 && zeros < letters && !/[^\p{L}0]/u.test(w)) {
      return w.replace(/0/g, w === w.toUpperCase() ? 'O' : 'o');
    }
    return w;
  });
}
// Where a line's baseline is at x (it may slope: a scan is rarely straight)
const baselineAt = (line, x) => {
  const b = line.baseline;
  // (none found: the line's bottom)
  if (!b || b.has_baseline === false || !Number.isFinite(b.y0) || !Number.isFinite(b.y1)) return line.bbox.y1;
  if (b.x1 === b.x0) return (b.y0 + b.y1) / 2;
  return b.y0 + ((x - b.x0) * (b.y1 - b.y0)) / (b.x1 - b.x0);
};

// Reads the line of text in `canvas`. Returns its words and where they sit,
// in the canvas's pixels: the baseline's height, where the text starts and
// ends, and how tall its letters stand above the baseline — or null.
export async function readLine(canvas) {
  const data = await read(canvas, '7');
  const line = linesOf(data).find(l => l.text.trim()) || null;
  // Specks at the ends read as lone marks or letters ("~ From:", "h From:"):
  // short words Tesseract isn't sure of are dropped from either end
  const words = line ? wordsOf(line) : [];
  const speck = (w) => w.text.length <= 2 && (w.sure < 60 || !/[\p{L}\p{N}]/u.test(w.text));
  while (words.length > 1 && speck(words[0])) words.shift();
  while (words.length > 1 && speck(words[words.length - 1])) words.pop();
  const text = line ? words.map(w => w.text).join(' ') : (data.text || '').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  if (!line) return { text };
  const { bbox } = line;
  const left = words.length ? words[0].bbox.x0 : bbox.x0;
  return {
    text,
    sure: words.length ? words.reduce((t, w) => t + w.sure, 0) / words.length : 0, // how sure Tesseract is (0–100)
    baseline: baselineAt(line, left), // (where its words start)
    left,
    right: words.length ? words[words.length - 1].bbox.x1 : bbox.x1,
    top: bbox.y0,
  };
}

// Reads a picture of a few lines of text (an email header's value that ran
// onto a second line): each line, top to bottom, in the canvas's pixels —
// { text, sure (how sure Tesseract is, 0–100), x0, x1, y0, y1 (its baseline
// at its ends), cap (how tall its letters stand) } — or [] when nothing reads. Specks at a line's ends go.
export async function readBlock(canvas) {
  const data = await read(canvas, '6');
  const out = [];
  for (const line of linesOf(data)) {
    const ws = wordsOf(line);
    const speck = (w) => w.text.length <= 2 && (w.sure < 60 || !/[\p{L}\p{N}]/u.test(w.text));
    while (ws.length > 1 && speck(ws[0])) ws.shift();
    while (ws.length > 1 && speck(ws[ws.length - 1])) ws.pop();
    // (believable, as on a page: sure of, or long runs of letters and
    // numbers — sideways or smudged print reads as short words it isn't)
    const alnum = (t) => (t.match(/[\p{L}\p{N}]/gu) || []).length;
    const believable = (w) => alnum(w.text) > 0 && (w.sure >= 50 || (alnum(w.text) >= w.text.length * 0.8 && w.text.length >= 6));
    const chars = ws.reduce((t, w) => t + w.text.length, 0);
    if (!ws.length || ws.filter(believable).reduce((t, w) => t + w.text.length, 0) < chars * 0.5) continue;
    const b = line.baseline;
    const slope = b && b.has_baseline !== false && Number.isFinite(b.y0) && b.x1 !== b.x0 ? (b.y1 - b.y0) / (b.x1 - b.x0) : 0;
    const x0 = ws[0].bbox.x0;
    const x1 = ws[ws.length - 1].bbox.x1;
    // Its baseline and height from its own words (as for a page's lines)
    const at = (w, y) => y - slope * ((w.bbox.x0 + w.bbox.x1) / 2 - x0);
    const bottoms = ws.map(w => at(w, w.bbox.y1)).sort((p, q) => p - q);
    const tops = ws.map(w => at(w, w.bbox.y0)).sort((p, q) => p - q);
    // The line's own baseline where Tesseract found one (a picture's line is
    // one line: its words' bottoms reach down to the tails of g, p and _ —
    // one long word, an email address, made its letters a quarter too tall)
    const found = b && b.has_baseline !== false && Number.isFinite(b.y0) && b.x1 !== b.x0;
    const base = found ? baselineAt(line, x0) : bottoms[Math.floor((bottoms.length - 1) * 0.3)];
    const top = tops[Math.ceil((tops.length - 1) / 2)];
    const sure = ws.reduce((t, w) => t + w.sure, 0) / ws.length;
    out.push({ text: tidyAddress(ws.map(w => w.text).join(' ')), sure, x0, x1, y0: base, y1: base + slope * (x1 - x0), cap: Math.max(2, base - top) });
  }
  return out.sort((p, q) => p.y0 - q.y0);
}

// A scan made plain black on white (inkWorker.js), in place; left as it
// was if that can't be done
async function plainInk(canvas) {
  try {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const worker = new Worker(new URL('./inkWorker.js', import.meta.url), { type: 'module' });
    const data = await new Promise((resolve, reject) => {
      worker.onmessage = (e) => resolve(e.data.data);
      worker.onerror = reject;
      worker.postMessage({ id: 1, width: image.width, height: image.height, data: image.data }, [image.data.buffer]);
    }).finally(() => worker.terminate());
    ctx.putImageData(new ImageData(new Uint8ClampedArray(data.buffer), canvas.width, canvas.height), 0, 0);
  } catch {
    // Read as it is
  }
}

// A copy of `canvas` made plain black on white (for a second reading)
export async function inkCopy(canvas) {
  const copy = document.createElement('canvas');
  copy.width = canvas.width;
  copy.height = canvas.height;
  copy.getContext('2d', { willReadFrequently: true }).drawImage(canvas, 0, 0);
  await plainInk(copy);
  return copy;
}

// Reads a whole page (a scan, a photo): its lines, in the canvas's pixels.
// A line with a wide gap in it (a table's columns, a label and its value
// far apart) comes back as separate pieces, so each can change on its own.
// Each: { text, x0, x1 (where it starts and ends), y0, y1 (its baseline's
// height there, so its slope too), cap (how tall its letters stand above
// the baseline), mono (the letters all take the same room: a typewriter or
// receipt printer) }.
export async function readPage(canvas) {
  // The page as it was, kept for reading single lines again (see rereadLine)
  const raw = document.createElement('canvas');
  raw.width = canvas.width;
  raw.height = canvas.height;
  raw.getContext('2d').drawImage(canvas, 0, 0);
  await plainInk(canvas);
  const data = await read(canvas, '3');
  // The print's usual height (from the words it's sure of)
  const heights = linesOf(data).flatMap(l => wordsOf(l).filter(w => w.sure >= 60).map(w => w.bbox.y1 - w.bbox.y0)).sort((p, q) => p - q);
  const usual = heights[Math.floor(heights.length / 2)] || 20;
  const out = [];
  for (const line of linesOf(data)) {
    const words = wordsOf(line);
    if (!words.length) continue;
    // A gap wider than about five letters (and than the print is tall)
    // parts columns; a word's space, even a double one (or a word Tesseract
    // boxed short), doesn't
    const per = words.map(w => (w.bbox.x1 - w.bbox.x0) / Math.max(1, w.text.length)).sort((p, q) => p - q);
    const letter = per[Math.floor(per.length / 2)] || usual * 0.6;
    const wide = Math.max(letter * 5, usual * 1.5);
    let piece = [words[0]];
    const pieces = [piece];
    for (let k = 1; k < words.length; k++) {
      if (words[k].bbox.x0 - words[k - 1].bbox.x1 > wide) pieces.push(piece = []);
      piece.push(words[k]);
    }
    // The line's slope (a scan is rarely straight)
    const b = line.baseline;
    const slope = b && b.has_baseline !== false && Number.isFinite(b.y0) && b.x1 !== b.x0 ? (b.y1 - b.y0) / (b.x1 - b.x0) : 0;
    for (const piece of pieces) {
      // Is it text? A word is believable when Tesseract is fairly sure of it,
      // or when it's a long run of letters and numbers (a tracking number,
      // which it's rarely sure of); a piece is kept when most of it is.
      // A photo's background, a barcode's bars and smudges read as short
      // words it isn't sure of: those go, and so do specks at a piece's ends.
      const alnum = (t) => (t.match(/[\p{L}\p{N}]/gu) || []).length;
      const digits = (t) => (t.match(/\p{N}/gu) || []).length;
      const believable = (w) => alnum(w.text) > 0 && (w.sure >= 50 || (alnum(w.text) >= w.text.length * 0.8 && (w.text.length >= 6 || digits(w.text) >= 3)));
      const ws = piece.slice();
      while (ws.length && ws[0].text.length <= 2 && !believable(ws[0])) ws.shift();
      while (ws.length && ws[ws.length - 1].text.length <= 2 && !believable(ws[ws.length - 1])) ws.pop();
      const chars = ws.reduce((t, w) => t + w.text.length, 0);
      const sure = ws.filter(believable);
      if (!ws.length || sure.reduce((t, w) => t + w.text.length, 0) < chars * 0.5 || sure.reduce((t, w) => t + alnum(w.text), 0) < 2) continue;
      const text = tidyAddress(ws.map(w => w.text).join(' '));
      const x0 = ws[0].bbox.x0;
      const x1 = ws[ws.length - 1].bbox.x1;
      // Its own baseline and height, from its words (not the whole line's:
      // Tesseract sometimes runs two rows of a table together): the words'
      // bottoms and tops, slid along the slope to its start. Bottoms: a low
      // one (words with a tail below the line sit lower); tops: the middle.
      const at = (w, y) => y - slope * ((w.bbox.x0 + w.bbox.x1) / 2 - x0);
      const bottoms = ws.map(w => at(w, w.bbox.y1)).sort((p, q) => p - q);
      const tops = ws.map(w => at(w, w.bbox.y0)).sort((p, q) => p - q);
      const base = bottoms[Math.floor((bottoms.length - 1) * 0.3)];
      const top = tops[Math.ceil((tops.length - 1) / 2)]; // (of two, the lower: a smudge above one word can't stretch it)
      // Each letter's room: the same in every word, for a fixed-width font
      // — and fitting that better than a proportional font's widths do (a
      // few plain words came out alike enough by letter count alone)
      const long = ws.filter(w => w.text.length >= 2);
      const spreadOf = (per) => {
        const mean = per.reduce((t, v) => t + v, 0) / (per.length || 1);
        return per.length >= 2 && mean > 0 ? Math.sqrt(per.reduce((t, v) => t + (v - mean) ** 2, 0) / per.length) / mean : 1;
      };
      const spread = spreadOf(long.map(w => (w.bbox.x1 - w.bbox.x0) / w.text.length));
      const spreadProp = spreadOf(long.map(w => (w.bbox.x1 - w.bbox.x0) / proportionalWidth(w.text)));
      // Better, where its letters tell: from one letter to the next
      const byPitch = monoByPitch(ws);
      out.push({
        text,
        x0,
        x1,
        y0: base,
        y1: base + slope * (x1 - x0),
        cap: Math.max(2, base - top),
        mono: byPitch ?? (spread < 0.12 && spread < spreadProp * 0.75),
        sure: ws.reduce((t, w) => t + w.sure, 0) / ws.length,
        // Words far taller than the print: rows packed close together, run
        // into one by Tesseract (worked out again below)
        tall: Math.max(...ws.map(w => w.bbox.y1 - w.bbox.y0)) > usual * 1.5,
        span: [Math.min(...ws.map(w => w.bbox.y0)), Math.max(...ws.map(w => w.bbox.y1))],
        slope,
      });
    }
  }
  // Specks read as tiny letters (the weave of a cloth under a photographed
  // receipt): far shorter than the page's own print
  const caps = out.map(l => l.cap).sort((p, q) => p - q);
  const typical = caps[Math.floor(caps.length / 2)] || 0;
  const kept = out.filter(l => l.cap >= typical * 0.45);
  for (const l of kept) {
    if (l.tall) await refine(canvas, l, usual);
    delete l.tall;
    delete l.span;
  }
  // Bold print: its strokes are thicker for its height than the page's
  // usual print (Tesseract doesn't say)
  kept.forEach((l) => { l.stroke = strokeOf(canvas, l); });
  const strokes = kept.map(l => l.stroke).filter(v => v > 0).sort((p, q) => p - q);
  const usualStroke = strokes[Math.floor((strokes.length - 1) / 2)] || 0;
  kept.forEach((l) => {
    l.bold = usualStroke > 0 && l.stroke > Math.max(0.13, usualStroke * 1.3);
    delete l.stroke;
  });
  return { lines: kept, raw, ink: canvas };
}

// Helvetica's widths (in 1/1000 em) for the printable ASCII letters, from
// space to ~: how wide a letter is in an ordinary proportional font
const HELVETICA = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];
const helveticaWidth = (ch) => {
  const c = ch.codePointAt(0);
  return c >= 32 && c <= 126 ? HELVETICA[c - 32] / 1000 : 0.556;
};

// About how wide a word is in a proportional font, in ems
function proportionalWidth(text) {
  let w = 0;
  for (const ch of text) w += helveticaWidth(ch);
  return w || 1;
}

// Is a line in fixed-width letters (a typewriter, a receipt printer, an ID
// card's typed name)? Told from one letter to the next: in a fixed-width
// font the step from a letter's middle to the next one's is the same every
// time; in a proportional one it grows and shrinks with the letters (an I
// steps short, an M long) — however widely the letters are spaced out.
// true / false, or null when its letters can't tell (too few, or ones
// alike in width in either kind of font, like most capitals).
export function monoByPitch(words) {
  const seen = [];
  const want = [];
  for (const w of words) {
    const syms = (w.symbols || []).filter(s => s.bbox && s.text && s.text.trim());
    if (syms.length !== [...w.text].length) continue; // (boxes and letters must line up)
    for (let k = 1; k < syms.length; k++) {
      const a = syms[k - 1];
      const b = syms[k];
      seen.push((b.bbox.x0 + b.bbox.x1) / 2 - (a.bbox.x0 + a.bbox.x1) / 2);
      want.push((helveticaWidth(a.text) + helveticaWidth(b.text)) / 2);
    }
  }
  if (seen.length < 5) return null;
  const mean = (v) => v.reduce((t, x) => t + x, 0) / v.length;
  const ms = mean(seen);
  const mw = mean(want);
  if (!(ms > 0)) return null;
  const sd = (v, m) => Math.sqrt(v.reduce((t, x) => t + (x - m) ** 2, 0) / v.length);
  const seenSpread = sd(seen, ms) / ms;
  const wantSpread = sd(want, mw) / mw;
  // Its letters would step alike in a proportional font too: can't tell
  if (wantSpread < 0.1) return null;
  // How closely the steps follow the proportional font's
  const cov = seen.reduce((t, x, k) => t + (x - ms) * (want[k] - mw), 0) / seen.length;
  const follows = cov / ((sd(seen, ms) || 1e-9) * (sd(want, mw) || 1e-9));
  return seenSpread < 0.1 && follows < 0.4;
}

// How thick a line's strokes are for its height: the usual length of the
// ink's runs across its middle rows (crossing a letter's upright, a run is
// as long as the stroke is thick), over the height of its tall letters.
// Read on the page made black on white; 0 when there's too little to tell.
function strokeOf(ink, l) {
  const x0 = Math.max(0, Math.floor(l.x0));
  const x1 = Math.min(ink.width, Math.ceil(l.x1));
  if (x1 - x0 < 4 || l.cap < 6) return 0;
  const counts = [];
  const rows = 6;
  const ctx = ink.getContext('2d', { willReadFrequently: true });
  for (let r = 0; r < rows; r++) {
    // Rows from 30% to 70% of the way up its letters, following its slope
    const up = l.cap * (0.3 + (0.4 * r) / (rows - 1));
    const yAt = (x) => Math.round(l.y0 + ((l.y1 - l.y0) * (x - l.x0)) / Math.max(1, l.x1 - l.x0) - up);
    const y = yAt((x0 + x1) / 2);
    if (y < 0 || y >= ink.height) continue;
    const row = ctx.getImageData(x0, y, x1 - x0, 1).data;
    let run = 0;
    for (let k = 0; k <= x1 - x0; k++) {
      const dark = k < x1 - x0 && row[k * 4] < 128;
      if (dark) run++;
      else if (run) { counts.push(run); run = 0; }
    }
  }
  if (counts.length < 8) return 0;
  counts.sort((p, q) => p - q);
  return counts[Math.floor(counts.length / 2)] / l.cap;
}

// How alike two readings are (0..1): 1 less their edit distance, as a
// share of the longer
function alike(a, b) {
  a = a.toLowerCase();
  b = b.toLowerCase();
  if (!a || !b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return 1 - prev[b.length] / Math.max(a.length, b.length);
}

// A piece whose words reached over several rows: the rows of ink across
// its width are found (where the dark pixels are, row by row, along its
// slope), each is read as one line, and the row that reads most like the
// piece is where it really is — its baseline, height and (cleaner) words.
async function refine(canvas, l, usual) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const W = canvas.width;
  const H = canvas.height;
  const pad = Math.round(usual * 0.5);
  const yA = Math.max(0, Math.floor(l.span[0] - pad));
  const yB = Math.min(H - 1, Math.ceil(l.span[1] + pad));
  const xA = Math.max(0, Math.floor(l.x0));
  const xB = Math.min(W - 1, Math.ceil(l.x1));
  if (yB - yA < 4 || xB - xA < 4) return;
  const tilt = Math.abs(l.slope * (xB - xA));
  const top = Math.max(0, Math.floor(yA - tilt));
  const img = ctx.getImageData(xA, top, xB - xA + 1, Math.min(H, Math.ceil(yB + tilt + 1)) - top);
  // Dark pixels in each row, along the slope
  const counts = [];
  for (let y = yA; y <= yB; y++) {
    let n = 0;
    for (let x = xA; x <= xB; x += 2) {
      const yy = Math.round(y + l.slope * (x - l.x0)) - top;
      if (yy < 0 || yy >= img.height) continue;
      if (img.data[(yy * img.width + (x - xA)) * 4] < 128) n++;
    }
    counts.push(n);
  }
  const most = Math.max(...counts);
  if (!most) return;
  // Rows of ink: runs above a little of the most, small gaps bridged
  const bands = [];
  let start = -1;
  let gap = 0;
  const bridge = Math.max(3, usual * 0.15);
  counts.forEach((n, i) => {
    if (n > most * 0.08) {
      if (start < 0) start = i;
      gap = 0;
    } else if (start >= 0 && ++gap > bridge) {
      bands.push([start, i - gap]);
      start = -1;
      gap = 0;
    }
  });
  if (start >= 0) bands.push([start, counts.length - 1 - gap]);
  // Rows so close their ink touches: a run taller than a row and a half is
  // parted at its emptiest row (away from its ends), again until none is
  for (let k = 0; k < bands.length; k++) {
    const [b0, b1] = bands[k];
    if (b1 - b0 <= usual * 1.5) continue;
    let cut = -1;
    for (let r = Math.ceil(b0 + usual * 0.4); r <= b1 - usual * 0.4; r++) if (cut < 0 || counts[r] < counts[cut]) cut = r;
    if (cut < 0) continue;
    bands.splice(k, 1, [b0, cut - 1], [cut + 1, b1]);
    k--;
  }
  let best = null;
  for (const [b0, b1] of bands) {
    if (b1 - b0 < usual * 0.35) continue;
    // That row, cut out straight (a little room around it) and read
    const m = Math.round(usual * 0.3);
    const cy0 = Math.max(0, yA + b0 - m - Math.ceil(tilt));
    const cy1 = Math.min(H, yA + b1 + m + Math.ceil(tilt));
    const crop = document.createElement('canvas');
    crop.width = xB - xA + 1 + 2 * m;
    crop.height = cy1 - cy0;
    const cctx = crop.getContext('2d');
    cctx.fillStyle = '#ffffff';
    cctx.fillRect(0, 0, crop.width, crop.height);
    cctx.drawImage(canvas, xA, cy0, xB - xA + 1, cy1 - cy0, m, 0, xB - xA + 1, cy1 - cy0);
    let found = null;
    try { found = await readLine(crop); } catch { found = null; }
    crop.width = crop.height = 0;
    if (!found?.text || !Number.isFinite(found.baseline)) continue;
    const score = alike(found.text, l.text);
    if (!best || score > best.score) best = { score, found, cx: xA - m, cy: cy0 };
  }
  if (!best || best.score < 0.5) return;
  const { found, cx, cy } = best;
  // Only ever closer in: a row read taller than the piece (big print, with
  // a dark edge of the photo above it) keeps the piece's own place
  const cap = found.baseline - found.top;
  if (!(cap > 0) || cap > l.cap * 1.05) return;
  const x0 = cx + found.left;
  const x1 = cx + found.right;
  const base = cy + found.baseline; // (at its start)
  l.text = tidyAddress(found.text);
  l.x0 = x0;
  l.x1 = x1;
  l.y0 = base;
  l.y1 = base + l.slope * (x1 - x0);
  l.cap = Math.max(2, cap);
  if (Number.isFinite(found.sure)) l.sure = found.sure;
}

// One line of a page, read again on its own: cut from the page as it was
// (not made black on white), its letters drawn about 48px tall (or `size`), read as a
// single line. A second look from another angle: for each line, the reading
// Tesseract is surer of is the one kept. Returns { text, sure } or null.
export async function rereadLine(raw, l, size = 48) {
  const cap = Math.max(4, l.cap);
  const k = Math.max(0.25, Math.min(4, size / cap));
  const top = Math.min(l.y0, l.y1) - cap * 1.6;
  const bottom = Math.max(l.y0, l.y1) + cap * 0.7;
  const x0 = Math.max(0, l.x0 - cap * 0.6);
  const x1 = Math.min(raw.width, l.x1 + cap * 0.6);
  const y0 = Math.max(0, top);
  const y1 = Math.min(raw.height, bottom);
  if (x1 - x0 < 4 || y1 - y0 < 4) return null;
  const pad = Math.round(cap * k * 0.5);
  const crop = document.createElement('canvas');
  crop.width = Math.round((x1 - x0) * k) + 2 * pad;
  crop.height = Math.round((y1 - y0) * k) + 2 * pad;
  const ctx = crop.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, crop.width, crop.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(raw, x0, y0, x1 - x0, y1 - y0, pad, pad, crop.width - 2 * pad, crop.height - 2 * pad);
  try {
    const found = await readLine(crop);
    return found?.text ? { text: found.text, sure: found.sure ?? 0 } : null;
  } finally {
    crop.width = crop.height = 0;
  }
}

// The reading most of a line's readings agree with (the one closest to all
// the others, letter by letter): on faded print each reading gets different
// letters wrong, and how sure Tesseract says it is didn't tell which was
// right — what most readings share usually is. Readings of a different line
// (a neighbour crept into the cut) don't count. Ties go to the surer one.
export function agreedReading(readings) {
  const all = readings.filter(r => r && r.text);
  if (all.length < 3) return all.sort((p, q) => (q.sure ?? 0) - (p.sure ?? 0))[0] || null;
  const same = all.filter(r => alike(r.text, all[0].text) >= 0.4);
  if (same.length < 3) return all[0];
  let best = null;
  for (const r of same) {
    const far = same.reduce((t, o) => (o === r ? t : t + (1 - alike(r.text, o.text))), 0);
    if (!best || far < best.far - 1e-9 || (Math.abs(far - best.far) < 1e-9 && (r.sure ?? 0) > (best.r.sure ?? 0))) best = { r, far };
  }
  return best.r;
}

// Several readings of one line voted on letter by letter: each reading is
// lined up against the one most agree with (agreedReading), and every
// letter (and every gap or extra letter) goes the way most readings go.
// Faded or tiny print gets different letters wrong in each reading
// ("Dade", "Dale", "Date"); a whole reading picked as it stands kept its
// own mistakes. Readings of a different line don't vote.
export function votedReading(readings) {
  const pivot = agreedReading(readings);
  if (!pivot) return null;
  const all = readings.filter(r => r && r.text && (r === pivot || alike(r.text, pivot.text) >= 0.6));
  if (all.length < 3) return pivot;
  const p = pivot.text;
  // For each of the pivot's letters, and each gap before it (and the end),
  // what each reading has there
  const at = Array.from({ length: p.length }, () => new Map());
  const gaps = Array.from({ length: p.length + 1 }, () => new Map());
  const vote = (m, key) => m.set(key, (m.get(key) || 0) + 1);
  for (const r of all) {
    const t = r.text;
    // Edit distance table, then walked back to line t up against p
    const d = Array.from({ length: p.length + 1 }, () => new Uint16Array(t.length + 1));
    for (let i = 0; i <= p.length; i++) d[i][0] = i;
    for (let j = 0; j <= t.length; j++) d[0][j] = j;
    for (let i = 1; i <= p.length; i++) {
      for (let j = 1; j <= t.length; j++) {
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (p[i - 1] === t[j - 1] ? 0 : 1));
      }
    }
    const letter = new Array(p.length).fill('');
    const extra = new Array(p.length + 1).fill('');
    let i = p.length;
    let j = t.length;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (p[i - 1] === t[j - 1] ? 0 : 1)) {
        letter[i - 1] = t[j - 1]; i--; j--;
      } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) {
        letter[i - 1] = ''; i--; // (left out in this reading)
      } else {
        extra[i] = t[j - 1] + extra[i]; j--;
      }
    }
    letter.forEach((c, k) => vote(at[k], c));
    extra.forEach((c, k) => vote(gaps[k], c));
  }
  const best = (m) => [...m.entries()].sort((x, y) => y[1] - x[1])[0][0];
  let text = best(gaps[0]);
  for (let k = 0; k < p.length; k++) text += best(at[k]) + best(gaps[k + 1]);
  text = tidyAddress(tidy(text.replace(/\s+/g, ' ').trim()));
  return text ? { text, sure: pivot.sure } : pivot;
}

// An email header's label put right (pictures of text are mostly Mail's
// printed header): a word one letter off a known label, before its colon,
// is that label ("Ta:" → "To:", "Subgect:" → "Subject:")
const LABELS = ['From', 'Subject', 'Date', 'To', 'Cc', 'Bcc', 'Reply-To', 'Sent'];
const oneOff = (a, b) => {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const rest = (x, y) => x.slice(i + (a.length >= b.length ? 1 : 0)) === y.slice(i + (b.length >= a.length ? 1 : 0));
  return rest(a, b);
};
export function headerLabel(text) {
  const m = /^\s*([A-Za-z-]{2,9})\s*:/.exec(text);
  if (!m) return text;
  const word = m[1].toLowerCase();
  const label = LABELS.find(l => l.toLowerCase() === word) || LABELS.filter(l => l.length > 2 || word.length === 2).find(l => oneOff(l.toLowerCase(), word));
  return label ? text.replace(m[1], label) : text;
}

// An email address as Tesseract reads small print: the "@" comes out as
// "gi", "fi" or "id" glued to the name, or goes missing ("norephnfi google
// cam"), ".com" as " cam", and the mail host a letter or two off ("gmall",
// "gaagle"). Where a known mail host stands before something that reads
// as "com", the address is put back together: the host spelled right,
// ".com" after it, and an "@" before it in place of what was read there (if
// the address has none). Common names in front ("noreply") are put right
// too. Only a known host is touched, so ordinary words stay as read.
const MAIL_HOSTS = ['gmail', 'googlemail', 'google', 'icloud', 'yahoo', 'outlook', 'hotmail', 'proton', 'protonmail', 'apple', 'amazon', 'paypal', 'chase', 'venmo', 'microsoft', 'facebook', 'linkedin'];
const MAIL_NAMES = ['noreply', 'no-reply', 'donotreply', 'do-not-reply', 'support', 'receipts', 'billing'];
const distance = (a, b) => {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  return d[a.length][b.length];
};
// How far off a reading may be: none for short words, more for long ones
const slack = (word) => (word.length >= 6 ? 2 : word.length >= 4 ? 1 : 0);
const closest = (word, list) => {
  const w = word.toLowerCase();
  let best = null;
  list.forEach((name) => {
    const d = distance(w, name);
    if (d <= slack(name) && (!best || d < best.d)) best = { name, d };
  });
  return best?.name || null;
};
const AT_READ = /(?:[gqfy]i|id|[@©®])$/;
export function tidyAddress(text) {
  return text.replace(/(\S*?)( ?)([A-Za-z0-9]{2,})[ .,]{0,2}(c[ao0]m|c[o0]rn|c[o0]n|cem)\b/gi, (all, before, gap, word) => {
    // The host at the end of the word, as long a stretch of it as reads as
    // one (anything glued in front is the end of the name and the "@")
    for (let cut = 0; cut <= word.length - 2; cut++) {
      const host = closest(word.slice(cut), MAIL_HOSTS);
      if (!host) continue;
      // ("To:" and the space after it kept: only the word itself is the address)
      const lead = cut ? before + gap : '';
      const name = cut ? word.slice(0, cut) : before;
      // An "@" only where something was read in its place (glued on, or
      // just before a space): "visit google com" stays two words
      if (!name.includes('@') && AT_READ.test(name)) {
        const fixed = name.replace(AT_READ, '').replace(/([A-Za-z]+)$/, (n) => closest(n, MAIL_NAMES) || n);
        return `${lead}${fixed}@${host}.com`;
      }
      return `${lead}${name}${cut ? '' : gap}${host}.com`;
    }
    return all;
  });
}
