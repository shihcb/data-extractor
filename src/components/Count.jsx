import React, { useEffect, useRef, useState } from 'react';
import { MOTION, MOTION_MS, canAnimate, motionEase, prefersReducedMotion } from '../motion';

// A number that counts up when it appears, and to each new value after, on
// the app's curve (instagram-follower-checker's stat boxes), while its
// width eases from the old number's to the new one's so the words beside
// it slide rather than jump (the source repo's setCountBadge). A change
// mid-count carries on from what's shown.
export default function Count({ value, format = (n) => n.toLocaleString() }) {
  // A number that appears counts up from 0, like the source repo's stat boxes
  const start = value > 0 && !prefersReducedMotion() ? 0 : value;
  const [shown, setShown] = useState(start);
  const shownRef = useRef(start);
  const boxRef = useRef(null);
  const raf = useRef(null);
  const widthAnim = useRef(null);
  const fmt = useRef(format);
  fmt.current = format;

  useEffect(() => {
    cancelAnimationFrame(raf.current);
    const from = shownRef.current;
    if (from === value || prefersReducedMotion()) {
      shownRef.current = value;
      setShown(value);
      return undefined;
    }

    // Width: from what's drawn now to the final number's
    const box = boxRef.current;
    if (box && canAnimate(box)) {
      const startW = box.getBoundingClientRect().width;
      const probe = document.createElement('span');
      probe.className = box.className;
      probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;';
      probe.textContent = fmt.current(value);
      box.parentNode.appendChild(probe);
      const endW = probe.getBoundingClientRect().width;
      probe.remove();
      widthAnim.current?.cancel();
      if (Math.abs(endW - startW) > 0.5) {
        widthAnim.current = box.animate([{ width: `${startW}px` }, { width: `${endW}px` }], MOTION);
      }
    }

    const t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / MOTION_MS);
      const n = Math.round(from + (value - from) * motionEase(t));
      shownRef.current = n;
      setShown(n);
      if (t < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [value]);

  useEffect(() => () => widthAnim.current?.cancel(), []);

  return <span ref={boxRef} className="count-num">{format(shown)}</span>;
}
