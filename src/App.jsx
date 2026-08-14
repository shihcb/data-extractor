import React, { useState, useEffect } from 'react';
import FileUpload from './components/FileUpload';
import Step2ExtractedData from './components/Step2ExtractedData';

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

    // Reset timestamp if ALL are cleared
    if (!paycheckFileName && !cardFileName && !transactionFileName) {
      localStorage.removeItem('extrkt_timestamp');
    }
  };

  const handleFileUpload = async (file) => {
    if (!file) return;

    // Reject files that do NOT contain "statement" or "purchase" or "approved" (case-insensitive) - SILENTLY
    const fileLower = file.name.toLowerCase();
    const isValidName = fileLower.includes('statement') || fileLower.includes('purchase') || fileLower.includes('approved') || fileLower.includes('email');
    if (!isValidName) {
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

      // Parse and save data strictly inside the active tab's scope if ALL core fields exist!
      if (activeDocType === 'paycheck') {
        const parsedPaycheck = extractPaycheckData(extractedRawText);
        const hasAllPaycheckInfo = 
          parsedPaycheck.netPay !== 'Not Found' && 
          parsedPaycheck.grossIncome !== 'Not Found' && 
          parsedPaycheck.payPeriod !== 'Not Found' && 
          parsedPaycheck.paycheckNumber !== 'Not Found';

        if (hasAllPaycheckInfo) {
          setPaycheckData(parsedPaycheck);
          setPaycheckFileName(file.name);
        }
      } else if (activeDocType === 'card') {
        const parsedCard = extractCardStatementData(extractedRawText);
        const hasAllCardInfo = 
          parsedCard.statementBalance !== 'Not Found' && 
          parsedCard.startDate !== 'Not Found' && 
          parsedCard.endDate !== 'Not Found' && 
          parsedCard.statementPeriod !== 'Not Found';

        if (hasAllCardInfo) {
          setCardData(parsedCard);
          setCardFileName(file.name);
        }
      } else {
        const parsedTx = extractTransactionData(extractedRawText);
        const hasAllTxInfo = 
          parsedTx.amount !== 'Not Found' && 
          parsedTx.dateTime !== 'Not Found' && 
          parsedTx.merchant !== 'Not Found';

        if (hasAllTxInfo) {
          setTransactionData(parsedTx);
          setTransactionFileName(file.name);
        }
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
        const hasAllPaycheckInfo = 
          parsedPaycheck.netPay !== 'Not Found' && 
          parsedPaycheck.grossIncome !== 'Not Found' && 
          parsedPaycheck.payPeriod !== 'Not Found' && 
          parsedPaycheck.paycheckNumber !== 'Not Found';

        if (hasAllPaycheckInfo) {
          setPaycheckData(parsedPaycheck);
          setPaycheckFileName('Pasted Content');
        }
      } else if (activeDocType === 'card') {
        const parsedCard = extractCardStatementData(text);
        const hasAllCardInfo = 
          parsedCard.statementBalance !== 'Not Found' && 
          parsedCard.startDate !== 'Not Found' && 
          parsedCard.endDate !== 'Not Found' && 
          parsedCard.statementPeriod !== 'Not Found';

        if (hasAllCardInfo) {
          setCardData(parsedCard);
          setCardFileName('Pasted Content');
        }
      } else {
        const parsedTx = extractTransactionData(text);
        const hasAllTxInfo = 
          parsedTx.amount !== 'Not Found' && 
          parsedTx.dateTime !== 'Not Found' && 
          parsedTx.merchant !== 'Not Found';

        if (hasAllTxInfo) {
          setTransactionData(parsedTx);
          setTransactionFileName('Pasted Content');
        }
      }
    } catch (err) {
      console.error('Clipboard paste parsing error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Add global window paste listener to catch files or text copied from clipboard (Cmd+V)
  useEffect(() => {
    const handleGlobalPaste = (e) => {
      if (isProcessing) return;
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

  // Calculate sliding dimensions for switcher animation
  const sliderWidth = 
    activeDocType === 'paycheck' ? 94 : 
    activeDocType === 'card' ? 126 : 
    100;

  const sliderTransform = 
    activeDocType === 'paycheck' ? 0 : 
    activeDocType === 'card' ? 94 : // Paycheck button width
    220; // Paycheck button (94) + Bank Statement button (126) = 220

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
            style={{ width: '126px' }}
          >
            bank statements
          </button>
          <button
            onClick={() => setActiveDocType('transaction')}
            className={`modern-tab-btn ${activeDocType === 'transaction' ? 'active' : ''}`}
            style={{ width: '100px' }}
          >
            transactions
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
