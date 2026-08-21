import React, { useState, useEffect } from 'react';
import FileUpload from './components/FileUpload';
import Step2ExtractedData from './components/Step2ExtractedData';
import CaseConverter from './components/CaseConverter';
import DocumentQA from './components/DocumentQA';

import { parsePdfText } from './utils/pdfParser';
import { parseImageText } from './utils/imageParser';
import { extractPaycheckData } from './utils/paycheckExtractor';
import { extractCardStatementData } from './utils/cardStatementExtractor';
import { extractTransactionData } from './utils/transactionExtractor';
import { extractDataWithAI } from './utils/aiExtractor';

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

  // Independent Raw Text per View
  const [paycheckRawText, setPaycheckRawText] = useState(() => {
    return localStorage.getItem('extrkt_paycheck_raw_text') || '';
  });

  const [cardRawText, setCardRawText] = useState(() => {
    return localStorage.getItem('extrkt_card_raw_text') || '';
  });

  const [transactionRawText, setTransactionRawText] = useState(() => {
    return localStorage.getItem('extrkt_transaction_raw_text') || '';
  });

  const [paycheckMethod, setPaycheckMethod] = useState(() => {
    return localStorage.getItem('extrkt_paycheck_method') || 'local';
  });

  const [cardMethod, setCardMethod] = useState(() => {
    return localStorage.getItem('extrkt_card_method') || 'local';
  });

  const [transactionMethod, setTransactionMethod] = useState(() => {
    return localStorage.getItem('extrkt_transaction_method') || 'local';
  });

  const [isProcessing, setIsProcessing] = useState(false);
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

  useEffect(() => {
    if (paycheckRawText) {
      localStorage.setItem('extrkt_paycheck_raw_text', paycheckRawText);
    } else {
      localStorage.removeItem('extrkt_paycheck_raw_text');
    }
  }, [paycheckRawText]);

  useEffect(() => {
    if (cardRawText) {
      localStorage.setItem('extrkt_card_raw_text', cardRawText);
    } else {
      localStorage.removeItem('extrkt_card_raw_text');
    }
  }, [cardRawText]);

  useEffect(() => {
    if (transactionRawText) {
      localStorage.setItem('extrkt_transaction_raw_text', transactionRawText);
    } else {
      localStorage.removeItem('extrkt_transaction_raw_text');
    }
  }, [transactionRawText]);

  useEffect(() => {
    localStorage.setItem('extrkt_paycheck_method', paycheckMethod);
  }, [paycheckMethod]);

  useEffect(() => {
    localStorage.setItem('extrkt_card_method', cardMethod);
  }, [cardMethod]);

  useEffect(() => {
    localStorage.setItem('extrkt_transaction_method', transactionMethod);
  }, [transactionMethod]);

  // Handle initial page load timings
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Archive state and sync
  const [archiveItems, setArchiveItems] = useState(() => {
    const saved = localStorage.getItem('extrkt_archive');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('extrkt_archive', JSON.stringify(archiveItems));
  }, [archiveItems]);

  const handleClearFile = () => {
    if (activeDocType === 'paycheck') {
      setPaycheckFileName('');
      setPaycheckData(null);
      setPaycheckRawText('');
      setPaycheckMethod('local');
      localStorage.removeItem('extrkt_paycheck_file_name');
      localStorage.removeItem('extrkt_paycheck_data');
      localStorage.removeItem('extrkt_paycheck_raw_text');
      localStorage.removeItem('extrkt_paycheck_method');
    } else if (activeDocType === 'card') {
      setCardFileName('');
      setCardData(null);
      setCardRawText('');
      setCardMethod('local');
      localStorage.removeItem('extrkt_card_file_name');
      localStorage.removeItem('extrkt_card_data');
      localStorage.removeItem('extrkt_card_raw_text');
      localStorage.removeItem('extrkt_card_method');
    } else {
      setTransactionFileName('');
      setTransactionData(null);
      setTransactionRawText('');
      setTransactionMethod('local');
      localStorage.removeItem('extrkt_transaction_file_name');
      localStorage.removeItem('extrkt_transaction_data');
      localStorage.removeItem('extrkt_transaction_raw_text');
      localStorage.removeItem('extrkt_transaction_method');
    }

    if (!paycheckFileName && !cardFileName && !transactionFileName) {
      localStorage.removeItem('extrkt_timestamp');
    }
  };

  // Helper to save data state for a confirmed file
  const saveExtractedData = (type, data, fileName, rawText, method = 'local') => {
    if (type === 'paycheck') {
      setPaycheckData(data);
      setPaycheckFileName(fileName);
      setPaycheckRawText(rawText || '');
      setPaycheckMethod(method);
    } else if (type === 'card') {
      setCardData(data);
      setCardFileName(fileName);
      setCardRawText(rawText || '');
      setCardMethod(method);
    } else if (type === 'transaction') {
      setTransactionData(data);
      setTransactionFileName(fileName);
      setTransactionRawText(rawText || '');
      setTransactionMethod(method);
    }

    // Append to archive items
    setArchiveItems(prev => {
      const filtered = prev.filter(item => !(item.name === fileName && item.docType === type));
      return [
        {
          id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
          name: fileName,
          docType: type,
          data: data,
          rawText: rawText || '',
          method: method,
          timestamp: Date.now()
        },
        ...filtered
      ];
    });
  };

  const handleLoadFromArchive = (item) => {
    setActiveDocType(item.docType);
    if (item.docType === 'paycheck') {
      setPaycheckData(item.data);
      setPaycheckFileName(item.name);
      setPaycheckRawText(item.rawText || '');
      setPaycheckMethod(item.method || 'local');
    } else if (item.docType === 'card') {
      setCardData(item.data);
      setCardFileName(item.name);
      setCardRawText(item.rawText || '');
      setCardMethod(item.method || 'local');
    } else if (item.docType === 'transaction') {
      setTransactionData(item.data);
      setTransactionFileName(item.name);
      setTransactionRawText(item.rawText || '');
      setTransactionMethod(item.method || 'local');
    }
  };

  const handleDeleteFromArchive = (id) => {
    setArchiveItems(prev => prev.filter(item => item.id !== id));
  };

  const handleClearAllArchives = () => {
    setArchiveItems([]);
  };

  const handleFileUpload = async (file) => {
    if (!file) return;


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

      let parsedData = null;
      let method = 'local';
      const apiKey = localStorage.getItem('extrkt_gemini_api_key');
      if (apiKey) {
        try {
          parsedData = await extractDataWithAI(activeDocType, extractedRawText, apiKey);
          method = 'ai';
        } catch (err) {
          console.warn('AI extraction failed, falling back to regex extraction:', err);
          method = 'error';
        }
      }

      if (!parsedData) {
        if (activeDocType === 'paycheck') {
          parsedData = extractPaycheckData(extractedRawText);
        } else if (activeDocType === 'card') {
          parsedData = extractCardStatementData(extractedRawText);
        } else if (activeDocType === 'transaction') {
          parsedData = extractTransactionData(extractedRawText);
        }
      }

      if (parsedData) {
        saveExtractedData(activeDocType, parsedData, file.name, extractedRawText, method);
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
      let parsedData = null;
      let method = 'local';
      const apiKey = localStorage.getItem('extrkt_gemini_api_key');
      if (apiKey) {
        try {
          parsedData = await extractDataWithAI(activeDocType, text, apiKey);
          method = 'ai';
        } catch (err) {
          console.warn('AI extraction failed, falling back to regex extraction:', err);
          method = 'error';
        }
      }

      if (!parsedData) {
        if (activeDocType === 'paycheck') {
          parsedData = extractPaycheckData(text);
        } else if (activeDocType === 'card') {
          parsedData = extractCardStatementData(text);
        } else if (activeDocType === 'transaction') {
          parsedData = extractTransactionData(text);
        }
      }

      if (parsedData) {
        saveExtractedData(activeDocType, parsedData, 'Pasted Content', text, method);
      }
    } catch (err) {
      console.error('Clipboard paste parsing error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Global paste and drag-drop listener (skip for case converter)
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

    const handleGlobalDragOver = (e) => {
      e.preventDefault();
    };

    const handleGlobalDrop = (e) => {
      e.preventDefault();
      if (isProcessing || activeDocType === 'case') return;
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        handleFileUpload(files[0]);
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    window.addEventListener('dragover', handleGlobalDragOver);
    window.addEventListener('drop', handleGlobalDrop);

    return () => {
      window.removeEventListener('paste', handleGlobalPaste);
      window.removeEventListener('dragover', handleGlobalDragOver);
      window.removeEventListener('drop', handleGlobalDrop);
    };
  }, [activeDocType, isProcessing, paycheckFileName, cardFileName, transactionFileName, handleFileUpload, handlePasteText]);

  // Determine active view states
  const activeFileName = 
    activeDocType === 'paycheck' ? paycheckFileName : 
    activeDocType === 'card' ? cardFileName : 
    transactionFileName;

  const activeData = 
    activeDocType === 'paycheck' ? paycheckData : 
    activeDocType === 'card' ? cardData : 
    transactionData;

  const activeRawText = 
    activeDocType === 'paycheck' ? paycheckRawText : 
    activeDocType === 'card' ? cardRawText : 
    transactionRawText;

  const activeMethod = 
    activeDocType === 'paycheck' ? paycheckMethod : 
    activeDocType === 'card' ? cardMethod : 
    transactionMethod;


  // Tab definitions
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
              key="global-file-uploader"
              docType={activeDocType}
              onFileUpload={handleFileUpload}
              isProcessing={isProcessing}
              fileName={activeFileName}
              onClear={handleClearFile}
              uploadText={activeDocType === 'transaction' ? 'UPLOAD TRANSACTION' : 'UPLOAD STATEMENT'}
              uploadedLabel={activeDocType === 'transaction' ? 'Uploaded Transaction' : 'Uploaded Statement'}
              archiveItems={archiveItems}
              onLoadArchive={handleLoadFromArchive}
              onDeleteArchive={handleDeleteFromArchive}
              onClearAllArchives={handleClearAllArchives}
            />

            {/* Extracted Value Cards */}
            <div className="w-full mt-1">
              <Step2ExtractedData
                key={activeDocType}
                data={activeData}
                docType={activeDocType}
                method={activeMethod}
              />
            </div>

            {/* AI Q&A Panel */}
            {activeFileName && (
              <div className="w-full mt-3">
                <DocumentQA
                  docType={activeDocType}
                  fileName={activeFileName}
                  rawText={activeRawText}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
