import React, { useDeferredValue, useMemo, useRef, useState } from 'react';
import { ClipboardPaste } from 'lucide-react';
import { CASES, textStats } from '../textCase';
import { copyText, useDoneFlags } from '../utils';
import { flashOutline } from '../motion';
import { useToast } from '../toastContext';
import Count from './Count';
import AutoHeight from './AutoHeight';
import FlipRow from './FlipRow';
import ActionBar from './ActionBar';

export default function CaseConverter({ active }) {
  const [text, setText] = useState('');
  const [done, flagDone] = useDoneFlags();
  const textareaRef = useRef(null);
  const toast = useToast();
  // (counted a beat behind on huge text: every key waited on the count)
  const counted = useDeferredValue(text);
  const stats = useMemo(() => textStats(counted), [counted]);
  // A conversion replaces the box's text, and the browser's own undo with
  // it: Ctrl + Z right after puts the text back as it was
  const lastConvert = useRef(null);

  const handlePaste = async (e) => {
    if (e.detail) e.currentTarget.blur();
    try {
      const clip = await navigator.clipboard.readText();
      if (clip) {
        setText(clip);
        flagDone('paste');
        flashOutline(textareaRef.current);
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
    if (converted !== text) lastConvert.current = { from: text, to: converted };
    setText(converted);
    flashOutline(textareaRef.current);
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
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          const last = lastConvert.current;
          if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z' && last && last.to === text) {
            e.preventDefault();
            lastConvert.current = null;
            setText(last.from);
          }
        }}
        placeholder="type or paste text"
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        aria-label="Text to convert"
      />
      <AutoHeight className="tool-meta" aria-live="polite">
        {/* Label first, so only the numbers change (they count) */}
        <span className="tool-stats">
          characters <Count value={stats.chars} /> · words <Count value={stats.words} /> · lines <Count value={stats.lines} />
        </span>
      </AutoHeight>
      <FlipRow>
        <button
          className={`btn btn-icon ${done.paste ? 'btn-done' : ''}`}
          onClick={handlePaste}
          title="Paste from clipboard"
          aria-label="Paste from clipboard"
        >
          <ClipboardPaste size={14} />
        </button>
        {CASES.map(c => (
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
      <ActionBar active={active} open={!!text} onClose={() => setText('')} label="Text" />
    </div>
  );
}
