// The app's one motion, ported from instagram-follower-checker ("the list 3
// slide"): 450ms, cubic-bezier(0.4, 0, 0.2, 1). Every animation — entering,
// leaving, resizing, sliding, tab switches, counters — uses it. Only loading
// spinners are exempt. In CSS it's var(--motion-duration) / var(--motion-easing).
export const MOTION_MS = 450;
export const MOTION_EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';
export const MOTION = { duration: MOTION_MS, easing: MOTION_EASING };

// Pop-ups and toasts come in from 14px down at 95% scale and leave the same way.
export const POP_HIDDEN = { opacity: 0, transform: 'translateY(14px) scale(0.95)' };
export const POP_SHOWN = { opacity: 1, transform: 'translateY(0) scale(1)' };

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  !!window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const canAnimate = (el) =>
  !!el && typeof el.animate === 'function' && !prefersReducedMotion();

// The easing as a function of progress (0..1), for animations driven by
// requestAnimationFrame (counters). Same Newton solve as the source repo.
export function cubicBezierEasing(x1, y1, x2, y2) {
  const sample = (a1, a2, t) => ((1 - 3 * a2 + 3 * a1) * t + (3 * a2 - 6 * a1)) * t * t + 3 * a1 * t;
  const slope = (a1, a2, t) => 3 * (1 - 3 * a2 + 3 * a1) * t * t + 2 * (3 * a2 - 6 * a1) * t + 3 * a1;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const err = sample(x1, x2, t) - x;
      const d = slope(x1, x2, t);
      if (Math.abs(err) < 1e-5 || Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    t = Math.min(1, Math.max(0, t));
    return sample(y1, y2, t);
  };
}
export const motionEase = cubicBezierEasing(0.4, 0, 0.2, 1);

// Texts just fade.
export function fadeIn(el, delay = 0) {
  if (!canAnimate(el)) return null;
  return el.animate([{ opacity: 0 }, { opacity: 1 }], { ...MOTION, delay, fill: 'backwards' });
}

// A box that just got new content gets a brief outline: 0.45s in, 0.45s out
// (the source repo's card-flash).
export function flashOutline(el) {
  if (!el) return;
  el.classList.remove('card-flash');
  void el.offsetWidth; // restart the keyframes if it's already flashing
  el.classList.add('card-flash');
  const done = () => el.classList.remove('card-flash');
  el.addEventListener('animationend', done, { once: true });
}

// Current rendered height, including an in-flight height animation.
export const currentHeight = (el) => (el ? el.getBoundingClientRect().height : 0);
