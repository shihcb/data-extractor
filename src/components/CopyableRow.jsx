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

  if (isNotFound) return null; // Don't render empty unextracted fields to keep layout clean!

  return (
    <div
      onClick={handleCopy}
      className={`group cursor-pointer bg-white border border-slate-200/90 rounded-2xl p-4.5 shadow-sm transition-all duration-200 hover:shadow-md hover:border-indigo-300 hover:-translate-y-0.5 flex items-center justify-between gap-4 ${
        highlight ? 'ring-2 ring-emerald-400/40 bg-emerald-50/20' : ''
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
          {label}
        </div>
        <div className={`font-mono text-base sm:text-lg font-bold truncate ${
          highlight ? 'text-emerald-700' : 'text-slate-900'
        }`}>
          {value}
        </div>
      </div>

      <button
        type="button"
        onClick={handleCopy}
        className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
          copied
            ? 'bg-emerald-600 text-white shadow-sm'
            : 'bg-slate-100 text-slate-700 hover:bg-indigo-600 hover:text-white'
        }`}
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
