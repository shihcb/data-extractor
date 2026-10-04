import * as lib from 'pdf-lib';
import fs from 'fs';
const doc = await lib.PDFDocument.load(fs.readFileSync(process.argv[2]));
const p = doc.getPage(0);
const c = p.node.Contents();
const ss = c instanceof lib.PDFArray ? c.asArray().map(r => doc.context.lookup(r)) : [c];
const t = ss.map(s => Buffer.from(lib.decodePDFRawStream(s).decode()).toString('latin1')).join('\n');
console.log(t.slice(0, 2500));
