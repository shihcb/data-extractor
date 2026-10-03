import React, { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { canAnimate } from '../motion';
import { animateTo, drawnValue } from '../engine';
import Count from './Count';
import SlideSwap from './SlideSwap';

// The instagram repo's bulk bar, shared by PDF tools and the image
// converter: the selected count outlined, plain buttons, delete in red.
// Where it sits is the instagram repo's too: floating at the bottom of the
// screen, centered (out of the page, so nothing moves when it comes). It
// pops in like the cards (from 14px down at 95%) once its tab is showing
// and there's more than one to choose from, and pops out the same way.
export default function BulkBar({ active, total, selected, disabled, onSelectAll, onDelete, onClear }) {
  const ref = useRef(null);
  const open = !!active && total > 1;
  const was = useRef(open);
  const all = total > 0 && selected === total;
  // React's only on the first render; after that the motion owns these
  const initialStyle = useRef(open ? undefined : { visibility: 'hidden', opacity: 0 }).current;

  useLayoutEffect(() => {
    const el = ref.current;
    if (was.current === open) return;
    was.current = open;
    if (!canAnimate(el)) {
      el.style.visibility = open ? '' : 'hidden';
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

  return createPortal(
    <div className="bulk-dock">
      <div
        ref={ref}
        className="bulk-bar"
        style={initialStyle}
        aria-hidden={!open}
        inert={open ? undefined : true}
      >
        <span className="bulk-count"><Count value={selected} />{' selected'}</span>
        <button className="bulk-btn" onClick={(e) => { e.currentTarget.blur(); onSelectAll(!all); }} disabled={disabled}>
          <SlideSwap text={all ? 'select none' : 'select all'} />
        </button>
        <button className="bulk-btn bulk-delete" onClick={(e) => { e.currentTarget.blur(); onDelete(); }} disabled={disabled || !selected}>
          delete
        </button>
        <button className="bulk-btn" onClick={(e) => { e.currentTarget.blur(); onClear(); }} disabled={disabled}>
          clear
        </button>
      </div>
    </div>,
    document.body,
  );
}
