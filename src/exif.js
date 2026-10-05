// A photo's details (EXIF: the camera, the lens, when, where) read and
// written straight in the file, so the picture itself is never redrawn.
// JPG keeps them in an APP1 block, PNG in an eXIf chunk, WEBP in an EXIF
// chunk; inside each is the same TIFF-style list of tags.
//
// Tags are kept as their raw bytes (in the file's own byte order) so
// anything not changed goes back exactly as it was: the maker's own notes
// (Apple's lens and HDR data), tags this file doesn't know, the preview.

// Bytes per value of each TIFF type: 1 BYTE, 2 ASCII, 3 SHORT, 4 LONG,
// 5 RATIONAL, 6 SBYTE, 7 UNDEFINED, 8 SSHORT, 9 SLONG, 10 SRATIONAL,
// 11 FLOAT, 12 DOUBLE
const TYPE_SIZE = [0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8, 4, 8];
const BYTE = 1, ASCII = 2, SHORT = 3, LONG = 4, RATIONAL = 5, UNDEFINED = 7, SRATIONAL = 10;

const EXIF_PTR = 0x8769;
const GPS_PTR = 0x8825;
const INTEROP_PTR = 0xA005;
const THUMB_AT = 0x0201;
const THUMB_LEN = 0x0202;
// Offsets to picture data elsewhere in a TIFF file: meaningless once moved
const DROPPED = new Set([0x0111, 0x0117, 0x014A, 0x0144, 0x0145]);

// ── The TIFF block ───────────────────────────────────────────────

export function parseTiff(buf) {
  if (!buf || buf.length < 8) return null;
  const little = buf[0] === 0x49 && buf[1] === 0x49;
  if (!little && !(buf[0] === 0x4D && buf[1] === 0x4D)) return null;
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const u16 = (o) => dv.getUint16(o, little);
  const u32 = (o) => dv.getUint32(o, little);
  if (u16(2) !== 42) return null;
  const seen = new Set();

  const readIfd = (off) => {
    const tags = new Map();
    if (!off || off + 2 > buf.length || seen.has(off)) return { tags, next: 0 };
    seen.add(off);
    const n = u16(off);
    for (let i = 0; i < n; i++) {
      const e = off + 2 + i * 12;
      if (e + 12 > buf.length) break;
      const tag = u16(e);
      const type = u16(e + 2);
      const count = u32(e + 4);
      const size = (TYPE_SIZE[type] || 0) * count;
      if (!TYPE_SIZE[type] || size > buf.length) continue;
      const at = size <= 4 ? e + 8 : u32(e + 8);
      if (at + size > buf.length) continue;
      tags.set(tag, { type, count, raw: buf.slice(at, at + size) });
    }
    const end = off + 2 + n * 12;
    return { tags, next: end + 4 <= buf.length ? u32(end) : 0 };
  };
  const ptr = (tags, tag) => {
    const e = tags.get(tag);
    tags.delete(tag);
    if (!e || e.raw.length < 4) return 0;
    return new DataView(e.raw.buffer, e.raw.byteOffset, 4).getUint32(0, little);
  };

  const first = readIfd(u32(4));
  const ifd0 = first.tags;
  const exif = readIfd(ptr(ifd0, EXIF_PTR)).tags;
  const interop = readIfd(ptr(exif, INTEROP_PTR)).tags;
  const gps = readIfd(ptr(ifd0, GPS_PTR)).tags;
  const ifd1 = readIfd(first.next).tags;
  // The small preview (IFD1), kept only when it's a JPEG of its own
  let thumb = null;
  const at = ptr(ifd1, THUMB_AT);
  const len = ptr(ifd1, THUMB_LEN);
  if (at && len && at + len <= buf.length) thumb = buf.slice(at, at + len);
  [ifd0, exif, ifd1].forEach(m => DROPPED.forEach(t => m.delete(t)));
  return { little, ifd0, exif, gps, interop, ifd1: thumb ? ifd1 : new Map(), thumb };
}

const u32Raw = (v, little) => {
  const raw = new Uint8Array(4);
  new DataView(raw.buffer).setUint32(0, v, little);
  return raw;
};

