import React from 'react';
import { CheckCircle2, Copy } from 'lucide-react';

export default function Toast({ toast }) {
  if (!toast) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-bounce">
      <div className="glass-panel px-4 py-3 bg-slate-900/95 border-emerald-500/50 shadow-xl shadow-emerald-500/20 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
          <CheckCircle2 size={18} />
        </div>
        <div>
          <p className="text-xs font-bold text-emerald-300">
            Copied "{toast.label}" to clipboard!
          </p>
          <p className="text-[11px] font-mono text-slate-300 truncate max-w-[240px]">
            {toast.value}
          </p>
        </div>
      </div>
    </div>
  );
}
