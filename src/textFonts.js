// The fonts a new line can be written in (the add text panel's font menu).
// The three standard PDF fonts need nothing; the rest are free fonts kept
// in /fonts/ (cut down to Latin letters, ~25KB a style), fetched the first
// time they're shown, then shown with FontFace and written into the saved
// PDF with fontkit — so what's on screen is what's saved.

export const TEXT_FONTS = [
  { key: 'auto', label: 'auto', group: null }, // (like the text near it)
  { key: 'sans', label: 'Helvetica', base: 'Helvetica', group: 'sans' },
  { key: 'arimo', label: 'Arial', file: 'Arimo', base: 'Helvetica', group: 'sans' },
  { key: 'inter', label: 'Inter', file: 'Inter', base: 'Helvetica', group: 'sans' },
  { key: 'roboto', label: 'Roboto', file: 'Roboto', base: 'Helvetica', group: 'sans' },
  { key: 'opensans', label: 'Open Sans', file: 'OpenSans', base: 'Helvetica', group: 'sans' },
  { key: 'lato', label: 'Lato', file: 'Lato', base: 'Helvetica', group: 'sans' },
  { key: 'montserrat', label: 'Montserrat', file: 'Montserrat', base: 'Helvetica', group: 'sans' },
  { key: 'poppins', label: 'Poppins', file: 'Poppins', base: 'Helvetica', group: 'sans' },
  { key: 'serif', label: 'Times', base: 'Times', group: 'serif' },
  { key: 'gelasio', label: 'Georgia', file: 'Gelasio', base: 'Times', group: 'serif' },
  { key: 'merriweather', label: 'Merriweather', file: 'Merriweather', base: 'Times', group: 'serif' },
  { key: 'lora', label: 'Lora', file: 'Lora', base: 'Times', group: 'serif' },
  { key: 'playfair', label: 'Playfair', file: 'PlayfairDisplay', base: 'Times', group: 'serif' },
  { key: 'garamond', label: 'Garamond', file: 'EBGaramond', base: 'Times', group: 'serif' },
  { key: 'mono', label: 'Courier', base: 'Courier', group: 'mono' },
  { key: 'robotomono', label: 'Roboto Mono', file: 'RobotoMono', base: 'Courier', group: 'mono' },
  { key: 'sourcecode', label: 'Source Code', file: 'SourceCodePro', base: 'Courier', group: 'mono' },
];
export const fontOf = (key) => TEXT_FONTS.find(f => f.key === key) || null;
// The standard PDF fonts by key
export const FONT_BASES = Object.fromEntries(TEXT_FONTS.filter(f => f.base && !f.file).map(f => [f.key, f.base]));
// (one family per font; its bold and italic as the family's weight / style)
export const faceFamily = (key) => `tbx-${key}`;

const variant = (bold, italic) => `${bold ? 'b' : 'r'}${italic ? 'i' : ''}`;
const loads = new Map(); // `${key}-${variant}` -> Promise<ArrayBuffer | null>

// Every font's plain style, for the menu to show each one in itself: fetched
// and read off the page's way, then added to the page all at once (added
// one by one as the menu popped open, each made the whole page restyle —
// three frames of 130–180ms on a slowed phone). Asked for once.
let preloading = null;
export function preloadTextFonts() {
  if (preloading) return preloading;
  const todo = TEXT_FONTS.filter(f => f.file && !loads.has(`${f.key}-r`));
  preloading = Promise.all(todo.map(async (f) => {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}fonts/${f.file}-r.ttf`);
      if (!res.ok) return null;
      const bytes = await res.arrayBuffer();
      const face = typeof FontFace === 'function' ? new FontFace(faceFamily(f.key), bytes.slice(0), { weight: '400', style: 'normal' }) : null;
      await face?.load();
      return { f, bytes, face };
    } catch {
      return null;
    }
  })).then((got) => {
    got.forEach((g) => {
      if (!g || loads.has(`${g.f.key}-r`)) return;
      if (g.face) document.fonts.add(g.face);
      loads.set(`${g.f.key}-r`, Promise.resolve(g.bytes));
    });
    // Each name laid out once in its font, out of sight: the menu's first
    // open had that to do (a frame of ~70ms), now done while all is still
    const warm = document.createElement('div');
    warm.setAttribute('aria-hidden', 'true');
    warm.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;white-space:nowrap;font-size:0.85rem';
    TEXT_FONTS.filter(f => f.file).forEach((f) => {
      const line = document.createElement('div');
      line.style.fontFamily = `"${faceFamily(f.key)}"`;
      line.textContent = f.label;
      warm.appendChild(line);
    });
    document.body.appendChild(warm);
    void warm.offsetWidth;
    warm.remove();
  });
  return preloading;
}

// A font's file for one style, its face added to the page once (shown in it
// from then on); null when it can't be had (offline before first use)
export function loadTextFont(key, bold = false, italic = false) {
  const font = fontOf(key);
  if (!font?.file) return Promise.resolve(null);
  const id = `${key}-${variant(bold, italic)}`;
  if (!loads.has(id)) {
    const url = `${import.meta.env.BASE_URL}fonts/${font.file}-${variant(bold, italic)}.ttf`;
    loads.set(id, fetch(url)
      .then(res => (res.ok ? res.arrayBuffer() : Promise.reject(new Error('font'))))
      .then(async (bytes) => {
        if (typeof FontFace === 'function') {
          const face = new FontFace(faceFamily(key), bytes.slice(0), { weight: bold ? '700' : '400', style: italic ? 'italic' : 'normal' });
          await face.load();
          document.fonts.add(face);
        }
        return bytes;
      })
      .catch(() => {
        loads.delete(id); // (tried again next time)
        return null;
      }));
  }
  return loads.get(id);
}
