import React, { useEffect, useRef, useState } from 'react';
import { MOTION_MS, motionEase, prefersReducedMotion } from '../motion';

// A number that counts to its new value on the app's curve (the source
// repo's setCountBadge). A change mid-count carries on from what's shown.
export default function Count({ value, format = (n) => n.toLocaleString() }) {
  const [shown, setShown] = useState(value);
  const shownRef = useRef(value);
  const raf = useRef(null);

  useEffect(() => {
    cancelAnimationFrame(raf.current);
    const from = shownRef.current;
    if (from === value || prefersReducedMotion()) {
      shownRef.current = value;
      setShown(value);
      return;
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

  return <span className="count-num">{format(shown)}</span>;
}
