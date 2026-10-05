import React from 'react';
import ActionBar from './ActionBar';
import Count from './Count';
import SlideSwap from './SlideSwap';
import SlideText from './SlideText';

// PDF tools' and the image converter's bar (the instagram repo's bulk
// bar): undo · redo, the selected count outlined, select all / none,
// anything that works on the selection (`children`), and delete in red,
// last — in the bottom bar every tab has (ActionBar), showing while
// there's a page or an image (or something to undo: a "delete all" can
// be taken back from here). With everything selected it reads "delete
// all" (the word slide) and empties the box, the way clear did.
export default function BulkBar({ active, total, selected, disabled, onSelectAll, onDelete, history, children }) {
  const all = total > 0 && selected === total;
  return (
    <ActionBar active={active} open={total > 0 || !!history?.canUndo} label="Selection" history={history}>
      <span className="bulk-count"><Count value={selected} /><span className="bulk-count-word">{' selected'}</span></span>
      <button className="bulk-btn" onClick={(e) => { if (e.detail) e.currentTarget.blur(); onSelectAll(!all); }} disabled={disabled}>
        {/* "select" stays; only "all" ↔ "none" swaps (the word swap, as "%" ↔
            "px wide"); the button's gap is the space between them */}
        select<SlideSwap text={all ? 'none' : 'all'} />
      </button>
      {children}
      <button className="bulk-btn bulk-delete" onClick={(e) => { if (e.detail) e.currentTarget.blur(); onDelete(); }} disabled={disabled || !selected}>
        delete<SlideText show={all}>{' all'}</SlideText>
      </button>
    </ActionBar>
  );
}
