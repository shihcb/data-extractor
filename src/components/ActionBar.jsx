import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { canAnimate } from '../motion';
import { animateTo, drawnValue, stop } from '../engine';
import { workHeld } from '../utils';

// The bar every tab keeps its "what's open" actions in: the instagram
// repo's bulk bar (outlined count, plain buttons, delete in red), floating
// at the bottom of the screen, centered (out of the page, so nothing moves
// when it comes). It pops in like the cards (from 14px down at 95%) while
// its tab is showing and there's something to act on, and pops out the
// same way. Every tab's bar is laid out the same: undo and redo first
// (`history`, from useHistory), then the tab's own buttons, and the button
// that ends it all — clear, close, or (with a selection) delete — always
// last, on the right.
const openBars = new Set();
const markBody = () => document.body.classList.toggle('has-bar', openBars.size > 0);

export default function ActionBar({ active, open: wanted, children, closeLabel = 'clear', onClose, closeDisabled, label, history }) {
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
    // Closing with the keys on one of its buttons (clear, delete the last):
    // they go to the tab's first button, not dropped to the top of the page
    if (!open && el.contains(document.activeElement)) {
      document.querySelector('.tab-pane.active:not(.tab-pane .tab-pane) .btn:not(:disabled)')?.focus({ preventScroll: true });
    }
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
        // Hidden first, then its motion styles dropped (kept, a closed bar
        // held its own GPU layer for good)
        onSettle: () => { if (!was.current) { el.style.visibility = 'hidden'; stop(el); } },
      });
    }
  }, [open]);

  useLayoutEffect(() => {
    const el = ref.current;
    return () => stop(el);
  }, []);

  // Something to act on, showing or not: an update mustn't reload over it
  useEffect(() => {
    const me = id.current;
    if (wanted) workHeld.add(me);
    else workHeld.delete(me);
    return () => workHeld.delete(me);
  }, [wanted]);

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
        {history && (
          <>
            <button className="bulk-btn" onClick={(e) => { if (e.detail) e.currentTarget.blur(); history.undo(); }} disabled={!history.canUndo} title="Undo (Ctrl + Z)">
              undo
            </button>
            <button className="bulk-btn" onClick={(e) => { if (e.detail) e.currentTarget.blur(); history.redo(); }} disabled={!history.canRedo} title="Redo (Ctrl + Shift + Z)">
              redo
            </button>
          </>
        )}
        {children}
        {onClose && (
          <button className="bulk-btn" onClick={(e) => { if (e.detail) e.currentTarget.blur(); onClose(); }} disabled={closeDisabled}>
            {closeLabel}
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