// The tags back into one TIFF block (null when there's nothing left)
export function writeTiff(t) {
  const { little } = t;
  const ifd0 = new Map(t.ifd0);
  const exif = new Map(t.exif);
  const gps = new Map(t.gps);
  const interop = new Map(t.interop);
  const ifd1 = t.thumb ? new Map(t.ifd1) : new Map();
  const ptrEntry = () => ({ type: LONG, count: 1, raw: new Uint8Array(4) });
  if (interop.size) exif.set(INTEROP_PTR, ptrEntry());
  if (exif.size) ifd0.set(EXIF_PTR, ptrEntry());
  if (gps.size) ifd0.set(GPS_PTR, ptrEntry());
  if (t.thumb) {
    ifd1.set(THUMB_AT, ptrEntry());
    ifd1.set(THUMB_LEN, { type: LONG, count: 1, raw: u32Raw(t.thumb.length, little) });
  }
  if (!ifd0.size && !ifd1.size) return null;

  const pad = (n) => n + (n & 1);
  const sizeOf = (m) => 6 + 12 * m.size + [...m.values()].reduce((s, e) => s + (e.raw.length > 4 ? pad(e.raw.length) : 0), 0);
  // In order: IFD0, Exif, Interop, GPS, IFD1, the preview's bytes
  const blocks = [['ifd0', ifd0], ['exif', exif], ['interop', interop], ['gps', gps], ['ifd1', ifd1]].filter(([, m]) => m.size);
  const at = {};
  let off = 8;
  blocks.forEach(([k, m]) => { at[k] = off; off += sizeOf(m); });
  const thumbAt = off;
  if (t.thumb) off += t.thumb.length;

  if (at.exif) ifd0.set(EXIF_PTR, { type: LONG, count: 1, raw: u32Raw(at.exif, little) });
  if (at.gps) ifd0.set(GPS_PTR, { type: LONG, count: 1, raw: u32Raw(at.gps, little) });
  if (at.interop) exif.set(INTEROP_PTR, { type: LONG, count: 1, raw: u32Raw(at.interop, little) });
  if (t.thumb) ifd1.set(THUMB_AT, { type: LONG, count: 1, raw: u32Raw(thumbAt, little) });

  const out = new Uint8Array(off);
  const dv = new DataView(out.buffer);
  out[0] = out[1] = little ? 0x49 : 0x4D;
  dv.setUint16(2, 42, little);
  dv.setUint32(4, 8, little);
  blocks.forEach(([k, m]) => {
    const start = at[k];
    const entries = [...m.entries()].sort((a, b) => a[0] - b[0]);
    dv.setUint16(start, entries.length, little);
    let data = start + 2 + entries.length * 12 + 4;
    entries.forEach(([tag, e], i) => {
      const p = start + 2 + i * 12;
      dv.setUint16(p, tag, little);
      dv.setUint16(p + 2, e.type, little);
      dv.setUint32(p + 4, e.count, little);
      if (e.raw.length <= 4) {
        out.set(e.raw, p + 8);
      } else {
        dv.setUint32(p + 8, data, little);
        out.set(e.raw, data);
        data += pad(e.raw.length);
      }
    });
    const nextAt = start + 2 + entries.length * 12;
    dv.setUint32(nextAt, k === 'ifd0' && at.ifd1 ? at.ifd1 : 0, little);
  });
  if (t.thumb) out.set(t.thumb, thumbAt);
  return out;
}

// ── Values ───────────────────────────────────────────────────────

const view = (raw) => new DataView(raw.buffer, raw.byteOffset, raw.byteLength);

function numbers(e, little) {
  const dv = view(e.raw);
  const out = [];
  for (let i = 0; i < e.count; i++) {
    switch (e.type) {
      case 1: case 7: out.push(dv.getUint8(i)); break;
      case 6: out.push(dv.getInt8(i)); break;
      case 3: out.push(dv.getUint16(i * 2, little)); break;
      case 8: out.push(dv.getInt16(i * 2, little)); break;
      case 4: out.push(dv.getUint32(i * 4, little)); break;
      case 9: out.push(dv.getInt32(i * 4, little)); break;
      case 5: out.push([dv.getUint32(i * 8, little), dv.getUint32(i * 8 + 4, little)]); break;
      case 10: out.push([dv.getInt32(i * 8, little), dv.getInt32(i * 8 + 4, little)]); break;
      case 11: out.push(dv.getFloat32(i * 4, little)); break;
      case 12: out.push(dv.getFloat64(i * 8, little)); break;
      default: break;
    }
  }
  return out;
}

function encodeNumbers(type, values, little) {
  const raw = new Uint8Array(TYPE_SIZE[type] * values.length);
  const dv = view(raw);
  values.forEach((v, i) => {
    switch (type) {
      case 1: case 7: dv.setUint8(i, v); break;
      case 6: dv.setInt8(i, v); break;
      case 3: dv.setUint16(i * 2, v, little); break;
      case 8: dv.setInt16(i * 2, v, little); break;
      case 4: dv.setUint32(i * 4, v, little); break;
      case 9: dv.setInt32(i * 4, v, little); break;
      case 5: dv.setUint32(i * 8, v[0], little); dv.setUint32(i * 8 + 4, v[1], little); break;
      case 10: dv.setInt32(i * 8, v[0], little); dv.setInt32(i * 8 + 4, v[1], little); break;
      case 11: dv.setFloat32(i * 4, v, little); break;
      case 12: dv.setFloat64(i * 8, v, little); break;
      default: break;
    }
  });
  return { type, count: values.length, raw };
}

// Text is meant to be plain ASCII, but phones write UTF-8 (accents, emoji)
function decodeText(bytes) {
  let end = bytes.indexOf(0);
  if (end < 0) end = bytes.length;
  const b = bytes.subarray(0, end);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(b);
  } catch {
    return String.fromCharCode(...b);
  }
}
const encodeText = (s) => {
  const b = new TextEncoder().encode(s);
  const raw = new Uint8Array(b.length + 1);
  raw.set(b);
  return { type: ASCII, count: raw.length, raw };
};

const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
// "1/120", "0.5", "28" → [num, den]
function toRational(s, signed) {
  const max = signed ? 0x7FFFFFFF : 0xFFFFFFFF;
  const m = String(s).trim().match(/^(-?\d+)\s*\/\s*(\d+)$/);
  if (m) {
    const n = Number(m[1]);
    const d = Number(m[2]);
    if (!d || (!signed && n < 0) || Math.abs(n) > max || d > max) return null;
    return [n, d];
  }
  const x = Number(s);
  if (!Number.isFinite(x) || (!signed && x < 0)) return null;
  for (let d = 1; d <= 1e6; d *= 10) {
    const n = Math.round(x * d);
    if (Math.abs(n) > max) break;
    if (Math.abs(n / d - x) < 1e-9 || d === 1e6) {
      const g = gcd(n, d) || 1;
      return [n / g, d / g];
    }
  }
  return Math.abs(x) <= max ? [Math.round(x), 1] : null;
}
const trimNum = (x, places = 4) => String(Number(x.toFixed(places)));
const ratio = ([n, d]) => (d ? n / d : 0);

