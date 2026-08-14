import React, { useState, useEffect } from 'react';
import FileUpload from './components/FileUpload';
import Step2ExtractedData from './components/Step2ExtractedData';

import { parsePdfText } from './utils/pdfParser';
import { parseImageText } from './utils/imageParser';
import { extractPaycheckData } from './utils/paycheckExtractor';
import { extractCardStatementData } from './utils/cardStatementExtractor';

export default function App() {
  // Check 30-minute expiration before loading initial states
  useEffect(() => {
    localStorage.removeItem('extrkt_file_name');

    const savedTimestamp = localStorage.getItem('extrkt_timestamp');
    if (savedTimestamp) {
      const elapsed = Date.now() - parseInt(savedTimestamp, 10);
      const THIRTY_MINUTES = 30 * 60 * 1000;
      if (elapsed > THIRTY_MINUTES) {
        localStorage.clear();
      }
    }
  }, []);

  const [activeDocType, setActiveDocType] = useState(() => {
    return localStorage.getItem('extrkt_doc_type') || 'paycheck';
  });
  
  // Independent File Upload Names per View
  const [paycheckFileName, setPaycheckFileName] = useState(() => {
    return localStorage.getItem('extrkt_paycheck_file_name') || '';
  });

  const [cardFileName, setCardFileName] = useState(() => {
    return localStorage.getItem('extrkt_card_file_name') || '';
  });

  // Independent Parsed Data per View
  const [paycheckData, setPaycheckData] = useState(() => {
    const saved = localStorage.getItem('extrkt_paycheck_data');
    return saved ? JSON.parse(saved) : null;
  });

  const [cardData, setCardData] = useState(() => {
    const saved = localStorage.getItem('extrkt_card_data');
    return saved ? JSON.parse(saved) : null;
  });

  const [isProcessing, setIsProcessing] = useState(false);

  // Sync state changes with localStorage
  useEffect(() => {
    localStorage.setItem('extrkt_doc_type', activeDocType);
  }, [activeDocType]);

  useEffect(() => {
    localStorage.setItem('extrkt_paycheck_file_name', paycheckFileName);
  }, [paycheckFileName]);

  useEffect(() => {
    localStorage.setItem('extrkt_card_file_name', cardFileName);
  }, [cardFileName]);

  useEffect(() => {
    if (paycheckData) {
      localStorage.setItem('extrkt_paycheck_data', JSON.stringify(paycheckData));
    } else {
      localStorage.removeItem('extrkt_paycheck_data');
    }
  }, [paycheckData]);

  useEffect(() => {
    if (cardData) {
      localStorage.setItem('extrkt_card_data', JSON.stringify(cardData));
    } else {
      localStorage.removeItem('extrkt_card_data');
    }
  }, [cardData]);

  const handleClearFile = () => {
    if (activeDocType === 'paycheck') {
      setPaycheckFileName('');
      setPaycheckData(null);
      localStorage.removeItem('extrkt_paycheck_file_name');
      localStorage.removeItem('extrkt_paycheck_data');
    } else {
      setCardFileName('');
      setCardData(null);
      localStorage.removeItem('extrkt_card_file_name');
      localStorage.removeItem('extrkt_card_data');
    }

    // Reset timestamp if BOTH are cleared
    if (!paycheckFileName && !cardFileName) {
      localStorage.removeItem('extrkt_timestamp');
    }
  };

  const handleFileUpload = async (file) => {
    if (!file) return;

    // Reject files that do NOT contain "statement" (case-insensitive) - SILENTLY
    const fileLower = file.name.toLowerCase();
    if (!fileLower.includes('statement')) {
      return;
    }

    setIsProcessing(true);
    localStorage.setItem('extrkt_timestamp', Date.now().toString());

    try {
      let extractedRawText = '';
      const fileExt = file.name.split('.').pop().toLowerCase();

      if (fileExt === 'pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const pdfResult = await parsePdfText(arrayBuffer);
        extractedRawText = pdfResult.fullText;
      } else if (['png', 'jpg', 'jpeg', 'webp'].includes(fileExt)) {
        extractedRawText = await parseImageText(file);
      } else {
        extractedRawText = await file.text();
      }

      // Parse and save data strictly inside the active tab's scope if content is valid!
      if (activeDocType === 'paycheck') {
        const parsedPaycheck = extractPaycheckData(extractedRawText);
        const hasPaycheckInfo = parsedPaycheck.netPay !== 'Not Found' || parsedPaycheck.grossIncome !== 'Not Found';
        if (hasPaycheckInfo) {
          setPaycheckData(parsedPaycheck);
          setPaycheckFileName(file.name);
        }
      } else {
        const parsedCard = extractCardStatementData(extractedRawText);
        const hasCardInfo = parsedCard.statementBalance !== 'Not Found' || parsedCard.startDate !== 'Not Found';
        if (hasCardInfo) {
          setCardData(parsedCard);
          setCardFileName(file.name);
        }
      }
    } catch (err) {
      console.error('File parsing error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Determine active view states
  const activeFileName = activeDocType === 'paycheck' ? paycheckFileName : cardFileName;
  const activeData = activeDocType === 'paycheck' ? paycheckData : cardData;
  const isStep2Complete = Boolean(activeData);

  // Calculate sliding dimensions for switcher animation
  const isCard = activeDocType === 'card';
  const sliderWidth = isCard ? 136 : 94;
  const sliderTransform = isCard ? 98 : 0;

  return (
    <div className={`min-h-screen bg-[#faf9f6] text-[#0f172a] px-4 sm:px-6 w-full flex flex-col items-center justify-center py-20 sm:py-24 relative`}>
      {/* View Switcher: fixed bottom-center on mobile, absolute top-right on desktop */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-20 sm:absolute sm:top-6 sm:right-6 sm:bottom-auto sm:left-auto sm:translate-x-0">
        <div className="modern-tab-switch">
          {/* Animated Slider Highlight pill */}
          <div 
            className="modern-tab-slider"
            style={{
              width: `${sliderWidth}px`,
              transform: `translate3d(${sliderTransform}px, 0, 0)`
            }}
          />
          <button
            onClick={() => setActiveDocType('paycheck')}
            className={`modern-tab-btn ${activeDocType === 'paycheck' ? 'active' : ''}`}
            style={{ width: '94px' }}
          >
            paychecks
          </button>
          <button
            onClick={() => setActiveDocType('card')}
            className={`modern-tab-btn ${activeDocType === 'card' ? 'active' : ''}`}
            style={{ width: '136px' }}
          >
            bank statements
          </button>
        </div>
      </div>

      {/* Centered App Container */}
      <div className="app-container my-auto">
        
        {/* Upload Card Box Component */}
        <FileUpload
          onFileUpload={handleFileUpload}
          isProcessing={isProcessing}
          fileName={activeFileName}
          onClear={handleClearFile}
        />

        {/* Extracted Value Cards with Unique Prefix Key */}
        <div 
          key={`results-${activeDocType}`} 
          className={`results-wrapper ${isStep2Complete ? 'visible' : ''}`}
        >
          <Step2ExtractedData
            data={activeData}
            docType={activeDocType}
            isCompleted={isStep2Complete}
          />
        </div>
      </div>
    </div>
  );
}
