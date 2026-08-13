import React from 'react';
import { Check } from 'lucide-react';

export default function Toast({ toast }) {
  if (!toast) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-bounce">
      <div className="bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-lg border border-slate-800 flex items-center gap-2 text-xs font-semibold">
        <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
          <Check size={12} />
        </span>
        <span>Copied "{toast.label}" to clipboard</span>
      </div>
    </div>
  );
}
