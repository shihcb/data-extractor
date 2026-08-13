import React, { useState } from 'react';
import { Copy, Check, Sparkles } from 'lucide-react';

export default function CopyableRow({ label, value, icon: Icon, tag, highlight = false, onCopy }) {
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
    }, 2000);
  };

  const isNotFound = !value || value === 'Not Found';

  return (
    <div className={`field-row ${highlight ? 'highlighted' : ''} ${copied ? 'border-emerald-500/50' : ''}`}>
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {Icon && (
          <div className={`p-2 rounded-lg flex items-center justify-center shrink-0 ${
            highlight 
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
              : 'bg-slate-800/80 text-cyan-400 border border-slate-700/50'
          }`}>
            <Icon size={18} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {label}
            </span>
            {tag && (
              <span className="badge badge-paycheck text-[10px] px-1.5 py-0.5">
                {tag}
              </span>
            )}
          </div>
          <div className={`font-mono text-sm sm:text-base font-semibold truncate ${
            isNotFound ? 'text-slate-500 italic' : highlight ? 'text-emerald-300' : 'text-slate-100'
          }`}>
            {value}
          </div>
        </div>
      </div>

      <button
        onClick={handleCopy}
        disabled={isNotFound}
        title={isNotFound ? 'No value to copy' : `Copy ${label}`}
        className={`copy-btn ${copied ? 'copied' : ''} ${isNotFound ? 'opacity-40 cursor-not-allowed' : ''}`}
      >
        {copied ? (
          <>
            <Check size={14} className="text-emerald-400 animate-bounce" />
            <span>Copied!</span>
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
