import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { ClipboardPaste } from 'lucide-react';
import { FORMATTERS, detectKind } from '../formatters';
import { copyText, useDoneFlags } from '../utils';
import { fadeIn, flashOutline } from '../motion';
import { useToast } from '../toastContext';

export default function Formatter() {
  const [text, setText] = useState('');
  const [done, flagDone] = useDoneFlags();
  const textareaRef = useRef(null);
  const kindRef = useRef(null);
  const toast = useToast();
  // Checked a beat behind typing, so big pastes stay smooth
  const deferred = useDeferredValue(text);
  const kind = useMemo(() => detectKind(deferred), [deferred]);
  // The status text just fades to its new words
  const prevKind = useRef(kind);
  useEffect(() => {
    if (prevKind.current === kind) return;
    prevKind.current = kind;
    fadeIn(kindRef.current);
  }, [kind]);

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
      textareaRef.current?.focus();
      toast('paste with ctrl+v or a long-press in the box');
    }
  };

  const run = async (e, f) => {
    e.currentTarget.blur();
    let out;
    try {
      out = f.fn(text);
    } catch (err) {
      toast(err.message, { warn: true });
      return;
    }
    setText(out);
    flashOutline(textareaRef.current);
    if (await copyText(out)) flagDone(f.key);
    else toast("couldn't copy — select the text and copy it", { warn: true });
  };

  return (
    <div className="tool">
      <textarea
        ref={textareaRef}
        className="tool-textarea mono"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="paste JSON, a URL or Base64"
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        aria-label="Text to format"
      />
      <p className="tool-meta" aria-live="polite">
        <span ref={kindRef}>{kind || ' '}</span>
      </p>
      <div className="tool-actions">
        <button
          className={`btn btn-icon ${done.paste ? 'btn-done' : ''}`}
          onClick={handlePaste}
          title="Paste from clipboard"
          aria-label="Paste from clipboard"
        >
          <ClipboardPaste size={14} />
        </button>
        {FORMATTERS.map(f => (
          <button
            key={f.key}
            className={`btn ${done[f.key] ? 'btn-done' : ''}`}
            onClick={(e) => run(e, f)}
            disabled={!text.trim()}
            title={`${f.label} and copy`}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  );
}
