import React, { useDeferredValue, useMemo, useRef } from 'react';
import { ClipboardPaste } from 'lucide-react';
import { CASES, textStats } from '../textCase';
import { copyText, useDoneFlags } from '../utils';
import { useToast } from '../toastContext';
import Count from './Count';
import AutoHeight from './AutoHeight';
import FlipRow from './FlipRow';
import BoxRow from './BoxRow';
import useHistory, { useUndoKeys } from '../useHistory';

// The case buttons in their rows (see .button-rows)
const ROWS = [['lower', 'upper'], ['title', 'sentence'], ['camel', 'snake'], ['kebab', 'tidy']]
  .map(keys => keys.map(k => CASES.find(c => c.key === k)));

export default function CaseConverter({ active }) {
  // Every change can be undone (the bottom bar, Ctrl + Z): typing is a step
  // per burst; a paste or a conversion is a step of its own
  const [text, setTextStep, history] = useHistory('');
  const setText = (v, group) => setTextStep(v, group);
  useUndoKeys(active, history, { inFields: true });
  const [done, flagDone] = useDoneFlags();
  const textareaRef = useRef(null);
  const toast = useToast();
  // (counted a beat behind on huge text: every key waited on the count)
  const counted = useDeferredValue(text);
  const stats = useMemo(() => textStats(counted), [counted]);

  const handlePaste = async (e) => {
    if (e.detail) e.currentTarget.blur();
    try {
      const clip = await navigator.clipboard.readText();
      if (clip) {
        setText(clip);
        flagDone('paste');
      }
    } catch {
      // Not allowed to read the clipboard: put the cursor in the box so a
      // long-press / Ctrl+V paste goes straight in
      textareaRef.current?.focus();
      toast('paste with ctrl+v or a long-press in the box');
    }
  };

  const handleConvert = async (e, c) => {
    if (e.detail) e.currentTarget.blur();
    const converted = c.fn(text);
    setText(converted);
    if (await copyText(converted)) {
      flagDone(c.key);
    } else {
      toast("couldn't copy — select the text and copy it", { warn: true });
    }
  };

  return (
    <div className="tool">
      <textarea
        ref={textareaRef}
        className="tool-textarea"
        value={text}
        onChange={(e) => setText(e.target.value, 'type')}
        placeholder="type or paste text"
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        aria-label="Text to convert"
      />
      {/* Undo · redo | the input buttons | clear; the stats under it */}
      <BoxRow
        history={history}
        onTrash={() => history.reset('')}
        trashDisabled={!text}
        held={!!text}
        actions={(
          <button
            className={`btn btn-icon ${done.paste ? 'btn-done' : ''}`}
            onClick={handlePaste}
            title="Paste from clipboard"
            aria-label="Paste from clipboard"
          >
            <ClipboardPaste size={14} />
          </button>
        )}
      >
        <AutoHeight className="tool-meta" aria-live="polite">
          {/* Label first, so only the numbers change (they count) */}
          <span className="tool-stats">
            characters <Count value={stats.chars} /> · words <Count value={stats.words} /> · lines <Count value={stats.lines} />
          </span>
        </AutoHeight>
      </BoxRow>
      {/* The same rows on every screen (a computer put them all on one or
          two lines, the groups run together): lower / UPPER, Title /
          Sentence, camel / snake, kebab / tidy (paste: in the box row) */}
      <div className="button-rows">
        {ROWS.map((row, i) => (
          <FlipRow key={i}>
            {row.map(c => (
              <button
                key={c.key}
                className={`btn ${done[c.key] ? 'btn-done' : ''}`}
                onClick={(e) => handleConvert(e, c)}
                disabled={!text.trim()}
                title={`Convert to ${c.label} and copy`}
              >
                {c.label}
              </button>
            ))}
          </FlipRow>
        ))}
      </div>
    </div>
  );
}