// ── The fields shown ─────────────────────────────────────────────

// Each field: where its tag lives, its type, and how it's shown.
// kind: text, date (EXIF's "YYYY:MM:DD HH:MM:SS"), int, rational,
// exposure (shown 1/120), select, comment, xp (Windows' UTF-16 text),
// version (four characters), raw (kept or removed, not edited).
// `always`: shown even when the photo hasn't got it, ready to fill in.
const ORIENTATION = [
  [1, 'upright'], [2, 'mirrored'], [3, 'upside down'], [4, 'upside down, mirrored'],
  [6, 'turned right'], [8, 'turned left'], [5, 'turned left, mirrored'], [7, 'turned right, mirrored'],
];
export const FIELDS = [
  { id: 'make', ifd: 'ifd0', tag: 0x010F, type: ASCII, kind: 'text', group: 'camera', label: 'make', always: true, hint: 'Apple' },
  { id: 'model', ifd: 'ifd0', tag: 0x0110, type: ASCII, kind: 'text', group: 'camera', label: 'model', always: true, hint: 'iPhone 17 Pro Max' },
  { id: 'lensMake', ifd: 'exif', tag: 0xA433, type: ASCII, kind: 'text', group: 'camera', label: 'lens make', always: true },
  { id: 'lensModel', ifd: 'exif', tag: 0xA434, type: ASCII, kind: 'text', group: 'camera', label: 'lens', always: true },
  { id: 'software', ifd: 'ifd0', tag: 0x0131, type: ASCII, kind: 'text', group: 'camera', label: 'software', always: true },
  { id: 'host', ifd: 'ifd0', tag: 0x013C, type: ASCII, kind: 'text', group: 'camera', label: 'computer' },
  { id: 'owner', ifd: 'exif', tag: 0xA430, type: ASCII, kind: 'text', group: 'camera', label: 'camera owner' },
  { id: 'serial', ifd: 'exif', tag: 0xA431, type: ASCII, kind: 'text', group: 'camera', label: 'serial number' },
  { id: 'lensSerial', ifd: 'exif', tag: 0xA435, type: ASCII, kind: 'text', group: 'camera', label: 'lens serial' },
  { id: 'lensSpec', ifd: 'exif', tag: 0xA432, type: RATIONAL, kind: 'rational', group: 'camera', label: 'lens range' },

  { id: 'taken', ifd: 'exif', tag: 0x9003, type: ASCII, kind: 'date', group: 'date', label: 'taken', always: true },
  { id: 'digitized', ifd: 'exif', tag: 0x9004, type: ASCII, kind: 'date', group: 'date', label: 'digitized', always: true },
  { id: 'modified', ifd: 'ifd0', tag: 0x0132, type: ASCII, kind: 'date', group: 'date', label: 'modified', always: true },
  { id: 'tzTaken', ifd: 'exif', tag: 0x9011, type: ASCII, kind: 'text', group: 'date', label: 'time zone', always: true, hint: '+01:00' },
  { id: 'tzDigitized', ifd: 'exif', tag: 0x9012, type: ASCII, kind: 'text', group: 'date', label: 'zone digitized' },
  { id: 'tzModified', ifd: 'exif', tag: 0x9010, type: ASCII, kind: 'text', group: 'date', label: 'zone modified' },
  { id: 'subsec', ifd: 'exif', tag: 0x9290, type: ASCII, kind: 'text', group: 'date', label: 'subseconds' },
  { id: 'subsecTaken', ifd: 'exif', tag: 0x9291, type: ASCII, kind: 'text', group: 'date', label: 'subsec taken' },
  { id: 'subsecDigitized', ifd: 'exif', tag: 0x9292, type: ASCII, kind: 'text', group: 'date', label: 'subsec digitized' },

  { id: 'lat', ifd: 'gps', kind: 'lat', group: 'location', label: 'latitude', always: true, hint: '51.5007' },
  { id: 'lon', ifd: 'gps', kind: 'lon', group: 'location', label: 'longitude', always: true, hint: '-0.1246' },
  { id: 'alt', ifd: 'gps', kind: 'alt', group: 'location', label: 'altitude m', always: true },

  { id: 'artist', ifd: 'ifd0', tag: 0x013B, type: ASCII, kind: 'text', group: 'people', label: 'artist', always: true },
  { id: 'copyright', ifd: 'ifd0', tag: 0x8298, type: ASCII, kind: 'text', group: 'people', label: 'copyright', always: true },
  { id: 'description', ifd: 'ifd0', tag: 0x010E, type: ASCII, kind: 'text', group: 'people', label: 'description', always: true },
  { id: 'comment', ifd: 'exif', tag: 0x9286, type: UNDEFINED, kind: 'comment', group: 'people', label: 'comment' },
  { id: 'xpTitle', ifd: 'ifd0', tag: 0x9C9B, type: BYTE, kind: 'xp', group: 'people', label: 'title' },
  { id: 'xpComment', ifd: 'ifd0', tag: 0x9C9C, type: BYTE, kind: 'xp', group: 'people', label: 'comments' },
  { id: 'xpAuthor', ifd: 'ifd0', tag: 0x9C9D, type: BYTE, kind: 'xp', group: 'people', label: 'authors' },
  { id: 'xpKeywords', ifd: 'ifd0', tag: 0x9C9E, type: BYTE, kind: 'xp', group: 'people', label: 'tags' },
  { id: 'xpSubject', ifd: 'ifd0', tag: 0x9C9F, type: BYTE, kind: 'xp', group: 'people', label: 'subject' },
  { id: 'uniqueId', ifd: 'exif', tag: 0xA420, type: ASCII, kind: 'text', group: 'people', label: 'image id' },

  { id: 'exposure', ifd: 'exif', tag: 0x829A, type: RATIONAL, kind: 'exposure', group: 'shot', label: 'shutter s' },
  { id: 'fnumber', ifd: 'exif', tag: 0x829D, type: RATIONAL, kind: 'rational', group: 'shot', label: 'f-number' },
  { id: 'iso', ifd: 'exif', tag: 0x8827, type: SHORT, kind: 'int', group: 'shot', label: 'ISO' },
  { id: 'focal', ifd: 'exif', tag: 0x920A, type: RATIONAL, kind: 'rational', group: 'shot', label: 'focal mm' },
  { id: 'focal35', ifd: 'exif', tag: 0xA405, type: SHORT, kind: 'int', group: 'shot', label: 'focal 35mm' },
  { id: 'bias', ifd: 'exif', tag: 0x9204, type: SRATIONAL, kind: 'rational', group: 'shot', label: 'exposure bias' },
  { id: 'program', ifd: 'exif', tag: 0x8822, type: SHORT, kind: 'select', group: 'shot', label: 'program', options: [[0, 'not set'], [1, 'manual'], [2, 'normal'], [3, 'aperture priority'], [4, 'shutter priority'], [5, 'creative'], [6, 'action'], [7, 'portrait'], [8, 'landscape']] },
  { id: 'metering', ifd: 'exif', tag: 0x9207, type: SHORT, kind: 'select', group: 'shot', label: 'metering', options: [[0, 'unknown'], [1, 'average'], [2, 'center weighted'], [3, 'spot'], [4, 'multi-spot'], [5, 'pattern'], [6, 'partial'], [255, 'other']] },
  { id: 'flash', ifd: 'exif', tag: 0x9209, type: SHORT, kind: 'int', group: 'shot', label: 'flash' },
  { id: 'whiteBalance', ifd: 'exif', tag: 0xA403, type: SHORT, kind: 'select', group: 'shot', label: 'white balance', options: [[0, 'auto'], [1, 'manual']] },
  { id: 'exposureMode', ifd: 'exif', tag: 0xA402, type: SHORT, kind: 'select', group: 'shot', label: 'exposure mode', options: [[0, 'auto'], [1, 'manual'], [2, 'auto bracket']] },
  { id: 'scene', ifd: 'exif', tag: 0xA406, type: SHORT, kind: 'select', group: 'shot', label: 'scene', options: [[0, 'standard'], [1, 'landscape'], [2, 'portrait'], [3, 'night']] },
  { id: 'shutterValue', ifd: 'exif', tag: 0x9201, type: SRATIONAL, kind: 'rational', group: 'shot', label: 'shutter value' },
  { id: 'apertureValue', ifd: 'exif', tag: 0x9202, type: RATIONAL, kind: 'rational', group: 'shot', label: 'aperture value' },
  { id: 'brightness', ifd: 'exif', tag: 0x9203, type: SRATIONAL, kind: 'rational', group: 'shot', label: 'brightness' },

  { id: 'orientation', ifd: 'ifd0', tag: 0x0112, type: SHORT, kind: 'select', group: 'image', label: 'orientation', options: ORIENTATION },
  { id: 'width', ifd: 'exif', tag: 0xA002, type: LONG, kind: 'int', group: 'image', label: 'width px' },
  { id: 'height', ifd: 'exif', tag: 0xA003, type: LONG, kind: 'int', group: 'image', label: 'height px' },
  { id: 'xres', ifd: 'ifd0', tag: 0x011A, type: RATIONAL, kind: 'rational', group: 'image', label: 'x resolution' },
  { id: 'yres', ifd: 'ifd0', tag: 0x011B, type: RATIONAL, kind: 'rational', group: 'image', label: 'y resolution' },
  { id: 'resUnit', ifd: 'ifd0', tag: 0x0128, type: SHORT, kind: 'select', group: 'image', label: 'resolution unit', options: [[1, 'none'], [2, 'inch'], [3, 'cm']] },
  { id: 'colorSpace', ifd: 'exif', tag: 0xA001, type: SHORT, kind: 'select', group: 'image', label: 'colour space', options: [[1, 'sRGB'], [65535, 'uncalibrated']] },
  { id: 'exifVersion', ifd: 'exif', tag: 0x9000, type: UNDEFINED, kind: 'version', group: 'image', label: 'exif version' },
  { id: 'makerNote', ifd: 'exif', tag: 0x927C, type: UNDEFINED, kind: 'raw', group: 'other', label: 'maker notes' },
];

