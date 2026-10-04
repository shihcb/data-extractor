// Taking a PDF's own words out of a page, so a change really replaces them.
//
// Covering old words with a patch leaves them in the file (copy, search and
// screen readers still find them) and hides whatever was drawn behind them
// (a shaded row, a rule). Here the page's drawing commands are followed
// (where each run of text starts and ends, from its font's widths) and every
// run that lies wholly inside a changed line is taken out, leaving a blank
// move of the same length so the text after it stays put. A run that only
// partly overlaps, or whose width can't be known, is left alone, and the
// caller falls back to the patch for that line.

const WS = new Set([0, 9, 10, 12, 13, 32]);
const DELIM = new Set([40, 41, 60, 62, 91, 93, 123, 125, 47, 37]);

// The page's commands: [{ op, args, start, end }] (bytes start..end are the
// command with its operands). Inline images are skipped over whole.
export function parseContent(bytes) {
  const ops = [];
  const n = bytes.length;
  let i = 0;
  let args = [];
  const stack = []; // open arrays / dicts
  let start = -1;
  const push = (v) => {
    if (stack.length) stack[stack.length - 1].push(v);
    else args.push(v);
  };
  const keyword = (from) => {
    let j = from;
    while (j < n && !WS.has(bytes[j]) && !DELIM.has(bytes[j])) j++;
    return [String.fromCharCode(...bytes.subarray(from, j)), j];
  };
  while (i < n) {
    const c = bytes[i];
    if (WS.has(c)) { i++; continue; }
    if (c === 37) { // % comment
      while (i < n && bytes[i] !== 10 && bytes[i] !== 13) i++;
      continue;
    }
    if (start < 0) start = i;
    if (c === 40) { // ( literal string )
      const out = [];
      let depth = 1;
      i++;
      while (i < n && depth) {
        const b = bytes[i];
        if (b === 92) { // backslash
          const e = bytes[i + 1];
          const map = { 110: 10, 114: 13, 116: 9, 98: 8, 102: 12, 40: 40, 41: 41, 92: 92 };
          if (e in map) { out.push(map[e]); i += 2; } else if (e >= 48 && e <= 55) {
            let v = 0;
            let k = 0;
            i++;
            while (k < 3 && bytes[i] >= 48 && bytes[i] <= 55) { v = v * 8 + bytes[i] - 48; i++; k++; }
            out.push(v & 255);
          } else if (e === 13 || e === 10) {
            i += 2;
            if (e === 13 && bytes[i] === 10) i++;
          } else { i += 2; if (e !== undefined) out.push(e); }
          continue;
        }
        if (b === 40) depth++;
        if (b === 41) { depth--; if (!depth) { i++; break; } }
        out.push(b);
        i++;
      }
      push({ str: Uint8Array.from(out) });
      continue;
    }
    if (c === 60 && bytes[i + 1] === 60) { stack.push([]); i += 2; continue; } // <<
    if (c === 62 && bytes[i + 1] === 62) { const d = stack.pop(); if (d) push({ dict: d }); i += 2; continue; } // >>
    if (c === 60) { // <hex string>
      let hex = '';
      i++;
      while (i < n && bytes[i] !== 62) { if (!WS.has(bytes[i])) hex += String.fromCharCode(bytes[i]); i++; }
      i++;
      if (hex.length % 2) hex += '0';
      const out = new Uint8Array(hex.length / 2);
      for (let k = 0; k < out.length; k++) out[k] = parseInt(hex.substr(k * 2, 2), 16) || 0;
      push({ str: out });
      continue;
    }
    if (c === 91) { stack.push([]); i++; continue; } // [
    if (c === 93) { const a = stack.pop(); if (a) push(a); i++; continue; } // ]
    if (c === 123 || c === 125) { i++; continue; }
    if (c === 47) { // /Name
      const [name, j] = keyword(i + 1);
      push({ name });
      i = j;
      continue;
    }
    const [word, j] = keyword(i);
    if (!word) { i++; continue; }
    i = j;
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(word)) { push(Number(word)); continue; }
    if (word === 'true' || word === 'false' || word === 'null') { push(word === 'null' ? null : word === 'true'); continue; }
    if (stack.length) { push({ name: word }); continue; } // stray word in an array
    if (word === 'BI') {
      // Inline image: its data runs to "EI" between white space
      let k = i;
      while (k < n && !(WS.has(bytes[k - 1]) && bytes[k] === 73 && bytes[k + 1] === 68 && (k + 2 >= n || WS.has(bytes[k + 2])))) k++;
      k += 3;
      while (k < n && !(WS.has(bytes[k - 1]) && bytes[k] === 69 && bytes[k + 1] === 73 && (k + 2 >= n || WS.has(bytes[k + 2]) || DELIM.has(bytes[k + 2])))) k++;
      i = Math.min(n, k + 2);
      ops.push({ op: 'BI', args: [], start, end: i });
    } else {
      ops.push({ op: word, args, start, end: i });
    }
    args = [];
    start = -1;
  }
  return ops;
}

