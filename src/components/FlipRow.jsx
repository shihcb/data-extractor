import React, { useLayoutEffect, useRef } from 'react';
import { canAnimate } from '../motion';
import { animateTo, shift } from '../engine';

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
    last.current = now;
  });

  return <div ref={ref} className={className}>{children}</div>;
}
