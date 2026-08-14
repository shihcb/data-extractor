import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export default function CopyableRow({ label, value, highlight = false, onCopy, forceLowercaseCopy = false }) {
  const [copied, setCopied] = useState(false);

  const isPlaceholder = !value || value === 'N/A' || value === 'Not Found';
  const displayValue = isPlaceholder ? 'N/A' : value;

  const handleCopy = (e) => {
    e.stopPropagation();
    if (isPlaceholder) return;

    const textToCopy = forceLowercaseCopy ? displayValue.toLowerCase() : displayValue;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);

    if (onCopy) {
      onCopy(label, textToCopy);
    }

    setTimeout(() => {
      setCopied(false);
    }, 1800);
  };

  return (
    <div
      onClick={!isPlaceholder ? handleCopy : undefined}
      className={`independent-row-card select-none ${
        isPlaceholder ? 'cursor-default opacity-60' : 'group cursor-pointer'
      } ${
        highlight && !isPlaceholder ? 'highlighted' : ''
      }`}
      style={isPlaceholder ? { borderStyle: 'dashed', backgroundColor: '#fcfcfb' } : undefined}
    >
      {/* Left aligned text layout */}
      <div className="min-w-0 flex-1 text-left">
        <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-0.5">
          {label}
        </div>
        <div 
          key={displayValue}
          className={`font-mono text-sm sm:text-base font-bold truncate animate-value-change ${
            highlight && !isPlaceholder ? 'text-emerald-700' : 'text-slate-800'
          }`}
        >
          {displayValue}
        </div>
      </div>

      {/* Action Copy Button */}
      {!isPlaceholder && (
        <button
          type="button"
          onClick={handleCopy}
          className={`icon-copy-btn shrink-0 animate-value-change ${copied ? 'copied' : ''}`}
          title={`Copy ${label}`}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      )}
    </div>
  );
}
