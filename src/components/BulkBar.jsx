import React from 'react';
import ActionBar from './ActionBar';
import Count from './Count';
import SlideSwap from './SlideSwap';

// PDF tools' and the image converter's bar (the instagram repo's bulk
// bar): the selected count outlined, select all / none, anything that
// works on the selection (`children`), delete in red, and clear last — in
// the bottom bar every tab has (ActionBar), showing while there's a page
// or an image.
export default function BulkBar({ active, total, selected, disabled, onSelectAll, onDelete, onClear, history, children }) {
  const all = total > 0 && selected === total;
  return (
    <ActionBar active={active} open={total > 0} onClose={onClear} closeDisabled={disabled} closeLabel="clear" label="Selection" history={history}>
      <span className="bulk-count"><Count value={selected} /><span className="bulk-count-word">{'\u00a0selected'}</span></span>
      <button className="bulk-btn" onClick={(e) => { if (e.detail) e.currentTarget.blur(); onSelectAll(!all); }} disabled={disabled}>
        {/* "select" stays; only "all" ↔ "none" swaps (the word swap, as "%" ↔
            "px wide"); the button's gap is the space between them */}
        select<SlideSwap text={all ? 'none' : 'all'} />
      </button>
      {children}
      <button className="bulk-btn bulk-delete" onClick={(e) => { if (e.detail) e.currentTarget.blur(); onDelete(); }} disabled={disabled || !selected}>
        delete
      </button>
    </ActionBar>
  );
}