export const GROUPS = [
  ['camera', 'camera'],
  ['date', 'date'],
  ['location', 'location'],
  ['people', 'description'],
  ['shot', 'shot'],
  ['image', 'image'],
  ['other', 'other'],
];

const IFD_NAMES = { ifd0: 'image', exif: 'exif', gps: 'gps', interop: 'interop' };
const known = new Set(FIELDS.filter(f => f.tag !== undefined).map(f => `${f.ifd}:${f.tag}`));

export const sizeText = (n) => (n < 1024 ? `${n} bytes` : `${(n / 1024).toFixed(1)} KB`);

// EXIF's "2026:03:14 09:26:53" ↔ a date box's "2026-03-14T09:26:53"
const exifToInput = (s) => {
  const m = s.trim().match(/^(\d{4})[:-](\d{2})[:-](\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6] || '00'}` : null;
};
const inputToExif = (s) => {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  return m ? `${m[1]}:${m[2]}:${m[3]} ${m[4]}:${m[5]}:${m[6] || '00'}` : null;
};

function dmsOf(gps, little, valueTag, refTag, neg) {
  const e = gps.get(valueTag);
  if (!e || e.type !== RATIONAL || e.count < 1) return '';
  const [d, m = [0, 1], s = [0, 1]] = numbers(e, little);
  let x = ratio(d) + ratio(m) / 60 + ratio(s) / 3600;
  const ref = gps.get(refTag);
  if (ref && decodeText(ref.raw).trim().toUpperCase() === neg) x = -x;
  return trimNum(x, 6);
}

function readValue(f, t) {
  const m = t[f.ifd];
  const { little } = t;
  if (f.kind === 'lat') return dmsOf(m, little, 0x0002, 0x0001, 'S');
  if (f.kind === 'lon') return dmsOf(m, little, 0x0004, 0x0003, 'W');
  if (f.kind === 'alt') {
    const e = m.get(0x0006);
    if (!e || e.type !== RATIONAL) return '';
    const below = m.get(0x0005)?.raw[0] === 1;
    return trimNum(ratio(numbers(e, little)[0]) * (below ? -1 : 1), 2);
  }
  const e = m.get(f.tag);
  if (!e) return '';
  return valueText(f.kind, e, little);
}

function valueText(kind, e, little) {
  const nums = () => numbers(e, little);
  switch (kind) {
    case 'text': return e.type === ASCII ? decodeText(e.raw) : sizeText(e.raw.length);
    case 'date': {
      const s = e.type === ASCII ? decodeText(e.raw) : '';
      return exifToInput(s) || '';
    }
    case 'int': case 'select': return nums().map(v => (Array.isArray(v) ? trimNum(ratio(v)) : String(v))).join(' ');
    case 'rational': return nums().map(v => (Array.isArray(v) ? trimNum(ratio(v)) : String(v))).join(' ');
    case 'exposure': return nums().map((v) => {
      const x = Array.isArray(v) ? ratio(v) : v;
      if (x > 0 && x < 1) {
        const inv = 1 / x;
        if (Math.abs(inv - Math.round(inv)) < 0.01) return `1/${Math.round(inv)}`;
      }
      return trimNum(x);
    }).join(' ');
    case 'comment': {
      const head = String.fromCharCode(...e.raw.subarray(0, 8));
      const body = e.raw.subarray(8);
      if (head.startsWith('UNICODE')) {
        const dv = view(body);
        let s = '';
        for (let i = 0; i + 1 < body.length; i += 2) s += String.fromCharCode(dv.getUint16(i, little));
        return s.replace(/\0+$/, '').trim();
      }
      return decodeText(body).trim();
    }
    case 'xp': {
      let s = '';
      for (let i = 0; i + 1 < e.raw.length; i += 2) s += String.fromCharCode(e.raw[i] | (e.raw[i + 1] << 8));
      return s.replace(/\0+$/, '');
    }
    case 'version': return String.fromCharCode(...e.raw).replace(/\0+$/, '');
    default: return sizeText(e.raw.length);
  }
}

// What one tag of a kind its value can be read as, for tags this list
// doesn't know (kept, editable when they're text or numbers)
const kindOf = (e) => {
  if (e.type === ASCII) return 'text';
  if ([1, 3, 4, 6, 8, 9].includes(e.type) && e.count <= 8) return 'int';
  if ((e.type === RATIONAL || e.type === SRATIONAL) && e.count <= 8) return 'rational';
  return 'raw';
};

// Every field to show for this photo, each with its value as text
export function readFields(t) {
  const out = [];
  FIELDS.forEach((f) => {
    const value = t ? readValue(f, t) : '';
    const has = f.kind === 'lat' || f.kind === 'lon' || f.kind === 'alt' ? !!value : !!t?.[f.ifd].has(f.tag);
    if (!f.always && !has) return;
    out.push({ ...f, value, readOnly: f.kind === 'raw' || (f.kind === 'text' && has && t[f.ifd].get(f.tag).type !== ASCII) });
  });
  if (!t) return out;
  ['ifd0', 'exif', 'gps', 'interop'].forEach((ifd) => {
    t[ifd].forEach((e, tag) => {
      if (known.has(`${ifd}:${tag}`)) return;
      if (ifd === 'gps' && tag <= 0x0006) return; // where: shown as latitude etc.
      const kind = kindOf(e);
      out.push({
        id: `${ifd}:${tag}`, ifd, tag, type: e.type, kind, group: 'other',
        label: TAG_NAMES[`${ifd}:${tag}`] || `${IFD_NAMES[ifd]} 0x${tag.toString(16).padStart(4, '0')}`,
        value: valueText(kind, e, t.little),
        readOnly: kind === 'raw',
      });
    });
  });
  if (t.thumb) out.push({ id: 'thumb', kind: 'raw', group: 'other', label: 'preview', value: sizeText(t.thumb.length), readOnly: true });
  return out;
}

// Names for tags often there that aren't fields of their own
const TAG_NAMES = {
  'ifd0:531': 'YCbCr positioning',
  'exif:37121': 'components',
  'exif:37396': 'subject area',
  'exif:40960': 'flashpix version',
  'exif:41495': 'sensing method',
  'exif:41728': 'file source',
  'exif:41729': 'scene type',
  'exif:41986': 'exposure mode',
  'exif:41990': 'scene capture',
  'exif:42080': 'composite image',
  'exif:34864': 'sensitivity type',
  'exif:34866': 'recommended exposure',
  'gps:7': 'gps time',
  'gps:12': 'gps speed unit',
  'gps:13': 'gps speed',
  'gps:16': 'direction ref',
  'gps:17': 'direction',
  'gps:23': 'bearing ref',
  'gps:24': 'bearing',
  'gps:29': 'gps date',
  'gps:31': 'gps accuracy m',
  'interop:1': 'interop index',
  'interop:2': 'interop version',
};

// A field's typed text as a tag ({ entry } or { error })
function encodeField(f, text, old, little) {
  const s = text.trim();
  const type = old?.type ?? f.type;
  switch (f.kind) {
    case 'text': return { entry: encodeText(s) };
    case 'date': {
      const v = inputToExif(s);
      return v ? { entry: encodeText(v) } : { error: `${f.label} isn't a date` };
    }
    case 'version': {
      const b = new TextEncoder().encode(s.slice(0, 4).padEnd(4, '0'));
      return { entry: { type: UNDEFINED, count: 4, raw: b } };
    }
    case 'comment': {
      // eslint-disable-next-line no-control-regex
      const ascii = /^[\x00-\x7f]*$/.test(s);
      const head = new TextEncoder().encode(ascii ? 'ASCII\0\0\0' : 'UNICODE\0');
      let body;
      if (ascii) body = new TextEncoder().encode(s);
      else {
        body = new Uint8Array(s.length * 2);
        const dv = view(body);
        for (let i = 0; i < s.length; i++) dv.setUint16(i * 2, s.charCodeAt(i), little);
      }
      const raw = new Uint8Array(8 + body.length);
      raw.set(head);
      raw.set(body, 8);
      return { entry: { type: UNDEFINED, count: raw.length, raw } };
    }
    case 'xp': {
      const raw = new Uint8Array(s.length * 2 + 2);
      for (let i = 0; i < s.length; i++) {
        raw[i * 2] = s.charCodeAt(i) & 0xFF;
        raw[i * 2 + 1] = s.charCodeAt(i) >> 8;
      }
      return { entry: { type: BYTE, count: raw.length, raw } };
    }
    case 'int': case 'select': {
      const vals = s.split(/[\s,]+/).map(Number);
      if (!vals.length || vals.some(v => !Number.isInteger(v))) return { error: `${f.label} needs whole numbers` };
      let ty = type;
      if ([5, 10].includes(ty)) return { entry: encodeNumbers(ty, vals.map(v => [v, 1]), little) };
      const fits = {
        1: v => v >= 0 && v <= 255, 6: v => v >= -128 && v <= 127,
        3: v => v >= 0 && v <= 65535, 8: v => v >= -32768 && v <= 32767,
        4: v => v >= 0 && v <= 0xFFFFFFFF, 9: v => v >= -0x80000000 && v <= 0x7FFFFFFF,
      };
      if (!vals.every(fits[ty] || (() => false))) {
        // A number too big for a short goes in as a long
        if ((ty === 3 || ty === 1) && vals.every(fits[4])) ty = LONG;
        else return { error: `${f.label} is out of range` };
      }
      return { entry: encodeNumbers(ty, vals, little) };
    }
    case 'rational': case 'exposure': {
      const ty = type === SRATIONAL ? SRATIONAL : RATIONAL;
      const vals = s.split(/[\s,]+/).map(v => toRational(v, ty === SRATIONAL));
      if (!vals.length || vals.some(v => !v)) return { error: `${f.label} isn't a number` };
      return { entry: encodeNumbers(ty, vals, little) };
    }
    default: return { error: `${f.label} can't be changed` };
  }
}

