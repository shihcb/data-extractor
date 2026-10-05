import { MOTION_MS, motionEase, prefersReducedMotion } from './motion';

// The motion engine, ported from instagram-follower-checker's list 3 row
// engine. Every slide, resize, fade and shift is a "piece" of motion with
// its own start time; one requestAnimationFrame loop sums the pieces for
// each element and writes the result as inline styles. A new change adds a
// piece — nothing in flight is cancelled or restarted — so rapid changes
// layer smoothly. Done in JS rather than with Web Animations, which iOS
// Safari doesn't run reliably for clip-path and size (in the source repo,
// leaving rows lost their motion and lingered as fragments).
//
// A property's drawn value = its target + Σ piece.offset × (1 − ease(t)).
// Properties: height, width (px), tx, ty (px), clip (px cut from the top),
// opacity, scale. When an element's pieces have all finished, the styles
// it wrote are removed (the element is back to its natural layout).

const PROPS = {
  height: { rest: null },
  width: { rest: null },
  tx: { rest: 0 },
  ty: { rest: 0 },
  scale: { rest: 1 },
  clip: { rest: 0 },
  opacity: { rest: 1 },
};

const active = new Map(); // element -> { props: { name: { target, pieces } }, settle: [] }
let frame = null;

function stateOf(el) {
  let s = active.get(el);
  if (!s) {
    s = { props: {}, settle: [], hadOverflow: el.style.overflow };
    active.set(el, s);
  }
  return s;
}

const progress = (p, now) => Math.min(1, Math.max(0, (now - p.start) / p.duration));

function valueOf(prop, now) {
  let v = prop.target;
  for (const p of prop.pieces) v += p.offset * (1 - motionEase(progress(p, now)));
  return v;
}

// A style is only written when it changes: an unchanged write still costs a
// phone a style pass on every frame of every moving thing
function put(el, key, value) {
  if (el.style[key] !== value) el.style[key] = value;
}

function write(el, s, now) {
  const v = {};
  for (const name in s.props) v[name] = valueOf(s.props[name], now);
  if ('height' in v) put(el, 'height', `${Math.max(0, v.height)}px`);
  if ('width' in v) put(el, 'width', `${Math.max(0, v.width)}px`);
  // Clipped while it resizes — except text (a clipped inline box drops to a
  // different baseline, so a counting number would jump up off its line)
  if (('height' in v || 'width' in v) && !el._noClip) put(el, 'overflow', 'hidden');
  const moves = 'tx' in v || 'ty' in v || 'scale' in v;
  if (moves) {
    const tx = v.tx ?? 0;
    const ty = v.ty ?? 0;
    const sc = v.scale ?? 1;
    put(el, 'transform', `translate(${tx}px, ${ty}px)${sc !== 1 ? ` scale(${sc})` : ''}`);
  }
  if ('clip' in v) {
    const c = `inset(${Math.max(0, v.clip)}px 0px 0px 0px)`;
    put(el, 'clipPath', c);
    put(el, 'webkitClipPath', c);
  }
  if ('opacity' in v) put(el, 'opacity', String(Math.min(1, Math.max(0, v.opacity))));
  // Its own layer while it slides or fades, so the phone moves the drawn
  // pixels instead of repainting it (and what's under it) every frame
  // (only while it does: a held, settled style kept a layer for good — a
  // closed panel's content, a hidden word)
  const going = (name) => !!s.props[name]?.pieces.length;
  const layer = [(going('tx') || going('ty') || going('scale')) && 'transform', going('opacity') && 'opacity'].filter(Boolean).join(', ');
  put(el, 'willChange', layer);
}

function clear(el, s, names) {
  for (const name of names) {
    if (name === 'height') el.style.height = '';
    if (name === 'width') el.style.width = '';
    if (name === 'clip') { el.style.clipPath = ''; el.style.webkitClipPath = ''; }
    if (name === 'opacity') el.style.opacity = '';
    delete s.props[name];
  }
  if (!('tx' in s.props) && !('ty' in s.props) && !('scale' in s.props)) el.style.transform = '';
  if (!('tx' in s.props) && !('ty' in s.props) && !('scale' in s.props) && !('opacity' in s.props)) el.style.willChange = '';
  if (!('height' in s.props) && !('width' in s.props)) el.style.overflow = s.hadOverflow || '';
}

