import React from 'react';
import { FileText, CreditCard, Sparkles } from 'lucide-react';

export default function Header({ activeDocType, setActiveDocType, onLoadSample }) {
  return (
    <header className="text-center pt-8 pb-4">
      {/* Title */}
      <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
        Data Extractor
      </h1>
      <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
        Extract paycheck & statement values line-by-line with 1-click copy buttons.
      </p>

      {/* Mode Switcher */}
      <div className="inline-flex items-center p-1 bg-slate-200/80 rounded-xl mt-5 gap-1 border border-slate-300/60">
        <button
          onClick={() => setActiveDocType('paycheck')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeDocType === 'paycheck'
              ? 'bg-white text-indigo-600 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileText size={15} />
          <span>Paychecks</span>
        </button>
        <button
          onClick={() => setActiveDocType('card')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeDocType === 'card'
              ? 'bg-white text-indigo-600 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <CreditCard size={15} />
          <span>Card Statements</span>
        </button>
      </div>

      {/* Quick Sample Preset loaders */}
      <div className="flex items-center justify-center gap-2 mt-3">
        <button
          onClick={() => onLoadSample('paycheck')}
          className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 transition-colors"
        >
          <Sparkles size={12} />
          <span>Try Paystub Sample</span>
        </button>
        <button
          onClick={() => onLoadSample('card')}
          className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 transition-colors"
        >
          <Sparkles size={12} />
          <span>Try Card Sample</span>
        </button>
      </div>
    </header>
  );
}
