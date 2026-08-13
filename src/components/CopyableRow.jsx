import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export default function CopyableRow({ label, value, highlight = false, onCopy }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e) => {
    e.stopPropagation();
    if (!value || value === 'Not Found') return;

    navigator.clipboard.writeText(value);
    setCopied(true);

    if (onCopy) {
      onCopy(label, value);
    }

    setTimeout(() => {
      setCopied(false);
    }, 1800);
  };

  const isNotFound = !value || value === 'Not Found';

  return (
    <div className={`field-row ${highlight ? 'highlighted' : ''}`}>
      <div className="min-w-0 flex-1 pr-2">
        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
          {label}
        </div>
        <div className={`font-mono text-sm sm:text-base font-semibold truncate ${
          isNotFound ? 'text-slate-400 italic font-normal' : highlight ? 'text-emerald-700 font-bold' : 'text-slate-900'
        }`}>
          {value}
        </div>
      </div>

      <button
        onClick={handleCopy}
        disabled={isNotFound}
        title={isNotFound ? 'No value to copy' : `Copy ${label}`}
        className={`copy-btn shrink-0 ${copied ? 'copied' : ''} ${isNotFound ? 'opacity-40 cursor-not-allowed' : ''}`}
      >
        {copied ? (
          <>
            <Check size={14} />
            <span>Copied</span>
          </>
        ) : (
          <>
            <Copy size={14} />
            <span>Copy</span>
          </>
        )}
      </button>
    </div>
  );
}