function step(now) {
  frame = null;
  const done = [];
  active.forEach((s, el) => {
    const finished = [];
    let wasMoving = false;
    for (const name in s.props) {
      const prop = s.props[name];
      if (prop.pieces.length) wasMoving = true;
      prop.pieces = prop.pieces.filter(p => progress(p, now) < 1);
      // A property at rest (no pieces, back at its resting value) is let go
      if (!prop.pieces.length && !prop.keep && (PROPS[name].rest === null || prop.target === PROPS[name].rest)) finished.push(name);
    }
    // Held still (kept sizes, nothing moving, nothing to let go): already
    // written as it stands
    if (!wasMoving && !finished.length && !s.settle.length) return;
    write(el, s, now);
    if (finished.length) clear(el, s, finished);
    const moving = Object.values(s.props).some(p => p.pieces.length);
    if (!moving) {
      done.push(...s.settle);
      s.settle = [];
      if (!Object.keys(s.props).length) active.delete(el);
    }
  });
  done.forEach(fn => fn());
  // Frames only while something moves (kept sizes just hold)
  let moving = false;
  active.forEach(s => { if (Object.values(s.props).some(p => p.pieces.length)) moving = true; });
  if (moving && frame === null) frame = requestAnimationFrame(step);
}

function kick(el) {
  if (frame === null) frame = requestAnimationFrame(step);
  // Written now too, so the first frame already shows the starting point
  // (just the element that changed: the others are written as they stand)
  const s = active.get(el);
  if (s) write(el, s, performance.now());
}

// Too small a change to bother moving: half a pixel for sizes and slides,
// but scale and opacity run 0–1 (the pop's 95% → 100% is a change of 0.05:
// under a half-pixel rule it never eased in, and snapped down on the way out)
const tiny = (name) => (name === 'scale' || name === 'opacity' ? 0.002 : 0.5);

// Moves `prop` to a new target, from where it's drawn, by adding a piece.
// `from` (optional) is where it's drawn when nothing's moving it yet.
// `keep`: hold the target as an inline style once settled (an explicit size).
export function animateTo(el, name, target, { from, duration = MOTION_MS, onSettle, keep = false } = {}) {
  if (!el) return;
  const now = performance.now();
  const s = stateOf(el);
  const prop = s.props[name];
  const drawn = prop ? valueOf(prop, now) : (from ?? target);
  if (prefersReducedMotion() || Math.abs(drawn - target) < tiny(name)) {
    // Not moved: put straight at its target (and let go at rest) — even with
    // nothing moving it before: with reduced motion an element starting out
    // hidden (opacity 0, width 0: a bottom bar, "merged") was never shown
    if (prop) {
      prop.pieces = [];
      prop.target = target;
      prop.keep = keep;
    } else {
      s.props[name] = { target, keep, pieces: [] };
    }
    if (onSettle) s.settle.push(onSettle);
    kick(el);
    return;
  }
  if (prop) {
    // Keep what's in flight; this change rides on top of it
    prop.pieces.push({ offset: prop.target - target, start: now, duration });
    prop.target = target;
    prop.keep = keep;
  } else {
    s.props[name] = { target, keep, pieces: [{ offset: drawn - target, start: now, duration }] };
  }
  if (onSettle) s.settle.push(onSettle);
  kick(el);
}

// Adds a shift on top of whatever's moving (FLIP): the element is drawn
// `offset` away from its new layout spot right now and eases back to it.
export function shift(el, name, offset, { duration = MOTION_MS } = {}) {
  if (!el || Math.abs(offset) < 0.5 || prefersReducedMotion()) return;
  const s = stateOf(el);
  const now = performance.now();
  const rest = PROPS[name].rest ?? 0;
  if (!s.props[name]) s.props[name] = { target: rest, pieces: [] };
  s.props[name].pieces.push({ offset, start: now, duration });
  kick(el);
}

// Where a property is drawn right now (or `fallback` when nothing moves it)
export function drawnValue(el, name, fallback) {
  const s = active.get(el);
  const prop = s?.props[name];
  return prop ? valueOf(prop, performance.now()) : fallback;
}

export const isMoving = (el, name) => {
  const prop = active.get(el)?.props[name];
  return !!prop && prop.pieces.length > 0;
};

// Drops all motion from an element and the styles it wrote
export function stop(el) {
  const s = active.get(el);
  if (!s) return;
  clear(el, s, Object.keys(s.props));
  active.delete(el);
}

// Its natural size with the engine's inline size taken off for a moment
export function naturalSize(el, name) {
  const saved = el.style[name];
  el.style[name] = '';
  const v = name === 'height' ? el.offsetHeight : el.offsetWidth;
  el.style[name] = saved;
  return v;
}
