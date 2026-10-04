import React, { useLayoutEffect, useRef } from 'react';
import { animateTo, isMoving, stop } from '../engine';

// A few words that come and go inside a line (" per page"): their width
// eases open or shut while they fade, so the rest of the line slides over
// to make room instead of jumping — on the app's 450ms motion.
export default function SlideText({ show, children }) {
  const ref = useRef(null);
  const innerRef = useRef(null);
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

  // Words that grow while they slide open ("· matches 0" counting to 17)
  // are followed: the width it was easing to was measured when it showed,
  // and the number was clipped, then jumped once the slide ended
  useLayoutEffect(() => {
    const el = ref.current;
    const inner = innerRef.current;
    let ro = null;
    if (typeof ResizeObserver === 'function') {
      ro = new ResizeObserver(() => {
        if (prev.current && isMoving(el, 'width')) animateTo(el, 'width', inner.offsetWidth);
      });
      ro.observe(inner);
    }
    return () => { ro?.disconnect(); stop(el); };
  }, []);

  return (
    <span ref={ref} className="slide-text" style={initialStyle} aria-hidden={!show}>
      <span ref={innerRef} className="slide-text-inner">{children}</span>
    </span>
  );
}
