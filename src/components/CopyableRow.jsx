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
      className={`group cursor-pointer reference-inset p-4 transition-all duration-150 hover:border-slate-400 flex items-center justify-between gap-4 ${
        highlight ? 'ring-2 ring-emerald-500/30 bg-emerald-50/20' : ''
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
          {label}
        </div>
        <div className={`font-mono text-base font-bold truncate ${
          highlight ? 'text-emerald-700' : 'text-slate-900'
        }`}>
          {value}
        </div>
      </div>

      <button
        type="button"
        onClick={handleCopy}
        className={`copy-pill-btn shrink-0 ${copied ? 'copied' : ''}`}
      >
        {copied ? (
          <>
            <Check size={13} />
            <span>copied</span>
          </>
        ) : (
          <>
            <Copy size={13} />
            <span>copy</span>
          </>
        )}
      </button>
    </div>
  );
}