// Row-vector matrices, as PDF writes them: p' = p × m
const mul = (m, n) => [
  m[0] * n[0] + m[1] * n[2], m[0] * n[1] + m[1] * n[3],
  m[2] * n[0] + m[3] * n[2], m[2] * n[1] + m[3] * n[3],
  m[4] * n[0] + m[5] * n[2] + n[4], m[4] * n[1] + m[5] * n[3] + n[5],
];
const apply = (m, x, y) => [x * m[0] + y * m[2] + m[4], x * m[1] + y * m[3] + m[5]];

// A font's widths (in 1/1000 of its size), per character code, and how many
// bytes each code takes — or null when they can't be known for sure.
function metricsOf(lib, context, fontDict) {
  const { PDFName, PDFArray, PDFNumber } = lib;
  const get = (d, k) => (d ? context.lookup(d.get(PDFName.of(k))) : undefined);
  const num = (v) => (v instanceof PDFNumber ? v.asNumber() : undefined);
  const subtype = get(fontDict, 'Subtype')?.toString();
  if (subtype === '/Type0') {
    const enc = get(fontDict, 'Encoding')?.toString();
    // (vertical writing, Identity-V, moves down its column: not measured here)
    if (enc !== '/Identity-H') return null;
    const desc = get(fontDict, 'DescendantFonts');
    const cid = desc instanceof PDFArray ? context.lookup(desc.get(0)) : null;
    if (!cid) return null;
    const dw = num(get(cid, 'DW')) ?? 1000;
    const widths = new Map();
    const w = get(cid, 'W');
    if (w instanceof PDFArray) {
      const a = w.asArray().map(v => context.lookup(v));
      for (let k = 0; k < a.length;) {
        const first = num(a[k]);
        const next = a[k + 1];
        if (next instanceof PDFArray) {
          next.asArray().forEach((v, m) => widths.set(first + m, num(context.lookup(v)) ?? dw));
          k += 2;
        } else {
          const last = num(next);
          const width = num(a[k + 2]);
          for (let c = first; c <= last; c++) widths.set(c, width);
          k += 3;
        }
      }
    }
    return { bytes: 2, width: (code) => widths.get(code) ?? dw };
  }
  if (subtype === '/Type3') return null; // its own glyph space
  const widthsArr = get(fontDict, 'Widths');
  if (!(widthsArr instanceof PDFArray)) return null; // a standard font: widths not in the file
  const first = num(get(fontDict, 'FirstChar')) ?? 0;
  const list = widthsArr.asArray().map(v => num(context.lookup(v)) ?? 0);
  const missing = num(get(get(fontDict, 'FontDescriptor'), 'MissingWidth')) ?? 0;
  return { bytes: 1, width: (code) => (code >= first && code < first + list.length ? list[code - first] : missing) };
}

const fmt = (v) => (Math.abs(v) < 1e-6 ? '0' : String(Math.round(v * 1000) / 1000));

