import React, { useMemo, useRef, useState } from 'react';
import { ClipboardPaste } from 'lucide-react';
import { CASES, textStats } from '../textCase';
import { copyText, useDoneFlags } from '../utils';
import { flashOutline } from '../motion';
import { useToast } from '../toastContext';
import Count from './Count';
import AutoHeight from './AutoHeight';
import FlipRow from './FlipRow';

export default function CaseConverter() {
  const [text, setText] = useState('');
  const [done, flagDone] = useDoneFlags();
  const textareaRef = useRef(null);
  const toast = useToast();
  const stats = useMemo(() => textStats(text), [text]);

  const handlePaste = async (e) => {
    e.currentTarget.blur();
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
    e.currentTarget.blur();
    const converted = c.fn(text);
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
    </div>
  );
}
