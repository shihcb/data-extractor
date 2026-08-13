import React, { useState } from 'react';
import FileUpload from './components/FileUpload';
import Step2ExtractedData from './components/Step2ExtractedData';
import Toast from './components/Toast';

import { parsePdfText } from './utils/pdfParser';
import { parseImageText } from './utils/imageParser';
import { extractPaycheckData } from './utils/paycheckExtractor';
import { extractCardStatementData } from './utils/cardStatementExtractor';

export default function App() {
  const [activeDocType, setActiveDocType] = useState('paycheck');
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileName, setFileName] = useState('');
  
  const [paycheckData, setPaycheckData] = useState(null);
  const [cardData, setCardData] = useState(null);

  const [toast, setToast] = useState(null);

  const isStep2Complete = Boolean(paycheckData || cardData);

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
  };

  const handleFileUpload = async (file) => {
    if (!file) return;
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
      summary = `PAYCHECK STATEMENT SUMMARY:\nNet Take-Home Pay: ${data.netPay}\nGross Income: ${data.grossIncome}\nPay Period: ${data.payPeriod}\nHours Worked: ${data.hoursWorked}\nCheck No: ${data.paycheckNumber}\nPay Date: ${data.payDate}\nEmployer: ${data.employer}`;
    } else {
      summary = `CARD STATEMENT SUMMARY:\nTotal Balance: ${data.statementBalance}\nCard Last 4: ${data.cardLast4}\nPeriod: ${data.statementPeriod}\nMin Payment: ${data.minimumPayment}\nDue Date: ${data.dueDate}\nBank: ${data.bankName}`;
    }

    navigator.clipboard.writeText(summary);
    handleCopyNotification('Full Summary', 'Copied all values to clipboard');
  };

  const activeData = activeDocType === 'paycheck' ? paycheckData : cardData;

  return (
    <div className={`min-h-screen bg-[#faf9f6] text-[#0f172a] px-4 sm:px-6 w-full flex flex-col items-center transition-all duration-300 ${
      isStep2Complete ? 'justify-start py-12' : 'justify-center'
    }`}>
      {/* Centered App Container */}
      <div className="app-container">
        
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
              onCopyAll={handleCopyAll}
            />
          </div>
        )}
      </div>

      {/* Toast Notification */}
      <Toast toast={toast} />
    </div>
  );
}
