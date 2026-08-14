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
  
  const [fileName, setFileName] = useState(() => {
    return localStorage.getItem('extrkt_file_name') || '';
  });

  const [paycheckData, setPaycheckData] = useState(() => {
    const saved = localStorage.getItem('extrkt_paycheck_data');
    return saved ? JSON.parse(saved) : null;
  });

  const [cardData, setCardData] = useState(() => {
    const saved = localStorage.getItem('extrkt_card_data');
    return saved ? JSON.parse(saved) : null;
  });

  const [isProcessing, setIsProcessing] = useState(false);

  const isStep2Complete = Boolean(paycheckData || cardData);

  useEffect(() => {
    localStorage.setItem('extrkt_doc_type', activeDocType);
  }, [activeDocType]);

  useEffect(() => {
    localStorage.setItem('extrkt_file_name', fileName);
  }, [fileName]);

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
    setFileName('');
    setPaycheckData(null);
    setCardData(null);
    localStorage.removeItem('extrkt_file_name');
    localStorage.removeItem('extrkt_paycheck_data');
    localStorage.removeItem('extrkt_card_data');
    localStorage.removeItem('extrkt_timestamp');
  };

  const handleFileUpload = async (file) => {
    if (!file) return;

    // Reject files that do NOT contain "statement" (case-insensitive) - SILENTLY
    const fileLower = file.name.toLowerCase();
    if (!fileLower.includes('statement')) {
      return;
    }

    setIsProcessing(true);
    setFileName(file.name);
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

      // Extract paycheck data and bank card statement data simultaneously
      const parsedPaycheck = extractPaycheckData(extractedRawText);
      const parsedCard = extractCardStatementData(extractedRawText);

      setPaycheckData(parsedPaycheck);
      setCardData(parsedCard);

      // Do NOT auto-switch activeDocType back to paychecks! Maintain whatever activeDocType is currently toggled.
    } catch (err) {
      console.error('File parsing error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const activeData = activeDocType === 'paycheck' ? paycheckData : cardData;

  // Calculate sliding dimensions for switcher animation
  const isCard = activeDocType === 'card';
  const sliderWidth = isCard ? 122 : 88;
  const sliderTransform = isCard ? 92 : 0;

  return (
    <div className={`min-h-screen bg-[#faf9f6] text-[#0f172a] px-4 sm:px-6 w-full flex flex-col items-center justify-center py-20 sm:py-24 relative`}>
      {/* Top Right Switched Button Container */}
      <div className="absolute top-6 right-6 z-10">
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
            style={{ width: '88px' }}
          >
            paychecks
          </button>
          <button
            onClick={() => setActiveDocType('card')}
            className={`modern-tab-btn ${activeDocType === 'card' ? 'active' : ''}`}
            style={{ width: '122px' }}
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
          fileName={fileName}
          onClear={handleClearFile}
        />

        {/* Extracted Value Cards */}
        {isStep2Complete && (
          <div className="step-reveal">
            <Step2ExtractedData
              data={activeData}
              docType={activeDocType}
              isCompleted={isStep2Complete}
            />
          </div>
        )}
      </div>
    </div>
  );
}
