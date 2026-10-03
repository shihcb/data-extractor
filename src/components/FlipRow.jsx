import React, { useLayoutEffect, useRef } from 'react';
import { MOTION, canAnimate } from '../motion';

// A row of buttons that never snaps. When a button's label changes, its
// width eases to the new one (like the source repo's next button widening
// into "close"); the buttons around it follow that width as it eases, so
// they slide rather than jump. Anything else that moves a button (the row
// rewrapping) slides it from where it was drawn (FLIP). All on the app's
// 450ms motion; a change mid-slide carries on from where things are drawn.
export default function FlipRow({ className = 'tool-actions', children }) {
  const ref = useRef(null);
  const last = useRef(new Map()); // element -> { left, top, width } (layout)

  useLayoutEffect(() => {
    const row = ref.current;
    const els = [...row.children];
    // Drawn now (partway through anything running), before letting go of it
    const drawn = new Map(els.map((el) => {
      const running = !!el._flipAnims?.some(a => a.playState === 'running');
      const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
      const w = el.getBoundingClientRect().width;
      el._flipAnims?.forEach(a => a.cancel());
      el._flipAnims = null;
      el.style.overflow = '';
      return [el, { running, dx: m.m41 || 0, dy: m.m42 || 0, width: w }];
    }));
    const now = new Map(els.map(el => [el, { left: el.offsetLeft, top: el.offsetTop, width: el.offsetWidth }]));
    const animate = canAnimate(row);

    if (animate) {
      const add = (el, a) => { (el._flipAnims = el._flipAnims || []).push(a); };
      // Widths first: their easing moves the neighbours through layout
      let widened = false;
      els.forEach((el) => {
        const before = last.current.get(el);
        if (!before) return;
        const d = drawn.get(el);
        const from = d.running ? d.width : before.width;
        const to = now.get(el).width;
        if (Math.abs(from - to) < 0.5) return;
        widened = true;
        el.style.overflow = 'hidden';
        const a = el.animate([{ width: `${from}px` }, { width: `${to}px` }], MOTION);
        a.onfinish = () => { el.style.overflow = ''; };
        add(el, a);
      });
      // No width change: something else moved them — slide from where they were
      if (!widened) {
        els.forEach((el) => {
          const before = last.current.get(el);
          if (!before) return;
          const d = drawn.get(el);
          const n = now.get(el);
          const dx = before.left + d.dx - n.left;
          const dy = before.top + d.dy - n.top;
          if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
          add(el, el.animate([
            { transform: `translate(${dx}px, ${dy}px)` },
            { transform: 'translate(0px, 0px)' },
          ], MOTION));
        });
      }
    }
    last.current = now;
  });

  return <div ref={ref} className={className}>{children}</div>;
}
