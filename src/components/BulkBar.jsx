import React from 'react';
import ActionBar from './ActionBar';
import Count from './Count';
import SlideSwap from './SlideSwap';

// PDF tools' and the image converter's bar (the instagram repo's bulk
// bar): the selected count outlined, select all / none, and anything that
// works on the selection (`children`) — in the bottom bar (ActionBar),
// showing while there's a page or an image. Undo, redo and the trash
// (delete) are in the row under the box (BoxRow).
export default function BulkBar({ active, total, selected, disabled, onSelectAll, children }) {
  const all = total > 0 && selected === total;
  return (
    <ActionBar active={active} open={total > 0} label="Selection">
      <span className="bulk-count"><Count value={selected} /><span className="bulk-count-word">{' selected'}</span></span>
      <button className="bulk-btn" onClick={(e) => { if (e.detail) e.currentTarget.blur(); onSelectAll(!all); }} disabled={disabled}>
        {/* "select" stays; only "all" ↔ "none" swaps (the word swap, as "%" ↔
            "px wide"); the button's gap is the space between them */}
        select<SlideSwap text={all ? 'none' : 'all'} />
      </button>
      {children}
    </ActionBar>
  );
}
