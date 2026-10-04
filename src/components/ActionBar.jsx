import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { canAnimate } from '../motion';
import { animateTo, drawnValue } from '../engine';

// The bar every tab keeps its "what's open" actions in: the instagram
// repo's bulk bar (outlined count, plain buttons, delete in red), floating
// at the bottom of the screen, centered (out of the page, so nothing moves
// when it comes). It pops in like the cards (from 14px down at 95%) while
// its tab is showing and there's something to act on, and pops out the
// same way. Whatever the tab, the button that ends it all — clear or
// close — is always the last one, on the right.
const openBars = new Set();
const markBody = () => document.body.classList.toggle('has-bar', openBars.size > 0);

export default function ActionBar({ active, open: wanted, children, closeLabel = 'clear', onClose, closeDisabled, label }) {
  const ref = useRef(null);
  const id = useRef({});
  const open = !!active && !!wanted;
  const was = useRef(open);
  // React's only on the first render; after that the motion owns these
  const initialStyle = useRef(open ? undefined : { visibility: 'hidden', opacity: 0 }).current;

  useLayoutEffect(() => {
    const el = ref.current;
    if (was.current === open) return;
    was.current = open;
    if (!canAnimate(el)) {
      // (and its starting opacity 0 gone: with reduced motion it stayed invisible)
      el.style.visibility = open ? '' : 'hidden';
      el.style.opacity = open ? '' : '0';
      return;
    }
    if (open) {
      el.style.visibility = '';
      animateTo(el, 'opacity', 1, { from: drawnValue(el, 'opacity', 0) });
      animateTo(el, 'ty', 0, { from: drawnValue(el, 'ty', 14) });
      animateTo(el, 'scale', 1, { from: drawnValue(el, 'scale', 0.95) });
    } else {
      animateTo(el, 'opacity', 0, { from: drawnValue(el, 'opacity', 1), keep: true });
      animateTo(el, 'scale', 0.95, { from: drawnValue(el, 'scale', 1), keep: true });
      animateTo(el, 'ty', 14, {
        from: drawnValue(el, 'ty', 0),
        keep: true,
        onSettle: () => { if (!was.current) el.style.visibility = 'hidden'; },
      });
    }
  }, [open]);

  // While a bar shows, toasts sit above it (body.has-bar)
  useEffect(() => {
    const me = id.current;
    if (open) openBars.add(me);
    else openBars.delete(me);
    markBody();
    return () => { openBars.delete(me); markBody(); };
  }, [open]);

  return createPortal(
    <div className="bulk-dock">
      <div
        ref={ref}
        className="bulk-bar"
        style={initialStyle}
        role="toolbar"
        aria-label={label}
        aria-hidden={!open}
        inert={open ? undefined : true}
      >
        {children}
        <button className="bulk-btn" onClick={(e) => { if (e.detail) e.currentTarget.blur(); onClose(); }} disabled={closeDisabled}>
          {closeLabel}
        </button>
      </div>
    </div>,
    document.body,
  );
}
