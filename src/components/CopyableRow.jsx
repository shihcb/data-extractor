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
      className={`group cursor-pointer saas-field-row ${
        highlight ? 'highlighted' : ''
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="text-xs font-bold text-[#64748b] uppercase tracking-wider mb-1">
          {label}
        </div>
        <div className={`font-mono text-lg sm:text-xl font-bold tracking-tight truncate ${
          highlight ? 'text-emerald-700' : 'text-[#0f172a]'
        }`}>
          {value}
        </div>
      </div>

      <button
        type="button"
        onClick={handleCopy}
        className={`btn-indigo-copy ${copied ? 'copied' : ''}`}
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
