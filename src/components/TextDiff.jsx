import React, { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { fadeIn } from '../motion';
import { ArrowLeftRight } from 'lucide-react';
import { diffChars, diffLines, diffWordsWithSpace } from 'diff';
import TabSwitcher from './TabSwitcher';
import Count from './Count';
import AutoHeight from './AutoHeight';
import Collapse from './Collapse';
import FadeText from './FadeText';
import FlipRow from './FlipRow';
import ActionBar from './ActionBar';
import useHistory, { useUndoKeys } from '../useHistory';

const MODES = [
  { key: 'lines', label: 'lines' },
  { key: 'words', label: 'words' },
  { key: 'chars', label: 'characters' },
];

// Gives up on a comparison that would take long enough to freeze typing
const DIFF_TIMEOUT_MS = 250;

function compare(a, b, mode) {
  if (!a && !b) return { parts: [], added: 0, removed: 0, changed: false };
  const opts = { timeout: DIFF_TIMEOUT_MS };
  // Windows line endings (\r\n) are just line breaks, in every mode
  a = a.replace(/\r\n?/g, '\n');
  b = b.replace(/\r\n?/g, '\n');
  // Same line endings, and every line ending in one: otherwise a last line
  // without a newline counts as changed when a line is added after it
  const asLines = (n) => (!n || n.endsWith('\n') ? n : `${n}\n`);
  const parts = mode === 'lines' ? diffLines(asLines(a), asLines(b), opts)
    : mode === 'words' ? diffWordsWithSpace(a, b, opts)
    : diffChars(a, b, opts);
  if (!parts) return null; // too slow: too different / too long for this mode
  let added = 0;
  let removed = 0;
  // Lines and characters as the diff counts them; words without the
  // spaces between them (which the word diff keeps as pieces of their own)
  const size = (p) => (mode === 'words' ? (p.value.match(/\S+/g) || []).length : p.count || 0);
  for (const p of parts) {
    if (p.added) added += size(p);
    if (p.removed) removed += size(p);
  }
  return { parts, added, removed, changed: parts.some(p => p.added || p.removed) };
}

// Lines mode: one row per line, marked + / − in the gutter. A long run of
// unchanged lines folds to the 3 next to each change and a "… N unchanged
// lines" row, and it stops at 3000 rows: twenty thousand rows froze the page.
const CONTEXT = 3;
const MAX_ROWS = 3000;
function LineRows({ parts }) {
  const rows = [];
  const row = (key, kind, text) => rows.push(
    <div key={key} className={`diff-line diff-line-${kind}`}>
      <span className="diff-gutter" aria-hidden="true">{kind === 'add' ? '+' : kind === 'del' ? '−' : ' '}</span>
      <span className="diff-text">{text || ' '}</span>
    </div>
  );
  const note = (key, text) => rows.push(
    <div key={key} className="diff-line diff-line-fold">
      <span className="diff-gutter" aria-hidden="true">⋯</span>
      <span className="diff-text">{text}</span>
    </div>
  );
  for (let i = 0; i < parts.length; i++) {
    if (rows.length >= MAX_ROWS) {
      note('more', 'and more — too long to show it all');
      break;
    }
    const p = parts[i];
    const lines = p.value.replace(/\n$/, '').split('\n');
    const kind = p.added ? 'add' : p.removed ? 'del' : 'same';
    const head = i > 0 ? CONTEXT : 0;
    const tail = i < parts.length - 1 ? CONTEXT : 0;
    if (kind === 'same' && lines.length > head + tail + 1) {
      lines.slice(0, head).forEach((line, j) => row(`${i}-${j}`, kind, line));
      const n = lines.length - head - tail;
      note(`${i}-fold`, `${n} unchanged ${n === 1 ? 'line' : 'lines'}`);
      lines.slice(lines.length - tail).forEach((line, j) => row(`${i}-t${j}`, kind, line));
    } else {
      lines.slice(0, MAX_ROWS).forEach((line, j) => row(`${i}-${j}`, kind, line));
    }
  }
  return rows;
}

// `value`, or while `wait` is on, its last value once it's been still 300ms
function useSettled(value, wait) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    if (!wait) { setSettled(value); return undefined; }
    const t = setTimeout(() => setSettled(value), 300);
    return () => clearTimeout(t);
  }, [value, wait]);
  return wait ? settled : value;
}