// Takes the words inside `boxes` out of page `page` (a pdf-lib page). A box:
// { id, x, y, angle, width, size, ascent, descent } in the PDF's units, its
// baseline starting at x, y. Returns the ids whose words all came out
// (nothing else of theirs is left on the page); the rest need a patch.
export function removeText(lib, page, boxes) {
  const { PDFName, PDFArray, PDFDict, PDFRawStream, decodePDFRawStream } = lib;
  const clean = new Set();
  if (!boxes.length) return clean;
  const context = page.doc.context;
  const node = page.node;
  const contents = context.lookup(node.get(PDFName.of('Contents')));
  const streams = contents instanceof PDFArray ? contents.asArray().map(r => context.lookup(r)) : [contents];
  if (!streams.length || streams.some(s => !(s instanceof PDFRawStream))) return clean;
  const parts = streams.map(s => decodePDFRawStream(s).decode());
  const total = parts.reduce((t, p) => t + p.length + 1, 0);
  const bytes = new Uint8Array(total);
  let at = 0;
  parts.forEach((p) => { bytes.set(p, at); at += p.length; bytes[at++] = 10; });

  const resources = node.Resources();
  const fontsDict = resources ? context.lookup(resources.get(PDFName.of('Font'))) : null;
  const metrics = new Map();
  const metricsFor = (name) => {
    if (!metrics.has(name)) {
      const ref = fontsDict instanceof PDFDict ? fontsDict.get(PDFName.of(name)) : null;
      const dict = ref ? context.lookup(ref) : null;
      let m = null;
      try { m = dict ? metricsOf(lib, context, dict) : null; } catch { m = null; }
      metrics.set(name, m);
    }
    return metrics.get(name);
  };

  // Each box's own frame: how far along its baseline, and how far up from it
  const frames = boxes.map((b) => {
    const cos = Math.cos(b.angle || 0);
    const sin = Math.sin(b.angle || 0);
    const tol = b.size * 0.35;
    return {
      b,
      local: (p) => { const dx = p[0] - b.x; const dy = p[1] - b.y; return [dx * cos + dy * sin, -dx * sin + dy * cos]; },
      // A run's ends sit on its baseline: on this line's own, not just within
      // its height (the line above's baseline can be that close)
      inside: ([along, up]) => along >= -tol && along <= b.width + tol && Math.abs(up) <= b.size * 0.3,
      // How much of its baseline the taken-out runs cover, and whether any
      // run of text there had to stay
      covered: [],
      kept: false,
    };
  });

  let ctm = [1, 0, 0, 1, 0, 0];
  let ts = { Tc: 0, Tw: 0, Th: 1, TL: 0, font: null, size: 0, rise: 0 };
  // After a run whose width couldn't be known, where the next one starts
  // isn't known either (until the position is set again): nothing's cut then
  let lost = false;
  const saved = [];
  let tm = [1, 0, 0, 1, 0, 0];
  let tlm = [1, 0, 0, 1, 0, 0];
  const cuts = []; // { start, end, text }

  const nextLine = (tx, ty) => { tlm = mul([1, 0, 0, 1, tx, ty], tlm); tm = tlm; lost = false; };

  // Follows one run of text; returns how far it moved (text space, already
  // times the horizontal scale), or null when its width can't be known
  const advanceOf = (parts) => {
    const m = metricsFor(ts.font);
    if (!m) return null;
    let tx = 0;
    for (const part of parts) {
      if (typeof part === 'number') { tx -= (part / 1000) * ts.size * ts.Th; continue; }
      if (!part || !part.str) continue;
      const s = part.str;
      for (let k = 0; k + m.bytes <= s.length; k += m.bytes) {
        const code = m.bytes === 2 ? (s[k] << 8) | s[k + 1] : s[k];
        const space = m.bytes === 1 && code === 32 ? ts.Tw : 0;
        tx += ((m.width(code) / 1000) * ts.size + ts.Tc + space) * ts.Th;
      }
    }
    return tx;
  };

  // One run: taken out when it lies wholly inside a box
  const show = (o, parts, lead) => {
    const trm = mul(tm, ctm);
    // (raised or lowered text — a superscript — sits off the baseline)
    const from = apply(trm, 0, ts.rise);
    const tx = advanceOf(parts);
    const hits = (p) => frames.filter(f => f.inside(f.local(p)));
    if (tx === null || lost) {
      hits(from).forEach((f) => { f.kept = true; });
      if (tx === null) lost = true;
      else tm = mul([1, 0, 0, 1, tx, 0], tm);
      return;
    }
    const to = apply(trm, tx, ts.rise);
    tm = mul([1, 0, 0, 1, tx, 0], tm);
    // Only a run of the line's own size, starting and ending within it: a
    // short run just past its end (a bold "*", a footnote mark) is another
    // line's, however close
    const size = ts.size * Math.hypot(trm[2], trm[3]);
    const within = (f) => {
      const a = f.local(from)[0];
      const z = f.local(to)[0];
      const edge = f.b.size * 0.1;
      return Math.abs(size - f.b.size) <= f.b.size * 0.08 && Math.min(a, z) < f.b.width - edge && Math.max(a, z) > edge;
    };
    const both = hits(from).filter(f => f.inside(f.local(to)) && within(f));
    const hasText = parts.some(p => p && p.str && p.str.length);
    if (!both.length || !hasText || !(ts.size * ts.Th)) {
      // A run reaching into a box from outside it stays: that box needs a patch
      frames.forEach((f) => {
        const a = f.local(from);
        const z = f.local(to);
        const lo = Math.min(a[0], z[0]);
        const hi = Math.max(a[0], z[0]);
        const up = (a[1] + z[1]) / 2;
        if (hasText && hi > f.b.size * 0.15 && lo < f.b.width - f.b.size * 0.15 && up > f.b.descent * f.b.size && up < f.b.ascent * f.b.size) f.kept = true;
      });
      return;
    }
    const f = both[0];
    const a = f.local(from)[0];
    const z = f.local(to)[0];
    f.covered.push([Math.min(a, z), Math.max(a, z)]);
    // A blank move of the same length keeps everything after it in place
    const move = `[${fmt((-tx * 1000) / (ts.size * ts.Th))}] TJ`;
    cuts.push({ start: o.start, end: o.end, text: `${lead}${move}` });
  };

  for (const o of parseContent(bytes)) {
    const a = o.args;
    switch (o.op) {
      case 'q': saved.push({ ctm, ts: { ...ts } }); break;
      case 'Q': { const s = saved.pop(); if (s) { ctm = s.ctm; ts = s.ts; } break; }
      case 'cm': if (a.length === 6 && a.every(v => typeof v === 'number')) ctm = mul(a, ctm); break;
      case 'BT': tm = [1, 0, 0, 1, 0, 0]; tlm = tm; lost = false; break;
      case 'Tf': ts.font = a[0]?.name ?? null; ts.size = typeof a[1] === 'number' ? a[1] : 0; break;
      case 'Tc': ts.Tc = a[0] || 0; break;
      case 'Tw': ts.Tw = a[0] || 0; break;
      case 'Tz': ts.Th = (a[0] ?? 100) / 100; break;
      case 'TL': ts.TL = a[0] || 0; break;
      case 'Td': nextLine(a[0] || 0, a[1] || 0); break;
      case 'TD': ts.TL = -(a[1] || 0); nextLine(a[0] || 0, a[1] || 0); break;
      case 'Tm': if (a.length === 6) { tlm = a.slice(); tm = tlm; lost = false; } break;
      case 'Ts': ts.rise = a[0] || 0; break;
      case 'T*': nextLine(0, -ts.TL); break;
      case 'Tj': show(o, [a[0]], ''); break;
      case 'TJ': show(o, Array.isArray(a[0]) ? a[0] : [], ''); break;
      case "'": nextLine(0, -ts.TL); show(o, [a[0]], 'T* '); break;
      case '"':
        ts.Tw = a[0] || 0;
        ts.Tc = a[1] || 0;
        nextLine(0, -ts.TL);
        show(o, [a[2]], `${fmt(ts.Tw)} Tw ${fmt(ts.Tc)} Tc T* `);
        break;
      default: break;
    }
  }

  // Which boxes came out whole: their runs cover the baseline, nothing stayed
  frames.forEach((f) => {
    if (f.kept || !f.covered.length) return;
    const spans = f.covered.sort((p, q) => p[0] - q[0]);
    let reach = 0;
    let gap = 0;
    for (const [lo, hi] of spans) {
      if (lo > reach) gap += lo - reach;
      reach = Math.max(reach, hi);
    }
    gap += Math.max(0, f.b.width - reach);
    if (gap <= f.b.width * 0.08 + f.b.size * 0.5) clean.add(f.b.id);
  });
  if (!cuts.length) return clean;

  // The page's commands again, with those runs swapped for their blank moves
  const enc = new TextEncoder();
  const out = [];
  let from = 0;
  cuts.sort((p, q) => p.start - q.start).forEach((c) => {
    out.push(bytes.subarray(from, c.start), enc.encode(` ${c.text} `));
    from = c.end;
  });
  out.push(bytes.subarray(from));
  const size = out.reduce((t, p) => t + p.length, 0);
  const joined = new Uint8Array(size);
  let k = 0;
  out.forEach((p) => { joined.set(p, k); k += p.length; });
  const stream = context.flateStream(joined);
  node.set(PDFName.of('Contents'), context.register(stream));
  return clean;
}
