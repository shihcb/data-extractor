import React, { useState, useEffect } from 'react';
import CaseConverter from './components/CaseConverter';
import ImageConverter from './components/ImageConverter';
import TabSwitcher from './components/TabSwitcher';

const TABS = [
  { key: 'case',  label: 'case converter' },
  { key: 'image', label: 'image converter' },
];

const readTab = () => {
  try {
    const saved = localStorage.getItem('active_tab');
    return TABS.some(t => t.key === saved) ? saved : 'case';
  } catch {
    return 'case';
  }
};

export default function App() {
  const [activeTab, setActiveTab] = useState(readTab);

  useEffect(() => {
    try {
      localStorage.setItem('active_tab', activeTab);
    } catch {
      // storage unavailable; the tab just won't be remembered
    }
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-[#faf9f6] text-[#0f172a] px-4 sm:px-6 w-full flex flex-col items-center justify-center py-20 sm:py-24 relative">
      <div className="app-container my-auto">
        <div className="flex justify-center mb-5">
          <TabSwitcher tabs={TABS} active={activeTab} onChange={setActiveTab} />
        </div>
        <div key={activeTab} className="tab-pane">
          {activeTab === 'case' ? <CaseConverter /> : <ImageConverter />}
        </div>
      </div>
    </div>
  );
}
