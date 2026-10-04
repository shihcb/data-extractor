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
  // Same line endings, and every line ending in one: otherwise a last line
  // without a newline counts as changed when a line is added after it
  const asLines = (t) => { const n = t.replace(/\r\n?/g, '\n'); return !n || n.endsWith('\n') ? n : `${n}\n`; };
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

// Lines mode: one row per line, marked + / − in the gutter
function LineRows({ parts }) {
  const rows = [];
  parts.forEach((p, i) => {
    const lines = p.value.replace(/\n$/, '').split('\n');
    const kind = p.added ? 'add' : p.removed ? 'del' : 'same';
    lines.forEach((line, j) => rows.push(
      <div key={`${i}-${j}`} className={`diff-line diff-line-${kind}`}>
        <span className="diff-gutter" aria-hidden="true">{kind === 'add' ? '+' : kind === 'del' ? '−' : ' '}</span>
        <span className="diff-text">{line || ' '}</span>
      </div>
    ));
  });
  return rows;
}

export default function TextDiff({ active }) {
  const [left, setLeft] = useState('');
  const [right, setRight] = useState('');
  const [mode, setMode] = useState('lines');
  const a = useDeferredValue(left);
  const b = useDeferredValue(right);
  const result = useMemo(() => compare(a, b, mode), [a, b, mode]);

  const empty = !left && !right;
  const same = result && !empty && !result.changed;
  const status = empty ? 'empty' : !result ? 'slow' : same ? 'same' : 'diff';

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
      <ActionBar active={active} open={!empty} onClose={() => { setLeft(''); setRight(''); }} label="Texts">
        <button className="bulk-btn" onClick={(e) => { e.currentTarget.blur(); setLeft(right); setRight(left); }} title="Swap the two texts">
          <ArrowLeftRight size={13} /> swap
        </button>
      </ActionBar>

      <AutoHeight className="tool-meta" aria-live="polite">
        <FadeText k={status}>
          {status === 'empty' && 'paste two texts to compare'}
          {status === 'slow' && 'too different to compare this way — try lines'}
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
