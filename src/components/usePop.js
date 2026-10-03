import { useLayoutEffect, useRef } from 'react';
import { canAnimate } from '../motion';
import { animateTo, drawnValue, stop } from '../engine';

// The pop, for one thing that comes and goes (a QR code, the camera): in
// from 14px down at 95% while it fades in, out the same way, then hidden —
// what the PDF pages, image cards and bulk bar do. A change mid-pop carries
// on from where it's drawn. `ref`'s element is hidden while not shown.
export default function usePop(ref, shown) {
  const was = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (was.current === null) {
      // First look: as it is, no motion
      was.current = shown;
      if (!shown) el.style.display = 'none';
      return;
    }
    if (was.current === shown) return;
    was.current = shown;
    if (shown) {
      el.style.display = '';
      if (!canAnimate(el)) return;
      animateTo(el, 'opacity', 1, { from: drawnValue(el, 'opacity', 0) });
      animateTo(el, 'ty', 0, { from: drawnValue(el, 'ty', 14) });
      animateTo(el, 'scale', 1, { from: drawnValue(el, 'scale', 0.95) });
    } else {
      const hide = () => {
        if (was.current) return;
        // Hidden before its motion styles go (they'd show it again for a frame)
        el.style.display = 'none';
        stop(el);
      };
      if (!canAnimate(el)) { hide(); return; }
      animateTo(el, 'opacity', 0, { from: drawnValue(el, 'opacity', 1), keep: true });
      animateTo(el, 'scale', 0.95, { from: drawnValue(el, 'scale', 1), keep: true });
      animateTo(el, 'ty', 14, { from: drawnValue(el, 'ty', 0), keep: true, onSettle: hide });
    }
  }, [ref, shown]);
}
