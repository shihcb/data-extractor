import React, { useState, useRef } from 'react';

export default function CaseConverter() {
  const [text, setText] = useState('');
  const [copiedLower, setCopiedLower] = useState(false);
  const [copiedUpper, setCopiedUpper] = useState(false);
  const textareaRef = useRef(null);

  const handleConvert = async (e, mode) => {
    // Immediately blur the button so mobile doesn't keep it in an active/hover state
    e.currentTarget.blur();

    const converted = mode === 'lower' ? text.toLowerCase() : text.toUpperCase();
    setText(converted);
    try {
      await navigator.clipboard.writeText(converted);
    } catch {
      if (textareaRef.current) {
        textareaRef.current.select();
        document.execCommand('copy');
      }
    }
    if (mode === 'lower') {
      setCopiedLower(true);
      setTimeout(() => setCopiedLower(false), 1800);
    } else {
      setCopiedUpper(true);
      setTimeout(() => setCopiedUpper(false), 1800);
    }
  };

  return (
    <div className="case-converter-wrapper">
      <textarea
        ref={textareaRef}
        className="case-converter-textarea"
        placeholder="Paste or type text here..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
      />
      <div className="case-converter-actions">
        <button
          className={`case-btn ${copiedLower ? 'case-btn-copied' : ''}`}
          onClick={(e) => handleConvert(e, 'lower')}
          disabled={!text.trim()}
        >
          lowercase
        </button>
        <button
          className={`case-btn case-btn-upper ${copiedUpper ? 'case-btn-copied' : ''}`}
          onClick={(e) => handleConvert(e, 'upper')}
          disabled={!text.trim()}
        >
          UPPERCASE
        </button>
      </div>
    </div>
  );
}
