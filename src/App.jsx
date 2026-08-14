import React, { useState, useEffect } from 'react';
import FileUpload from './components/FileUpload';
import Step2ExtractedData from './components/Step2ExtractedData';
import CaseConverter from './components/CaseConverter';

import { parsePdfText } from './utils/pdfParser';
import { parseImageText } from './utils/imageParser';
import { extractPaycheckData } from './utils/paycheckExtractor';
import { extractCardStatementData } from './utils/cardStatementExtractor';
import { extractTransactionData } from './utils/transactionExtractor';

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

  const [transactionFileName, setTransactionFileName] = useState(() => {
    return localStorage.getItem('extrkt_transaction_file_name') || '';
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

  const [transactionData, setTransactionData] = useState(() => {
    const saved = localStorage.getItem('extrkt_transaction_data');
    return saved ? JSON.parse(saved) : null;
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [isInitialAppLoad, setIsInitialAppLoad] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

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
    localStorage.setItem('extrkt_transaction_file_name', transactionFileName);
  }, [transactionFileName]);

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

  useEffect(() => {
    if (transactionData) {
      localStorage.setItem('extrkt_transaction_data', JSON.stringify(transactionData));
    } else {
      localStorage.removeItem('extrkt_transaction_data');
    }
  }, [transactionData]);

  // Handle initial page load timings
  useEffect(() => {
    setIsMounted(true);
    const timer = setTimeout(() => {
      setIsInitialAppLoad(false);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleClearFile = () => {
    if (activeDocType === 'paycheck') {
      setPaycheckFileName('');
      setPaycheckData(null);
      localStorage.removeItem('extrkt_paycheck_file_name');
      localStorage.removeItem('extrkt_paycheck_data');
    } else if (activeDocType === 'card') {
      setCardFileName('');
      setCardData(null);
      localStorage.removeItem('extrkt_card_file_name');
      localStorage.removeItem('extrkt_card_data');
    } else {
      setTransactionFileName('');
      setTransactionData(null);
      localStorage.removeItem('extrkt_transaction_file_name');
      localStorage.removeItem('extrkt_transaction_data');
    }

    if (!paycheckFileName && !cardFileName && !transactionFileName) {
      localStorage.removeItem('extrkt_timestamp');
    }
  };

  const handleFileUpload = async (file) => {
    if (!file) return;

    if (activeDocType !== 'transaction') {
      const fileLower = file.name.toLowerCase();
      if (!fileLower.includes('statement')) {
        console.log(`[Validation] File rejected in ${activeDocType} view:`, file.name);
        return;
      }
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

      if (activeDocType === 'paycheck') {
        const parsedPaycheck = extractPaycheckData(extractedRawText);
        setPaycheckData(parsedPaycheck);
        setPaycheckFileName(file.name);
      } else if (activeDocType === 'card') {
        const parsedCard = extractCardStatementData(extractedRawText);
        setCardData(parsedCard);
        setCardFileName(file.name);
      } else if (activeDocType === 'transaction') {
        const parsedTx = extractTransactionData(extractedRawText);
        setTransactionData(parsedTx);
        setTransactionFileName(file.name);
      }
    } catch (err) {
      console.error('File parsing error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePasteText = async (text) => {
    if (!text || typeof text !== 'string') return;

    setIsProcessing(true);
    localStorage.setItem('extrkt_timestamp', Date.now().toString());

    try {
      if (activeDocType === 'paycheck') {
        const parsedPaycheck = extractPaycheckData(text);
        setPaycheckData(parsedPaycheck);
        setPaycheckFileName('Pasted Content');
      } else if (activeDocType === 'card') {
        const parsedCard = extractCardStatementData(text);
        setCardData(parsedCard);
        setCardFileName('Pasted Content');
      } else if (activeDocType === 'transaction') {
        const parsedTx = extractTransactionData(text);
        setTransactionData(parsedTx);
        setTransactionFileName('Pasted Content');
      }
      // 'case' view has its own paste handling inside the textarea
    } catch (err) {
      console.error('Clipboard paste parsing error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Global paste listener (skip for case converter — its textarea handles its own input)
  useEffect(() => {
    const handleGlobalPaste = (e) => {
      if (isProcessing || activeDocType === 'case') return;
      const files = e.clipboardData?.files;
      if (files && files.length > 0) {
        handleFileUpload(files[0]);
      } else {
        const text = e.clipboardData?.getData('text');
        if (text) {
          handlePasteText(text);
        }
      }
    };
    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, [activeDocType, isProcessing, paycheckFileName, cardFileName, transactionFileName]);

  // Determine active view states
  const activeFileName = 
    activeDocType === 'paycheck' ? paycheckFileName : 
    activeDocType === 'card' ? cardFileName : 
    transactionFileName;

  const activeData = 
    activeDocType === 'paycheck' ? paycheckData : 
    activeDocType === 'card' ? cardData : 
    transactionData;

  const isStep2Complete = Boolean(activeData);

  // Tab definitions — order matches DOM order in the switcher
  // Widths: paycheck=94, card=126, transaction=100, case=112
  const tabDefs = [
    { key: 'paycheck',     label: 'paychecks',      width: 112 },
    { key: 'card',         label: 'bank statements', width: 150 },
    { key: 'transaction',  label: 'transactions',    width: 120 },
    { key: 'case',         label: 'case converter',  width: 132 },
  ];

  // Compute slider width + translateX from tabDefs
  const activeTabDef = tabDefs.find(t => t.key === activeDocType) ?? tabDefs[0];
  const sliderWidth = activeTabDef.width;
  const sliderTransform = tabDefs
    .slice(0, tabDefs.findIndex(t => t.key === activeDocType))
    .reduce((acc, t) => acc + t.width, 0);

  const isCaseView = activeDocType === 'case';

  // Global Keyboard Shortcuts (Shift + 1/2/3/4) to switch tabs
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Prevent action if user is actively typing in textarea or input field
        const activeEl = document.activeElement;
        const isTyping = activeEl && (
          activeEl.tagName === 'INPUT' || 
          activeEl.tagName === 'TEXTAREA' || 
          activeEl.isContentEditable
        );
        if (isTyping) return;

        if (e.key === '1') {
          e.preventDefault();
          setActiveDocType('paycheck');
        } else if (e.key === '2') {
          e.preventDefault();
          setActiveDocType('card');
        } else if (e.key === '3') {
          e.preventDefault();
          setActiveDocType('transaction');
        } else if (e.key === '4') {
          e.preventDefault();
          setActiveDocType('case');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-[#faf9f6] text-[#0f172a] px-4 sm:px-6 w-full flex flex-col items-center justify-center py-20 sm:py-24 relative">
      {/* View Switcher: fixed bottom-center on all displays */}
      <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-20">
        <div className="modern-tab-switch">
          <div 
            className={`modern-tab-slider ${!isMounted ? 'no-transition' : ''}`}
            style={{
              width: `${sliderWidth}px`,
              transform: `translate3d(${sliderTransform}px, 0, 0)`
            }}
          />
          {tabDefs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveDocType(tab.key)}
              className={`modern-tab-btn ${activeDocType === tab.key ? 'active' : ''}`}
              style={{ width: `${tab.width}px` }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Centered App Container */}
      <div className="app-container my-auto">

        {/* Case Converter View */}
        {isCaseView ? (
          <CaseConverter />
        ) : (
          <>
            {/* Upload Card Box Component */}
            <FileUpload
              onFileUpload={handleFileUpload}
              isProcessing={isProcessing}
              fileName={activeFileName}
              onClear={handleClearFile}
              uploadText={activeDocType === 'transaction' ? 'UPLOAD TRANSACTION' : 'UPLOAD STATEMENT'}
              uploadedLabel={activeDocType === 'transaction' ? 'Uploaded Transaction' : 'Uploaded Statement'}
            />

            {/* Extracted Value Cards */}
            <div 
              key={`results-${activeDocType}`} 
              className={`results-wrapper ${isStep2Complete ? 'visible' : ''}`}
            >
              <Step2ExtractedData
                data={activeData}
                docType={activeDocType}
                isCompleted={isStep2Complete}
                isInitialAppLoad={isInitialAppLoad}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
