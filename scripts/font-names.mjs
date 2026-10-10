// Writes src/fontNames.js: each add-text font's name drawn in that font, as
// an SVG path (letters outlined with fontkit). The font menu shows these, so
// opening it needs none of the fonts themselves (fetching and adding 14 to
// the page restyled it — ~300ms on a slowed phone). Run after changing the
// fonts or their names: `node scripts/font-names.mjs`.
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const fontkit = require('@pdf-lib/fontkit');
const src = fs.readFileSync(new URL('../src/textFonts.js', import.meta.url), 'utf8');
const list = [...src.matchAll(/key: '([a-z]+)', label: '([^']+)', file: '([A-Za-z]+)'/g)].map(m => ({ key: m[1], label: m[2], file: m[3] }));
const out = {};
for (const f of list) {
  const font = fontkit.create(fs.readFileSync(new URL(`../public/fonts/${f.file}-r.ttf`, import.meta.url)));
  const run = font.layout(f.label);
  const scale = 100 / font.unitsPerEm; // (in hundredths of an em: whole numbers)
  let x = 0;
  const parts = [];
  run.glyphs.forEach((g, i) => {
    const pos = run.positions[i];
    const path = g.path.scale(scale, -scale).translate((x + pos.xOffset) * scale, 0);
    parts.push(path.toSVG());
    x += pos.xAdvance;
  });
  const round = (d) => d.replace(/-?\d+(\.\d+)?(e-?\d+)?/g, n => String(Math.round(parseFloat(n)))).replace(/ -/g, '-');
  out[f.key] = { d: round(parts.join('')), w: Math.round(x * scale), a: Math.round(font.ascent * scale), h: Math.round((font.ascent - font.descent) * scale) };
}
fs.writeFileSync(new URL('../src/fontNames.js', import.meta.url), `// Made by scripts/font-names.mjs — each font's name drawn in itself (SVG
// path in hundredths of an em: w wide, the baseline a below the top, h tall).
export default ${JSON.stringify(out)};
`);
console.log(Object.keys(out).length, 'names,', fs.statSync(new URL('../src/fontNames.js', import.meta.url)).size, 'bytes');
