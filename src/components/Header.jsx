import React from 'react';
import { User, Moon, Info } from 'lucide-react';

export default function Header() {
  return (
    <div className="space-y-4 mb-6">
      {/* Top Bar: Brand on left, icons on right */}
      <header className="flex items-center justify-between py-2">
        <div className="flex items-baseline gap-2">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            shihab
          </h1>
          <span className="text-xs font-semibold text-slate-400">data extractor</span>
        </div>

        <div className="flex items-center gap-3">
          <button className="w-8 h-8 rounded-full bg-white border border-slate-200/80 shadow-sm flex items-center justify-center text-slate-700 hover:bg-slate-50 transition-colors">
            <User size={16} />
          </button>
          <button className="w-8 h-8 rounded-full bg-white border border-slate-200/80 shadow-sm flex items-center justify-center text-slate-700 hover:bg-slate-50 transition-colors">
            <Moon size={16} />
          </button>
        </div>
      </header>

      {/* Yellowish Alert Banner (matching screenshot) */}
      <div className="bg-[#fef9e7] border border-[#fde68a] rounded-xl px-4 py-2.5 flex items-center justify-center gap-2 text-xs font-semibold text-[#854d0e] text-center shadow-xs">
        <Info size={14} className="shrink-0 text-[#b45309]" />
        <span>to extract statement values upload your paycheck or credit card statement below</span>
      </div>
    </div>
  );
}