const dms = (x) => {
  const a = Math.abs(x);
  const d = Math.floor(a);
  const mf = (a - d) * 60;
  const m = Math.floor(mf);
  const s = Math.round((mf - m) * 60 * 10000);
  return [[d, 1], [m, 1], [s, 10000]];
};

// The photo's tags with these fields' new values (only the ones changed:
// a value shown and saved untouched stays byte for byte as it was)
export function applyFields(t, fields, values) {
  const next = {
    little: t ? t.little : false,
    ifd0: new Map(t?.ifd0), exif: new Map(t?.exif), gps: new Map(t?.gps),
    interop: new Map(t?.interop), ifd1: new Map(t?.ifd1), thumb: t?.thumb || null,
  };
  const { little } = next;
  for (const f of fields) {
    const now = values[f.id] ?? '';
    if (now === f.value) continue;
    const empty = !now.trim();
    if (f.id === 'thumb') {
      if (empty) { next.thumb = null; next.ifd1 = new Map(); }
      continue;
    }
    if (!f.ifd) continue; // (XMP, IPTC: outside the tags, the file's to drop)
    const m = next[f.ifd];
    if (f.kind === 'lat' || f.kind === 'lon') {
      const [refTag, valTag, lim, pos, neg] = f.kind === 'lat' ? [0x0001, 0x0002, 90, 'N', 'S'] : [0x0003, 0x0004, 180, 'E', 'W'];
      if (empty) { m.delete(refTag); m.delete(valTag); continue; }
      const x = Number(now);
      if (!Number.isFinite(x) || Math.abs(x) > lim) return { error: `${f.label} needs a number from -${lim} to ${lim}` };
      m.set(refTag, encodeText(x < 0 ? neg : pos));
      m.set(valTag, encodeNumbers(RATIONAL, dms(x), little));
      continue;
    }
    if (f.kind === 'alt') {
      if (empty) { m.delete(0x0005); m.delete(0x0006); continue; }
      const x = Number(now);
      const r = Number.isFinite(x) ? toRational(Math.abs(x)) : null;
      if (!r) return { error: 'altitude isn\'t a number' };
      m.set(0x0005, encodeNumbers(BYTE, [x < 0 ? 1 : 0], little));
      m.set(0x0006, encodeNumbers(RATIONAL, [r], little));
      continue;
    }
    if (empty) { m.delete(f.tag); continue; }
    const out = encodeField(f, now, m.get(f.tag), little);
    if (out.error) return out;
    m.set(f.tag, out.entry);
  }
  // Where it was taken: the version tag goes with the rest (alone, it's nothing)
  const gpsTags = [...next.gps.keys()].filter(k => k !== 0x0000);
  if (!gpsTags.length) next.gps.clear();
  else if (!t?.gps.size && !next.gps.has(0x0000)) next.gps.set(0x0000, encodeNumbers(BYTE, [2, 2, 0, 0], little));
  // Without a version, readers may not trust the block
  if (next.exif.size && !t?.exif.size && !next.exif.has(0x9000)) next.exif.set(0x9000, { type: UNDEFINED, count: 4, raw: new TextEncoder().encode('0232') });
  return { tiff: next };
}

