import React from 'react';
import CaseConverter from './components/CaseConverter';

export default function App() {
  return (
    <div className="min-h-screen bg-[#faf9f6] text-[#0f172a] px-4 sm:px-6 w-full flex flex-col items-center justify-center py-20 sm:py-24 relative">
      <div className="app-container my-auto">
        <CaseConverter />
      </div>
    </div>
  );
}
