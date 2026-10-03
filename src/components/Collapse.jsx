import React, { useLayoutEffect, useRef, useState } from 'react';
import { MOTION, canAnimate } from '../motion';

// Opens and closes by easing its height (with a fade and a small slide),
// like the source repo's expanding panels. Closed content stays mounted
// until the close finishes, then hides.
export default function Collapse({ open, children, className = '' }) {
  const ref = useRef(null);
  const [hidden, setHidden] = useState(!open);
  const prevOpen = useRef(open);

  useLayoutEffect(() => {
    const el = ref.current;
    if (prevOpen.current === open) return; // (also skips StrictMode's re-run)
    prevOpen.current = open;
    if (open) setHidden(false);
    if (!canAnimate(el)) {
      if (!open) setHidden(true);
      return;
    }
    const from = el.getBoundingClientRect().height;
    el.getAnimations().forEach(a => a.cancel());
    // Natural height (it may be hidden right now: measure it shown)
    el.style.display = '';
    const to = open ? el.scrollHeight : 0;
    const anim = el.animate([
      { height: `${from}px`, opacity: open ? 0 : 1, transform: open ? 'translateY(-6px)' : 'translateY(0)' },
      { height: `${to}px`, opacity: open ? 1 : 0, transform: open ? 'translateY(0)' : 'translateY(-6px)' },
    ], { ...MOTION, fill: 'forwards' });
    const done = () => {
      // Closed: hide before dropping the animation, or it flashes open for a frame
      if (!open) {
        el.style.display = 'none';
        setHidden(true);
      }
      anim.cancel();
    };
    anim.onfinish = done;
    return () => { anim.onfinish = null; };
  }, [open]);

  return (
    <div
      ref={ref}
      className={`motion-collapse ${className}`}
      style={{ overflow: 'hidden', display: hidden && !open ? 'none' : undefined }}
      aria-hidden={!open}
    >
      {children}
    </div>
  );
}