// The details carried over to a converted copy: the picture is drawn
// upright at a new size, so its turn is reset, its size is the new one, and
// the old preview (and any turn it had) goes
export function carryOver(t, width, height) {
  if (!t) return null;
  const next = { ...t, ifd0: new Map(t.ifd0), exif: new Map(t.exif), ifd1: new Map(), thumb: null };
  if (next.ifd0.has(0x0112)) next.ifd0.set(0x0112, encodeNumbers(SHORT, [1], t.little));
  if (next.exif.has(0xA002)) next.exif.set(0xA002, encodeNumbers(LONG, [width], t.little));
  if (next.exif.has(0xA003)) next.exif.set(0xA003, encodeNumbers(LONG, [height], t.little));
  return writeTiff(next);
}

// ── The file around it ───────────────────────────────────────────

const ascii = (b, at, len) => String.fromCharCode(...b.subarray(at, at + len));
const EXIF_HEAD = [0x45, 0x78, 0x69, 0x66, 0, 0]; // "Exif\0\0"
const XMP_HEAD = 'http://ns.adobe.com/xap/1.0/\0';
const XMP_EXT_HEAD = 'http://ns.adobe.com/xmp/extension/\0';

export function formatOf(b) {
  if (b[0] === 0xFF && b[1] === 0xD8) return 'jpeg';
  if (b[0] === 0x89 && ascii(b, 1, 3) === 'PNG') return 'png';
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') return 'webp';
  return null;
}

