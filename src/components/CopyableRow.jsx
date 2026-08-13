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

  if (isNotFound) return null;

  return (
    <div
      onClick={handleCopy}
      className={`group cursor-pointer independent-row-card ${
        highlight ? 'highlighted' : ''
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="text-xs sm:text-sm font-extrabold text-slate-400 uppercase tracking-wider mb-1">
          {label}
        </div>
        <div className={`font-mono text-xl sm:text-2xl font-extrabold tracking-tight truncate ${
          highlight ? 'text-emerald-700' : 'text-slate-900'
        }`}>
          {value}
        </div>
      </div>

      <button
        type="button"
        onClick={handleCopy}
        className={`icon-copy-btn shrink-0 ${copied ? 'copied' : ''}`}
        title={`Copy ${label}`}
      >
        {copied ? <Check size={18} /> : <Copy size={18} />}
      </button>
    </div>
  );
}
