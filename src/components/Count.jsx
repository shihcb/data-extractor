import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MOTION_MS, canAnimate, motionEase, prefersReducedMotion } from '../motion';
import { animateTo, stop } from '../engine';

// A number that counts up when it appears, and to each new value after, on
// the app's curve (instagram-follower-checker's stat boxes), while its
// width eases from the old number's to the new one's so the words beside
// it slide rather than jump (the source repo's setCountBadge).
// Counted the way the engine moves things: each change adds a piece on top
// of what's counting (shown = value + Σ offset × (1 − ease(t))), so typing
// keeps it moving at speed — started over from what was shown at each key,
// it stalled while typing went on, then rushed to catch up.
export default function Count({ value, format = (n) => n.toLocaleString() }) {
  // A number that appears counts up from 0, like the source repo's stat boxes
  const start = value > 0 && !prefersReducedMotion() ? 0 : value;
  const [shown, setShown] = useState(start);
  const boxRef = useRef(null);
  const raf = useRef(null);
  const fmt = useRef(format);
  fmt.current = format;
  const motion = useRef({ target: start, pieces: [] });
  const shownRef = useRef(shown);
  shownRef.current = shown;

  useEffect(() => {
    const m = motion.current;
    if (m.target === value && !m.pieces.length) return undefined;
    // (a NaN once shown stuck: every count after it was NaN too)
    if (!Number.isFinite(m.target) || !Number.isFinite(value) || prefersReducedMotion()) {
      cancelAnimationFrame(raf.current);
      m.target = value;
      m.pieces = [];
      setShown(value);
      return undefined;
    }
    const now = performance.now();
    if (m.target !== value) {
      m.pieces.push({ offset: m.target - value, start: now });
      m.target = value;
    }

    // Width: eased (on the engine, from where it's drawn) to the final
    // number's, and held there until the count has landed on it — let go
    // first, it fell back to the old number's width for a frame
    const box = boxRef.current;
    if (box && canAnimate(box)) {
      const probe = document.createElement('span');
      probe.className = box.className;
      probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;';
      probe.textContent = fmt.current(value);
      box.parentNode.appendChild(probe);
      const endW = probe.getBoundingClientRect().width;
      probe.remove();
      animateTo(box, 'width', endW, { from: box.getBoundingClientRect().width, keep: true });
    }

    cancelAnimationFrame(raf.current);
    const step = (t) => {
      m.pieces = m.pieces.filter(p => t - p.start < MOTION_MS);
      let v = m.target;
      for (const p of m.pieces) v += p.offset * (1 - motionEase(Math.max(0, (t - p.start) / MOTION_MS)));
      // Ends on the value itself, not its rounding
      const n = m.pieces.length ? Math.round(v) : m.target;
      setShown(n);
      if (m.pieces.length) raf.current = requestAnimationFrame(step);
      // (already showing it: no render to let the width go, so now)
      else if (shownRef.current === n && boxRef.current) stop(boxRef.current);
    };
    raf.current = requestAnimationFrame(step);
    return undefined;
  }, [value]);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  // Landed: the held width goes (the number's own width is the same now)
  useLayoutEffect(() => {
    const m = motion.current;
    if (shown === m.target && !m.pieces.length && boxRef.current) stop(boxRef.current);
  }, [shown]);

  return <span ref={(el) => { boxRef.current = el; if (el) el._noClip = true; }} className="count-num">{format(shown)}</span>;
}
