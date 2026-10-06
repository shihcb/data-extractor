import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { Redo2, Trash2, Undo2 } from 'lucide-react';
import { workHeld } from '../utils';
import FlipRow from './FlipRow';

// The row right under a tab's box: undo · redo on the left, the tab's input
// and action buttons in the middle, centred (`actions`), and the trash on
// the right — clear and delete in one: the selection if there is one, else
// everything (or, in the text tabs, the text). Always there; dimmed with
// nothing to act on. `end`: the tab's own buttons just left of the trash
// (the metadata editor's reset). The stats (`children`) go under the row.
// `empty` (nothing in the box yet): only the input button shows — undo ·
// redo and the trash fade out (back as soon as there's something; an
// emptied box looks as it did at first, Ctrl + Z still undoing), and the
// stats fade out in place. The case converter doesn't
// pass it: its row stays as it is.
export default function BoxRow({ history, actions, children, end, onTrash, trashDisabled, trashTitle = 'Clear', held, empty = false }) {
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

  // A button turned off or slid away under the keys (the trash emptying
  // the box, undo run out, reset with nothing left to put back): focus
  // goes to the tab's first live button, not dropped to the top of the page
  useLayoutEffect(() => {
    const el = lastFocus.current;
    if (!el || !(el.disabled || el.closest('[aria-hidden="true"]'))) return;
    lastFocus.current = null;
    const now = document.activeElement;
    if (now !== el && now !== document.body) return;
    // (not a button hidden away: undo · redo fade out with the last image,
    // and focus sent to one of them was dropped to the page)
    const live = [...(ref.current?.closest('.tab-pane')?.querySelectorAll('.btn:not(:disabled)') || [])]
      .find(b => !b.closest('[inert], [aria-hidden="true"]'));
    live?.focus({ preventScroll: true });
  });

  const press = (fn) => (e) => {
    if (e.detail) e.currentTarget.blur();
    fn();
  };

  // (emptied too: back as it was at first; Ctrl + Z still brings it all back)
  const quiet = empty;
  const sides = quiet ? { 'aria-hidden': true, inert: true } : {};
  return (
    <>
    <div ref={ref} className="box-row" onFocus={(e) => { lastFocus.current = e.target.closest('button'); }}>
      <div className={`box-row-side ${quiet ? 'quiet' : ''}`} {...sides}>
        <button className="btn btn-icon" onClick={press(() => history.undo())} disabled={!history.canUndo} title="Undo (Ctrl + Z)" aria-label="Undo">
          <Undo2 size={14} />
        </button>
        <button className="btn btn-icon" onClick={press(() => history.redo())} disabled={!history.canRedo} title="Redo (Ctrl + Shift + Z)" aria-label="Redo">
          <Redo2 size={14} />
        </button>
      </div>
      <div className="box-row-mid">{actions ? <FlipRow>{actions}</FlipRow> : null}</div>
      <div className={`box-row-side box-row-end ${quiet ? 'quiet' : ''}`} {...sides}>
        {end}
        <button className="btn btn-icon box-trash" onClick={press(onTrash)} disabled={trashDisabled} title={trashTitle} aria-label={trashTitle}>
          <Trash2 size={14} />
        </button>
      </div>
    </div>
    {/* The stats keep their line and fade in / out in place (opacity alone,
        the phone's compositor): opened as a panel — its height eased, its
        text scaled from 96% while the numbers counted — it stuttered on a
        phone as the first document came in */}
    {children ? <div className={`stats-slot ${empty ? 'quiet' : ''}`} aria-hidden={empty || undefined}>{children}</div> : null}
    </>
  );
}
