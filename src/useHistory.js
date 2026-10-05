import { useCallback, useEffect, useRef, useState } from 'react';

// Undo and redo for a tab, the same everywhere: the tab's state kept as
// whole snapshots (each change makes a new one, nothing is changed in
// place). `set(next, group)` records a step; steps with the same `group`
// close together (typing in one box) are one step. `quiet(next)` changes
// the state without a step (a picture finishing drawing). `reset(value)`
// starts over with no steps (clear / close end the session).
const MERGE_MS = 1000;
const LIMIT = 100;

export default function useHistory(initial) {
  const [h, setH] = useState(() => ({ past: [], now: initial, future: [], group: null, at: 0 }));
  const set = useCallback((next, group = null) => setH((s) => {
    const value = typeof next === 'function' ? next(s.now) : next;
    if (Object.is(value, s.now)) return s;
    const t = Date.now();
    const merge = group !== null && s.group === group && t - s.at < MERGE_MS;
    return { past: merge ? s.past : [...s.past, s.now].slice(-LIMIT), now: value, future: [], group, at: t };
  }), []);
  const quiet = useCallback(next => setH(s => ({ ...s, now: typeof next === 'function' ? next(s.now) : next })), []);
  const undo = useCallback(() => setH(s => (s.past.length
    ? { past: s.past.slice(0, -1), now: s.past[s.past.length - 1], future: [s.now, ...s.future], group: null, at: 0 }
    : s)), []);
  const redo = useCallback(() => setH(s => (s.future.length
    ? { past: [...s.past, s.now], now: s.future[0], future: s.future.slice(1), group: null, at: 0 }
    : s)), []);
  const reset = useCallback(value => setH({ past: [], now: value, future: [], group: null, at: 0 }), []);
  const ref = useRef(h);
  ref.current = h;
  // Every state still reachable (what mustn't be let go yet)
  const reachable = useCallback(() => [...ref.current.past, ref.current.now, ...ref.current.future], []);
  return [h.now, set, { undo, redo, quiet, reset, reachable, canUndo: h.past.length > 0, canRedo: h.future.length > 0 }];
}

// Ctrl + Z / Ctrl + Shift + Z (or Ctrl + Y) while the tab is open. In a
// text box they're the box's own unless `inFields` (the tab's history
// covers what's typed there too)
export function useUndoKeys(active, history, { inFields = false } = {}) {
  const latest = useRef(history);
  latest.current = history;
  useEffect(() => {
    if (!active) return undefined;
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || document.body.classList.contains('modal-open')) return;
      const k = e.key.toLowerCase();
      if (k !== 'z' && k !== 'y') return;
      const t = e.target;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if (typing && !(inFields && t.closest?.('.tab-pane.active'))) return;
      e.preventDefault();
      if (k === 'z' && !e.shiftKey) latest.current.undo();
      else latest.current.redo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, inFields]);
}
