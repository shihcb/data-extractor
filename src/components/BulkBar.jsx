import React from 'react';
import Collapse from './Collapse';
import Count from './Count';
import SlideSwap from './SlideSwap';

// The instagram repo's bulk bar, shared by PDF tools and the image
// converter: the selected count outlined, plain buttons, delete in red,
// centered. It pops in like the cards once there's more than one to choose
// from, and pops out again when there isn't.
export default function BulkBar({ total, selected, disabled, onSelectAll, onDelete, onClear }) {
  const all = total > 0 && selected === total;
  return (
    <Collapse open={total > 1} variant="pop" className="bulk-collapse">
      <div className="bulk-bar">
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
    </Collapse>
  );
}
