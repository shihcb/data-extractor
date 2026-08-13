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
        <div className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
          {label}
        </div>
        <div className={`font-mono text-lg sm:text-xl font-bold truncate ${
          highlight ? 'text-emerald-700' : 'text-slate-800'
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
        {copied ? <Check size={16} /> : <Copy size={16} />}
      </button>
    </div>
  );
}
