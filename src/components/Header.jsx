import React from 'react';

export default function Header() {
  return (
    <header className="text-center pt-6 pb-2">
      <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
        Data Extractor
      </h1>
      <p className="text-xs sm:text-sm text-slate-500 mt-1">
        Upload a paycheck or statement to extract fields line-by-line.
      </p>
    </header>
  );
}
