import React from 'react';

export default function Header() {
  return (
    <header className="flex items-center justify-between pb-4 border-b border-slate-200/80">
      <div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
          Data Extractor
        </h1>
        <p className="text-xs sm:text-sm font-medium text-slate-500 mt-1">
          Upload paycheck or statement • Instant line-by-line copy
        </p>
      </div>
      <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-sm shadow-md">
        1
      </div>
    </header>
  );
}
