import React, { useState, useEffect } from 'react';
import FileUpload from './components/FileUpload';
import Step2ExtractedData from './components/Step2ExtractedData';
import Toast from './components/Toast';

import { parsePdfText } from './utils/pdfParser';
import { parseImageText } from './utils/imageParser';
import { extractPaycheckData } from './utils/paycheckExtractor';
import { extractCardStatementData } from './utils/cardStatementExtractor';

export default function App() {
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
  const [toast, setToast] = useState(null);

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

  const handleCopyNotification = (label, value) => {
    setToast({ label, value });
    setTimeout(() => {
      setToast(null);
    }, 2000);
  };

  const handleClearFile = () => {
    setFileName('');
    setPaycheckData(null);
    setCardData(null);
    localStorage.removeItem('extrkt_file_name');
    localStorage.removeItem('extrkt_paycheck_data');
    localStorage.removeItem('extrkt_card_data');
  };

  const handleFileUpload = async (file) => {
    if (!file) return;

    // Validate PDF filenames
    const fileLower = file.name.toLowerCase();
    if (fileLower.endsWith('.pdf')) {
      const isValidName = fileLower.includes('pay stub for') || fileLower.includes('statement for');
      if (!isValidName) {
        alert("Upload rejected: PDF files must contain 'Pay Stub for' or 'Statement for' in their file name.");
        return;
      }
    }

    setIsProcessing(true);
    setFileName(file.name);

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

      const textLower = extractedRawText.toLowerCase();
      // Auto-detect doc type but respect manual toggle switch
      const isPaycheckText = textLower.includes('pay') || textLower.includes('gross') || textLower.includes('net') || textLower.includes('hours') || textLower.includes('period') || textLower.includes('check');

      if (isPaycheckText || activeDocType === 'paycheck') {
        const parsedPaycheck = extractPaycheckData(extractedRawText);
        setPaycheckData(parsedPaycheck);
        setActiveDocType('paycheck');
      } else {
        const parsedCard = extractCardStatementData(extractedRawText);
        setCardData(parsedCard);
        setActiveDocType('card');
      }

      handleCopyNotification('File Processed', `Extracted values from ${file.name}`);
    } catch (err) {
      console.error('File parsing error:', err);
      alert('Error parsing file: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyAll = () => {
    const data = activeDocType === 'paycheck' ? paycheckData : cardData;
    if (!data) return;

    let summary = '';
    if (activeDocType === 'paycheck') {
      summary = `PAYCHECK STATEMENT SUMMARY:\nNET PAY: ${data.netPay}\nGROSS PAY: ${data.grossIncome}\nPAY PERIOD: ${data.payPeriod}\nHours Worked: ${data.hoursWorked}\nCHECK NUMBER: ${data.paycheckNumber}\nPay Date: ${data.payDate}`;
    } else {
      summary = `CARD STATEMENT SUMMARY:\nSTATEMENT BALANCE: ${data.statementBalance}\nSTART DATE: ${data.startDate}\nEND DATE: ${data.endDate}\nSTATEMENT PERIOD: ${data.statementPeriod}`;
    }

    navigator.clipboard.writeText(summary);
    handleCopyNotification('Full Summary', 'Copied all values to clipboard');
  };

  const activeData = activeDocType === 'paycheck' ? paycheckData : cardData;

  return (
    <div className={`min-h-screen bg-[#faf9f6] text-[#0f172a] px-4 sm:px-6 w-full flex flex-col items-center justify-center py-20 sm:py-24 relative`}>
      {/* Top Right Stepper/Toggle Switch */}
      <div className="absolute top-6 right-6 z-10 flex items-center p-1 bg-slate-200/80 rounded-full border border-slate-300/60 shadow-xs">
        <button
          onClick={() => setActiveDocType('paycheck')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
            activeDocType === 'paycheck'
              ? 'bg-[#0f172a] text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          paychecks
        </button>
        <button
          onClick={() => setActiveDocType('card')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
            activeDocType === 'card'
              ? 'bg-[#0f172a] text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          bank statements
        </button>
      </div>

      {/* Centered App Container */}
      <div className="app-container my-auto">
        
        {/* Upload Button Component */}
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
              onCopyField={handleCopyNotification}
            />
          </div>
        )}
      </div>

      {/* Toast Notification */}
      <Toast toast={toast} />
    </div>
  );
}
