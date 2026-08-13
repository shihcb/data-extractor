import React from 'react';

export default function Header() {
  return (
    <header className="flex items-center justify-between py-4 mb-2">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
          Data Extractor
        </h1>
      </div>
      <div className="w-8 h-8 rounded-full bg-slate-200/60 border border-slate-300/60 flex items-center justify-center text-xs font-bold text-slate-700">
        1
      </div>
    </header>
  );
}
