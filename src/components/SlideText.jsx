import React, { useLayoutEffect, useRef } from 'react';
import { animateTo } from '../engine';

// A few words that come and go inside a line (" per page"): their width
// eases open or shut while they fade, so the rest of the line slides over
// to make room instead of jumping — on the app's 450ms motion.
export default function SlideText({ show, children }) {
  const ref = useRef(null);
  const prev = useRef(show);
  // React's only on the first render; after that the motion owns these
  const initialStyle = useRef(show ? undefined : { width: '0px', opacity: 0 }).current;

  useLayoutEffect(() => {
    const el = ref.current;
    if (prev.current === show) return;
    prev.current = show;
    const from = el.getBoundingClientRect().width;
    if (show) {
      animateTo(el, 'width', el.scrollWidth, { from });
      animateTo(el, 'opacity', 1, { from: parseFloat(getComputedStyle(el).opacity) || 0 });
    } else {
      animateTo(el, 'width', 0, { from, keep: true });
      animateTo(el, 'opacity', 0, { from: parseFloat(getComputedStyle(el).opacity) || 1 });
    }
  }, [show]);

  return (
    <span ref={ref} className="slide-text" style={initialStyle} aria-hidden={!show}>
      {children}
    </span>
  );
}