// A JPG's blocks up to its picture data: { marker, start, end, data: [from, to) }
function jpegSegments(b) {
  const segs = [];
  let i = 2;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xFF) throw new Error('damaged JPG');
    let marker = b[i + 1];
    while (marker === 0xFF && i + 2 < b.length) { i++; marker = b[i + 1]; }
    if (marker === 0xDA || marker === 0xD9) { segs.push({ marker, start: i, end: b.length, rest: true }); break; }
    if ((marker >= 0xD0 && marker <= 0xD7) || marker === 0x01) { segs.push({ marker, start: i, end: i + 2 }); i += 2; continue; }
    const len = (b[i + 2] << 8) | b[i + 3];
    const end = i + 2 + len;
    if (len < 2 || end > b.length) throw new Error('damaged JPG');
    segs.push({ marker, start: i, end, from: i + 4, to: end });
    i = end;
  }
  return segs;
}
const isExifSeg = (b, s) => s.marker === 0xE1 && EXIF_HEAD.every((v, k) => b[s.from + k] === v);
const isXmpSeg = (b, s) => s.marker === 0xE1 && (ascii(b, s.from, XMP_HEAD.length) === XMP_HEAD || ascii(b, s.from, XMP_EXT_HEAD.length) === XMP_EXT_HEAD);
const isIptcSeg = (b, s) => s.marker === 0xED && ascii(b, s.from, 13) === 'Photoshop 3.0';

function pngChunks(b) {
  const chunks = [];
  let i = 8;
  const dv = view(b);
  while (i + 12 <= b.length) {
    const len = dv.getUint32(i);
    const type = ascii(b, i + 4, 4);
    const end = i + 12 + len;
    if (end > b.length) throw new Error('damaged PNG');
    chunks.push({ type, start: i, end, from: i + 8, to: i + 8 + len });
    i = end;
    if (type === 'IEND') break;
  }
  return chunks;
}

function webpChunks(b) {
  const chunks = [];
  const dv = view(b);
  let i = 12;
  while (i + 8 <= b.length) {
    const type = ascii(b, i, 4);
    const len = dv.getUint32(i + 4, true);
    const end = Math.min(b.length, i + 8 + len + (len & 1));
    chunks.push({ type, start: i, end, from: i + 8, to: Math.min(b.length, i + 8 + len) });
    i = end;
  }
  return chunks;
}

// What's in a file: its format, its tags, and the other kinds of details
// it holds (XMP, IPTC), by size
export function readMeta(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const format = formatOf(b);
  const meta = { format, tiff: null, xmp: 0, iptc: 0 };
  if (format === 'jpeg') {
    for (const s of jpegSegments(b)) {
      if (!meta.tiff && isExifSeg(b, s)) meta.tiff = parseTiff(b.slice(s.from + 6, s.to));
      else if (isXmpSeg(b, s)) meta.xmp += s.to - s.from;
      else if (isIptcSeg(b, s)) meta.iptc += s.to - s.from;
    }
  } else if (format === 'png') {
    for (const c of pngChunks(b)) {
      if (c.type === 'eXIf' && !meta.tiff) meta.tiff = parseTiff(b.slice(c.from, c.to));
      else if (c.type === 'iTXt' && ascii(b, c.from, 17) === 'XML:com.adobe.xmp') meta.xmp += c.to - c.from;
    }
  } else if (format === 'webp') {
    for (const c of webpChunks(b)) {
      if (c.type === 'EXIF' && !meta.tiff) {
        let d = b.slice(c.from, c.to);
        if (EXIF_HEAD.every((v, k) => d[k] === v)) d = d.slice(6);
        meta.tiff = parseTiff(d);
      } else if (c.type === 'XMP ') meta.xmp += c.to - c.from;
    }
  }
  return meta;
}

