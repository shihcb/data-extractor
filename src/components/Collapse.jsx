import React, { useLayoutEffect, useRef } from 'react';
import { MOTION, canAnimate } from '../motion';
import { easeBoxHeight, isRunning, registerHeightBox } from '../heightMotion';

// Opens from nothing and closes back to nothing (instagram-follower-checker's
// expanding panels, e.g. .hidden-warning): its height eases on the app's
// motion while the content fades and moves from 10px up at 96%. Content
// that changes size while it opens is followed (so it never snaps at the
// end); once open it's an ordinary box (easing boxes inside it do the
// easing). Closed content stays mounted until the close finishes, then hides.
const SHUT = { opacity: 0, transform: 'translateY(-10px) scale(0.96)' };
const OPEN = { opacity: 1, transform: 'translateY(0px) scale(1)' };

export default function Collapse({ open, children, className = '' }) {
  const outerRef = useRef(null);
  const innerRef = useRef(null);
  const s = useRef({ open, fade: null, ctrl: null }).current;
  // Display is React's only on the first render; after that the animations
  // own it (React setting display:none on close would cut the close short)
  const initialStyle = useRef(open ? undefined : { display: 'none' }).current;

  const fade = (to) => {
    const el = innerRef.current;
    s.fade?.cancel();
    s.fade = null;
    if (!canAnimate(el)) return;
    const now = getComputedStyle(el);
    const from = { opacity: now.opacity, transform: now.transform === 'none' ? OPEN.transform : now.transform };
    const a = el.animate([from, to], { ...MOTION, fill: 'forwards' });
    s.fade = a;
    if (to === OPEN) a.onfinish = () => { if (s.fade === a) { a.cancel(); s.fade = null; } };
  };

  useLayoutEffect(() => {
    const box = outerRef.current;
    const content = innerRef.current;
    const c = {
      box,
      content,
      measure: () => content.offsetHeight,
      last: content.offsetHeight,
      running: () => isRunning(box._heightAnim),
      // Idle and open, it's just a box: changes inside it are eased by the
      // boxes that changed. Opening or closing, it carries them.
      animatesChanges: () => c.running(),
      update(to) {
        c.last = to;
        if (s.open && c.running()) easeBoxHeight(box, to, { from: box.offsetHeight, prev: box._heightAnim });
      },
    };
    s.ctrl = c;
    const unregister = registerHeightBox(c);
    return () => {
      unregister();
      box._heightAnim?.cancel();
      s.fade?.cancel();
    };
  }, []);

  useLayoutEffect(() => {
    const box = outerRef.current;
    const content = innerRef.current;
    if (s.open === open) return; // (also skips StrictMode's re-run)
    s.open = open;
    if (open) {
      const fromNothing = box.style.display === 'none';
      // Where it's drawn now (mid-close: partway), before showing it
      const from = fromNothing ? 0 : box.offsetHeight;
      box.style.display = '';
      const to = content.offsetHeight;
      if (s.ctrl) s.ctrl.last = to;
      easeBoxHeight(box, to, { from, prev: box._heightAnim });
      fade(OPEN);
    } else {
      fade(SHUT);
      easeBoxHeight(box, 0, {
        from: box.offsetHeight,
        prev: box._heightAnim,
        onDone: () => { box.style.display = 'none'; },
      });
    }
  }, [open]);

  return (
    <div ref={outerRef} className={`motion-collapse ${className}`} style={initialStyle} aria-hidden={!open}>
      <div ref={innerRef} className="auto-height-inner">
        {children}
      </div>
    </div>
  );
}
