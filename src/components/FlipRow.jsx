import React, { useLayoutEffect, useRef } from 'react';
import { canAnimate } from '../motion';
import { animateTo, isMoving, shift } from '../engine';

// A row of buttons that never snaps. When a button's label changes, its
// width eases to the new one (like the source repo's next button widening
// into "close"); the buttons around it follow that width as it eases, so
// they slide rather than jump. Anything else that moves a button (the row
// rewrapping) slides it from where it was drawn. Driven by the motion
// engine, so changes in quick succession layer instead of restarting.
export default function FlipRow({ className = 'tool-actions', children }) {
  const ref = useRef(null);
  const last = useRef(new Map()); // element -> { left, top, width } (natural layout)

  useLayoutEffect(() => {
    const row = ref.current;
    const els = [...row.children];
    // Hidden (a closed panel): nothing measures, so nothing to remember — the
    // first look once it's shown starts fresh rather than growing every
    // button from 0px
    if (!row.getClientRects().length || !row.offsetWidth) {
      last.current = new Map();
      return;
    }
    // Natural layout: the engine's inline widths off for a moment
    const saved = els.map(el => el.style.width);
    els.forEach((el) => { el.style.width = ''; });
    const now = new Map(els.map(el => [el, { left: el.offsetLeft, top: el.offsetTop, width: el.offsetWidth }]));
    els.forEach((el, i) => { el.style.width = saved[i]; });

    if (canAnimate(row)) {
      let widened = false;
      els.forEach((el) => {
        const before = last.current.get(el);
        const n = now.get(el);
        if (!before || !before.width || Math.abs(before.width - n.width) < 0.5) return;
        // Something inside is already easing its width (the word slide in the
        // resize field, a counting number): that drives this one through
        // layout — easing it here too would fight it and jump
        if ([...el.querySelectorAll('*')].some(d => isMoving(d, 'width'))) {
          widened = true;
          return;
        }
        widened = true;
        animateTo(el, 'width', n.width, { from: before.width });
      });
      // No width change: something else moved them — slide from where they were
      if (!widened) {
        els.forEach((el) => {
          const before = last.current.get(el);
          if (!before) return;
          const n = now.get(el);
          shift(el, 'tx', before.left - n.left);
          shift(el, 'ty', before.top - n.top);
        });
      }
    }
    // A control whose insides are still moving isn't remembered: its size
    // right now is partway (comparing against it later eased it from a
    // stale width — the resize field jumped 29px)…
    // …and while any control is still changing width, the others' spots are
    // partway too (the row re-centres as it eases), so nothing is remembered
    const settling = els.some(el => isMoving(el, 'width') || [...el.querySelectorAll('*')].some(d => isMoving(d, 'width')));
    last.current = settling ? new Map() : now;
    if (settling) watchRewrap();
  });

  // While a control is easing its width, the row can rewrap partway (a
  // button no longer fits and drops to the next line, the others
  // re-centring) — between renders, so the slide above never sees it and
  // the buttons jumped. Watched frame by frame: a button whose spot jumps
  // slides from where it was drawn instead.
  const watching = useRef(0);
  const watchRewrap = () => {
    if (watching.current) return;
    const row = ref.current;
    const spots = new Map([...row.children].map(el => [el, { left: el.offsetLeft, top: el.offsetTop }]));
    let quiet = 0;
    const step = () => {
      if (!row.isConnected) { watching.current = 0; return; }
      const els = [...row.children];
      els.forEach(el => {
        const n = { left: el.offsetLeft, top: el.offsetTop };
        const p = spots.get(el);
        // An ease moves a spot a few px a frame; a rewrap moves it at once
        if (p && (Math.abs(p.left - n.left) > 12 || Math.abs(p.top - n.top) > 12) && canAnimate(row)) {
          shift(el, 'tx', p.left - n.left);
          shift(el, 'ty', p.top - n.top);
        }
        spots.set(el, n);
      });
      const moving = els.some(el => isMoving(el, 'width') || [...el.querySelectorAll('*')].some(d => isMoving(d, 'width')));
      quiet = moving ? 0 : quiet + 1;
      watching.current = quiet < 3 ? requestAnimationFrame(step) : 0;
    };
    watching.current = requestAnimationFrame(step);
  };
  useLayoutEffect(() => () => cancelAnimationFrame(watching.current), []);

  // Positioned, so its children measure their spots against the row itself:
  // the row moving with the boxes above it (a file row deleted) must not
  // look like them moving, or they get pushed away on top of that movement
  return <div ref={ref} className={className} style={{ position: 'relative' }}>{children}</div>;
}
