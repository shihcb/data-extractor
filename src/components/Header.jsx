import React from 'react';

export default function Header({ currentStep = 1, totalSteps = 3 }) {
  return (
    <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
      <div>
        <h1 className="text-3xl sm:text-[40px] font-black tracking-tight text-[#0f172a] leading-none">
          Data Extractor
        </h1>
        <p className="text-sm font-medium text-[#64748b] mt-2">
          Upload paycheck or statement · Instant line-by-line copy
        </p>
      </div>

      {/* Progress Step Badge */}
      <div className="flex items-center gap-2 self-start sm:self-auto bg-[#0f172a] text-white px-4 py-2 rounded-full text-xs font-bold shadow-md shadow-slate-900/10">
        <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
        <span>
          Step {currentStep} of {totalSteps} {currentStep === 3 ? '· Complete' : ''}
        </span>
      </div>
    </header>
  );
}
