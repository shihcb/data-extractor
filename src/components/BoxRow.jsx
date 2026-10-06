import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { Redo2, Trash2, Undo2 } from 'lucide-react';
import { workHeld } from '../utils';

// The row right under a tab's box: undo · redo on the left, the stats in
// the middle (`children`), and the trash on the right — clear and delete
// in one: the selection if there is one, else everything (or, in the text
// tabs, the text). Always there; dimmed with nothing to act on.
export default function BoxRow({ history, children, onTrash, trashDisabled, trashTitle = 'Clear', held }) {
  const ref = useRef(null);
  const id = useRef({});
  const lastFocus = useRef(null);

  // Something in the box: an update mustn't reload over it
  useEffect(() => {
    const me = id.current;
    if (held) workHeld.add(me);
    else workHeld.delete(me);
    return () => workHeld.delete(me);
  }, [held]);

  // A button turned off under the keys (the trash emptying the box, undo
  // run out): focus goes to the tab's first live button, not dropped to
  // the top of the page
  useLayoutEffect(() => {
    const el = lastFocus.current;
    if (!el || !el.disabled) return;
    lastFocus.current = null;
    const now = document.activeElement;
    if (now !== el && now !== document.body) return;
    ref.current?.closest('.tab-pane')?.querySelector('.btn:not(:disabled)')?.focus({ preventScroll: true });
  });

  const press = (fn) => (e) => {
    if (e.detail) e.currentTarget.blur();
    fn();
  };

  return (
    <div ref={ref} className="box-row" onFocus={(e) => { lastFocus.current = e.target.closest('button'); }}>
      <div className="box-row-side">
        <button className="btn btn-sm btn-icon" onClick={press(() => history.undo())} disabled={!history.canUndo} title="Undo (Ctrl + Z)" aria-label="Undo">
          <Undo2 size={14} />
        </button>
        <button className="btn btn-sm btn-icon" onClick={press(() => history.redo())} disabled={!history.canRedo} title="Redo (Ctrl + Shift + Z)" aria-label="Redo">
          <Redo2 size={14} />
        </button>
      </div>
      <div className="box-row-mid">{children}</div>
      <div className="box-row-side box-row-end">
        <button className="btn btn-sm btn-icon box-trash" onClick={press(onTrash)} disabled={trashDisabled} title={trashTitle} aria-label={trashTitle}>
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
