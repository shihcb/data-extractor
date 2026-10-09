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
