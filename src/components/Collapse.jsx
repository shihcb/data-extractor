import React, { useLayoutEffect, useRef } from 'react';
import { registerHeightBox } from '../heightMotion';
import { animateTo, drawnValue, isMoving, stop } from '../engine';

// Opens from nothing and closes back to nothing (instagram-follower-checker's
// expanding panels, e.g. .hidden-warning): its height eases on the app's
// motion while the content fades and moves from 10px up at 96%. Content
// that changes size while it opens is followed; once open it's an ordinary
// box (easing boxes inside it do the easing). Closed content stays mounted
// until the close finishes, then hides. Driven by the motion engine.
// variant="slide": the content instead slides down from under what's above
// it (clipped at its top edge, like a list row) and back up under it.
export default function Collapse({ open, children, className = '', variant = 'fade' }) {
  const outerRef = useRef(null);
  const innerRef = useRef(null);
  const s = useRef({ open }).current;
  // Display is React's only on the first render; after that the motion owns
  // it (React setting display:none on close would cut the close short)
  const initialStyle = useRef(open ? undefined : { display: 'none' }).current;

  useLayoutEffect(() => {
    const box = outerRef.current;
    const content = innerRef.current;
    const c = {
      box,
      content,
      measure: () => content.offsetHeight,
      last: content.offsetHeight,
      running: () => isMoving(box, 'height'),
      // Opening or closing, it carries the boxes inside; idle, it's just a box
      animatesChanges: () => c.running(),
      update(to) {
        c.last = to;
        if (s.open && c.running()) animateTo(box, 'height', to);
      },
    };
    s.ctrl = c;
    const unregister = registerHeightBox(c);
    return () => {
      unregister();
      stop(box);
      stop(content);
    };
  }, [s]);

  useLayoutEffect(() => {
    const box = outerRef.current;
    const content = innerRef.current;
    if (s.open === open) return; // (also skips StrictMode's re-run)
    s.open = open;
    if (open) {
      const fromNothing = box.style.display === 'none';
      const from = fromNothing ? 0 : drawnValue(box, 'height', box.offsetHeight);
      box.style.display = '';
      const to = content.offsetHeight;
      if (s.ctrl) s.ctrl.last = to;
      animateTo(box, 'height', to, { from });
      if (variant === 'slide') {
        animateTo(content, 'ty', 0, { from: drawnValue(content, 'ty', fromNothing ? -to : 0) });
        animateTo(content, 'clip', 0, { from: drawnValue(content, 'clip', fromNothing ? to : 0) });
      } else {
        animateTo(content, 'opacity', 1, { from: fromNothing ? 0 : 1 });
        animateTo(content, 'ty', 0, { from: fromNothing ? -10 : 0 });
        animateTo(content, 'scale', 1, { from: fromNothing ? 0.96 : 1 });
      }
    } else {
      if (variant === 'slide') {
        const h = content.offsetHeight;
        animateTo(content, 'ty', -h, { from: drawnValue(content, 'ty', 0) });
        animateTo(content, 'clip', h, { from: drawnValue(content, 'clip', 0) });
      } else {
        animateTo(content, 'opacity', 0, { from: 1 });
        animateTo(content, 'ty', -10, { from: 0 });
        animateTo(content, 'scale', 0.96, { from: 1 });
      }
      animateTo(box, 'height', 0, {
        from: box.offsetHeight,
        onSettle: () => { if (!s.open) box.style.display = 'none'; },
      });
    }
  }, [open, s, variant]);

  return (
    <div ref={outerRef} className={`motion-collapse ${className}`} style={initialStyle} aria-hidden={!open}>
      <div ref={innerRef} className="auto-height-inner">
        {children}
      </div>
    </div>
  );
}
