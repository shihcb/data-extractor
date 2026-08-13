import React, { useState } from 'react';
import { Eye, EyeOff, Copy, Check } from 'lucide-react';

export default function DocumentViewer({ rawText }) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyRaw = () => {
    navigator.clipboard.writeText(rawText || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="minimal-card p-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="text-xs font-semibold text-slate-500 hover:text-slate-900 flex items-center gap-1.5"
        >
          {isOpen ? <EyeOff size={14} /> : <Eye size={14} />}
          <span>{isOpen ? 'Hide Raw Text' : 'View Raw Extracted Text'}</span>
        </button>

        {isOpen && (
          <button
            onClick={handleCopyRaw}
            className="copy-btn text-xs py-1 px-2.5"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy Raw'}</span>
          </button>
        )}
      </div>

      {isOpen && (
        <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-700 max-h-56 overflow-y-auto whitespace-pre-wrap select-all">
          {rawText || 'No text extracted.'}
        </div>
      )}
    </div>
  );
}
