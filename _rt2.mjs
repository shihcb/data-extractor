import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import * as lib from 'pdf-lib';
import fs from 'fs';
import { execSync } from 'child_process';
import { PNG } from 'pngjs';
import { removeText } from './src/pdfText.js';
const [file, S] = process.argv.slice(2);
const bytes = fs.readFileSync(file);
const d = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;
const doc = await lib.PDFDocument.load(bytes);
const pages = Math.min(d.numPages, 3);
const all = []; let cleanN = 0, tried = 0;
for (let n = 1; n <= pages; n++) {
  const pg = await d.getPage(n); const tc = await pg.getTextContent();
  const items = tc.items.filter(i => i.str.trim());
  const [M, R] = (process.env.PAT || "3,1").split(",").map(Number); const pick = items.filter((_, k) => k % M === R);
  const boxes = pick.map((it, k) => { const [a, b, c, dd, e, f] = it.transform; const st = tc.styles[it.fontName]; return { id: k, x: e, y: f, angle: Math.atan2(b, a), width: it.width, size: Math.hypot(c, dd), ascent: st.ascent || 0.8, descent: st.descent || -0.2, str: it.str }; });
  const clean = removeText(lib, doc.getPage(n - 1), boxes);
  tried += boxes.length; cleanN += clean.size;
  all.push({ n, items, boxes, clean, vp: pg.getViewport({ scale: 1 }) });
}
const out = S + '/rt2.pdf';
fs.writeFileSync(out, await doc.save());
const d2 = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(out)) }).promise;
let problems = [];
for (const { n, items, boxes, clean, vp } of all) {
  const tc2 = await (await d2.getPage(n)).getTextContent();
  const left = tc2.items.filter(i => i.str.trim()).map(i => i.str + '@' + i.transform.slice(4).map(v => Math.round(v)).join(','));
  const leftSet = new Set(left);
  const removed = new Set(boxes.filter(b => clean.has(b.id)).map(b => b.str + '@' + [b.x, b.y].map(v => Math.round(v)).join(',')));
  for (const it of items) {
    const key = it.str + '@' + it.transform.slice(4).map(v => Math.round(v)).join(',');
    if (removed.has(key)) { if (leftSet.has(key)) problems.push(`p${n} still there: ${it.str}`); }
    else if (!leftSet.has(key)) problems.push(`p${n} lost/moved: ${it.str.slice(0, 40)}`);
  }
  // pixels outside removed boxes unchanged
  const r = 72;
  execSync(`pdftoppm -r ${r} -f ${n} -l ${n} -png ${file} ${S}/ra && pdftoppm -r ${r} -f ${n} -l ${n} -png ${out} ${S}/rb`);
  const fa = fs.readdirSync(S).find(f => f.startsWith('ra-')); const fb = fs.readdirSync(S).find(f => f.startsWith('rb-'));
  const A = PNG.sync.read(fs.readFileSync(S + '/' + fa)); const B = PNG.sync.read(fs.readFileSync(S + '/' + fb));
  fs.unlinkSync(S + '/' + fa); fs.unlinkSync(S + '/' + fb);
  const sc = r / 72; const H = vp.viewBox[3];
  const rects = boxes.filter(b => clean.has(b.id)).map(b => ({ x0: (b.x - b.size) * sc, x1: (b.x + b.width + b.size) * sc, y0: (H - b.y - b.ascent * b.size - b.size * 0.6) * sc, y1: (H - b.y - b.descent * b.size + b.size * 0.6) * sc }));
  let bad = 0;
  for (let y = 0; y < A.height; y++) for (let x = 0; x < A.width; x++) {
    if (rects.some(q => x >= q.x0 && x <= q.x1 && y >= q.y0 && y <= q.y1)) continue;
    const k = (y * A.width + x) * 4;
    if (Math.abs(A.data[k] - B.data[k]) + Math.abs(A.data[k + 1] - B.data[k + 1]) + Math.abs(A.data[k + 2] - B.data[k + 2]) > 60) bad++;
  }
  if (bad > 4) problems.push(`p${n}: ${bad} pixels changed outside removed boxes`);
}
console.log(file.split('/').pop(), `clean ${cleanN}/${tried}`, problems.length ? problems.slice(0, 8) : 'OK');
