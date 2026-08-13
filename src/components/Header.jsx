import React from 'react';

export default function Header() {
  return (
    <header className="text-center pt-8 pb-4">
      <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
        Data Extractor
      </h1>
      <p className="text-xs text-slate-400 mt-1 font-medium">
        Extract paycheck details and copy fields instantly.
      </p>
    </header>
  );
}