export default function TextDiff({ active }) {
  // Both texts, with undo / redo as in every tab (typing in one box is a
  // step per burst; a swap is a step of its own)
  const [texts, setTexts, history] = useHistory({ left: '', right: '' });
  useUndoKeys(active, history, { inFields: true });
  const { left, right } = texts;
  const setLeft = (v) => setTexts(t => ({ ...t, left: v }), 'left');
  const setRight = (v) => setTexts(t => ({ ...t, right: v }), 'right');
  const [mode, setMode] = useState('lines');
  // Huge texts are compared once typing pauses (each key ran a whole
  // comparison, up to a second on 50,000 lines); small ones at once
  const big = left.length + right.length > 200000;
  const a = useDeferredValue(useSettled(left, big));
  const b = useDeferredValue(useSettled(right, big));
  const result = useMemo(() => compare(a, b, mode), [a, b, mode]);

  const empty = !left && !right;
  const same = result && !empty && !result.changed;
  // (changed, but no word or line added or removed: only spaces or line breaks)
  // (decided the same way in every mode: by lines or letters a changed
  // space counted as one added)
  const spacesOnly = !empty && a !== b && a.replace(/\s+/g, ' ').trim() === b.replace(/\s+/g, ' ').trim();
  const status = empty ? 'empty' : !result ? 'slow' : same ? 'same' : spacesOnly || (!result.added && !result.removed) ? 'space' : 'diff';

  const hasOutput = !!result && !empty;
  const [lastView, setLastView] = useState(null);
  useEffect(() => {
    if (hasOutput) setLastView({ result, mode });
  }, [hasOutput, result, mode]);
  const view = hasOutput ? { result, mode } : lastView;
  // Another way of comparing: the result fades in anew (the text swap's
  // fade) while its box eases to the new size
  const outRef = useRef(null);
  const shownMode = useRef(mode);
  useLayoutEffect(() => {
    if (shownMode.current === view?.mode) return;
    if (shownMode.current && view?.mode) fadeIn(outRef.current?.firstElementChild);
    shownMode.current = view?.mode;
  }, [view?.mode]);


  return (
    <div className="tool">
      <div className="diff-inputs">
        <textarea
          className="tool-textarea short mono"
          value={left}
          onChange={(e) => setLeft(e.target.value)}
          placeholder="original text"
          spellCheck={false}
          aria-label="Original text"
        />
        <textarea
          className="tool-textarea short mono"
          value={right}
          onChange={(e) => setRight(e.target.value)}
          placeholder="changed text"
          spellCheck={false}
          aria-label="Changed text"
        />
      </div>

      <FlipRow>
        <TabSwitcher className="tab-switcher-sm" tabs={MODES} active={mode} onChange={setMode} />
      </FlipRow>
      {/* Swapping and clearing: in the bottom bar, like every tab */}
      <ActionBar active={active} open={!empty} onClose={() => history.reset({ left: '', right: '' })} label="Texts" history={history}>
        <button className="bulk-btn" onClick={(e) => { if (e.detail) e.currentTarget.blur(); setTexts(t => ({ left: t.right, right: t.left })); }} title="Swap the two texts">
          <ArrowLeftRight size={13} /> swap
        </button>
      </ActionBar>

      <AutoHeight className="tool-meta" aria-live="polite">
        <FadeText k={status}>
          {status === 'empty' && 'paste two texts to compare'}
          {status === 'slow' && (mode === 'lines' ? 'too long to compare' : 'too different to compare this way — try lines')}
          {status === 'space' && 'only spaces or line breaks differ'}
          {status === 'same' && 'no differences'}
          {status === 'diff' && (
            <>
              {/* Label first, so only the numbers change (they count) */}
              added <span className="diff-count-add"><Count value={result.added} /></span> · removed <span className="diff-count-del"><Count value={result.removed} /></span>
            </>
          )}
        </FadeText>
      </AutoHeight>

      {/* Grows in from nothing, eases to each new size, and keeps showing
          the last comparison while it closes */}
      <Collapse open={hasOutput} className="diff-collapse">
        <AutoHeight
          boxRef={outRef}
          className="tool-box diff-output-box"
          innerClassName={`diff-output selectable ${view?.mode === 'lines' ? 'diff-output-lines' : ''}`}
        >
          {!view ? null : view.mode === 'lines'
            ? <LineRows parts={view.result.parts} />
            : view.result.parts.map((p, i) => (
              p.added ? <ins key={i} className="diff-ins">{p.value}</ins>
                : p.removed ? <del key={i} className="diff-del">{p.value}</del>
                : <span key={i}>{p.value}</span>
            ))}
        </AutoHeight>
      </Collapse>
    </div>
  );
}
