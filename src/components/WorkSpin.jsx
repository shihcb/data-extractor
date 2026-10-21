import React, { useLayoutEffect, useRef } from 'react';
import { MOTION, MOTION_MS, canAnimate } from '../motion';
import { animateTo, stop } from '../engine';

// The button at work (financial-dashboard's workButton): its words stay, a
// little dimmed; the button glides wider as a spinner swoops in after them
// (from 20% size, blurred, fading in); done, the spinner swoops away and the
// button glides back to its size. Never other words ("saving…"). The room is
// the engine's width, so a FlipRow sees it easing and the row slides along.
const ROOM = 18;
const SWOOP_IN = [
  { opacity: 0, transform: 'scale(0.2)', filter: 'blur(1.5px)' },
  { opacity: 1, transform: 'scale(1)', filter: 'blur(0)' },
];

export default function WorkSpin({ on }) {
  const ref = useRef(null);
  const prev = useRef(on);
  // React's only on the first render; after that the motion owns it
  const initialStyle = useRef(on ? undefined : { width: '0px' }).current;

  useLayoutEffect(() => {
    const el = ref.current;
    if (prev.current === on) return;
    prev.current = on;
    const spin = el.firstElementChild; // (the swoop's own wrapper: the spinner's turning is a transform too)
    spin.getAnimations().forEach(a => a.cancel());
    if (!canAnimate(el)) {
      stop(el);
      el.style.width = on ? '' : '0px';
      return;
    }
    const from = el.getBoundingClientRect().width;
    if (on) {
      animateTo(el, 'width', ROOM, { from });
      spin.animate(SWOOP_IN, { ...MOTION });
    } else {
      // (it goes a little quicker than it came, its room shutting just after)
      spin.animate([...SWOOP_IN].reverse(), { duration: MOTION_MS * 0.6, easing: 'cubic-bezier(0.5, 0, 0.9, 0.4)', fill: 'forwards' });
      setTimeout(() => { if (!prev.current) animateTo(el, 'width', 0, { from: el.getBoundingClientRect().width, keep: true }); }, MOTION_MS * 0.35);
    }
  }, [on]);

  useLayoutEffect(() => () => stop(ref.current), []);

  return (
    <span ref={ref} className="work-spin" style={initialStyle} aria-hidden="true">
      <span className="work-spin-swoop"><span className="spinner" /></span>
    </span>
  );
}