const concat = (parts) => {
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let o = 0;
  parts.forEach((p) => { out.set(p, o); o += p.length; });
  return out;
};

let crcTable = null;
function crc32(b) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let c = 0xFFFFFFFF;
  for (let i = 0; i < b.length; i++) c = crcTable[(c ^ b[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// The same file with new tags (tiff: a TIFF block, or null for none), and
// XMP / IPTC dropped when asked; the picture's bytes are copied untouched.
// `size` ({ width, height }) is the picture's, for a plain WEBP that needs
// an extended header to hold tags.
export function writeMeta(bytes, tiff, { dropXmp = false, dropIptc = false, size } = {}) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const format = formatOf(b);
  if (format === 'jpeg') {
    const segs = jpegSegments(b);
    let app1 = null;
    if (tiff) {
      // A JPG block holds at most 64 KB
      if (tiff.length + 8 > 0xFFFF) throw new Error('too many details for a JPG');
      app1 = new Uint8Array(tiff.length + 10);
      app1.set([0xFF, 0xE1, (tiff.length + 8) >> 8, (tiff.length + 8) & 0xFF, ...EXIF_HEAD]);
      app1.set(tiff, 10);
    }
    const parts = [b.subarray(0, 2)];
    let placed = !app1;
    // Where the tags go if the file had none: after a leading JFIF block
    const lead = segs[0]?.marker === 0xE0 ? 1 : 0;
    const had = segs.some(x => isExifSeg(b, x));
    segs.forEach((s, i) => {
      if (!placed && !had && i === lead) { parts.push(app1); placed = true; }
      if (s.from !== undefined && isExifSeg(b, s)) {
        if (!placed) { parts.push(app1); placed = true; }
        return;
      }
      if (dropXmp && s.from !== undefined && isXmpSeg(b, s)) return;
      if (dropIptc && s.from !== undefined && isIptcSeg(b, s)) return;
      parts.push(b.subarray(s.start, s.end));
    });
    if (!placed) parts.splice(1, 0, app1);
    return concat(parts);
  }
  if (format === 'png') {
    const chunks = pngChunks(b);
    const parts = [b.subarray(0, 8)];
    let placed = !tiff;
    chunks.forEach((c) => {
      if (c.type === 'eXIf') return;
      if (dropXmp && c.type === 'iTXt' && ascii(b, c.from, 17) === 'XML:com.adobe.xmp') return;
      if (!placed && (c.type === 'IDAT' || c.type === 'IEND')) {
        const chunk = new Uint8Array(tiff.length + 12);
        const dv = view(chunk);
        dv.setUint32(0, tiff.length);
        chunk.set([0x65, 0x58, 0x49, 0x66], 4); // eXIf
        chunk.set(tiff, 8);
        dv.setUint32(8 + tiff.length, crc32(chunk.subarray(4, 8 + tiff.length)));
        parts.push(chunk);
        placed = true;
      }
      parts.push(b.subarray(c.start, c.end));
    });
    return concat(parts);
  }
  if (format === 'webp') {
    const chunks = webpChunks(b);
    const chunk = (type, data) => {
      const out = new Uint8Array(8 + data.length + (data.length & 1));
      out.set([...type].map(ch => ch.charCodeAt(0)));
      view(out).setUint32(4, data.length, true);
      out.set(data, 8);
      return out;
    };
    const vp8x = chunks.find(c => c.type === 'VP8X');
    let head;
    if (vp8x) head = b.slice(vp8x.start, vp8x.end);
    else if (tiff || (!dropXmp && chunks.some(c => c.type === 'XMP '))) {
      // A plain WEBP: an extended header first, holding the picture's size
      // (and whether it's see-through, for a lossless one)
      const data = new Uint8Array(10);
      const lossless = chunks.find(c => c.type === 'VP8L');
      if (lossless && b[lossless.from + 4] & 0x10) data[0] |= 0x10;
      const w = (size?.width || 1) - 1;
      const h = (size?.height || 1) - 1;
      data.set([w & 0xFF, (w >> 8) & 0xFF, (w >> 16) & 0xFF, h & 0xFF, (h >> 8) & 0xFF, (h >> 16) & 0xFF], 4);
      head = chunk('VP8X', data);
    }
    const keepXmp = !dropXmp && chunks.some(c => c.type === 'XMP ');
    if (head) {
      head[8] = (head[8] & ~0x0C) | (tiff ? 0x08 : 0) | (keepXmp ? 0x04 : 0);
    }
    const parts = [b.subarray(0, 12)];
    if (head) parts.push(head);
    chunks.forEach((c) => {
      if (c.type === 'VP8X' || c.type === 'EXIF') return;
      if (c.type === 'XMP ' && dropXmp) return;
      if (c.type === 'XMP ' && tiff) return; // after the EXIF, below
      parts.push(b.subarray(c.start, c.end));
    });
    if (tiff) parts.push(chunk('EXIF', tiff));
    if (tiff && keepXmp) chunks.filter(c => c.type === 'XMP ').forEach(c => parts.push(b.subarray(c.start, c.end)));
    const out = concat(parts);
    view(out).setUint32(4, out.length - 8, true);
    return out;
  }
  throw new Error('only JPG, PNG and WEBP');
}
