import React from 'react';
import { FileText, ShieldCheck, CreditCard, DollarSign, Sparkles } from 'lucide-react';

export default function Header({ activeDocType, setActiveDocType, onLoadSample }) {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-slate-950/70 border-b border-slate-800/80 px-4 sm:px-8 py-3.5 transition-all">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Brand logo & tagline */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-emerald-500 to-violet-600 p-[1px] shadow-lg shadow-cyan-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[11px] flex items-center justify-center text-cyan-400 font-extrabold text-xl">
              ⚡
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-xl sm:text-2xl tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                Extrkt
              </h1>
              <span className="badge badge-success text-[11px] px-2 py-0.5">
                v1.0
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">
              Line-by-Line Statement & Paycheck Data Extractor
            </p>
          </div>
        </div>

        {/* Center: Mode switcher */}
        <div className="flex items-center p-1 bg-slate-900/90 rounded-xl border border-slate-800 shadow-inner">
          <button
            onClick={() => setActiveDocType('paycheck')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
              activeDocType === 'paycheck'
                ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/25'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <DollarSign size={16} />
            <span>Paychecks & Paystubs</span>
          </button>
          <button
            onClick={() => setActiveDocType('card')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
              activeDocType === 'card'
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-500/25'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <CreditCard size={16} />
            <span>Credit / Debit Cards</span>
          </button>
        </div>

        {/* Right side: Quick Demo Preset buttons & Privacy Badge */}
        <div className="flex items-center gap-2">
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
            <ShieldCheck size={14} />
            <span>100% Client-Side Private</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onLoadSample('paycheck')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/30 text-violet-300 text-xs font-semibold transition-all"
            >
              <Sparkles size={13} />
              <span>Sample Paystub</span>
            </button>
            <button
              onClick={() => onLoadSample('card')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 text-xs font-semibold transition-all"
            >
              <Sparkles size={13} />
              <span>Sample Card</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
