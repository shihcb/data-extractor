import React, { useState } from 'react';
import Header from './components/Header';
import FileUpload from './components/FileUpload';
import PaycheckResults from './components/PaycheckResults';
import CardStatementResults from './components/CardStatementResults';
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

      handleCopyNotification('File Upload', `Extracted ${file.name}`);
    } catch (err) {
      console.error('File parsing error:', err);
      alert('Error parsing file: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-start py-12 px-4 sm:px-8">
      <div className="w-full max-w-2xl sm:max-w-3xl mx-auto space-y-8">
        
        {/* Simple Header */}
        <Header />

        {/* Drag & Drop File Upload */}
        <FileUpload
          onFileUpload={handleFileUpload}
          isProcessing={isProcessing}
          fileName={fileName}
          onClear={handleClearFile}
        />

        {/* Extracted Values Cards */}
        {activeDocType === 'paycheck' ? (
          <PaycheckResults
            paycheckData={paycheckData}
            onCopyField={handleCopyNotification}
          />
        ) : (
          <CardStatementResults
            cardData={cardData}
            onCopyField={handleCopyNotification}
          />
        )}
      </div>

      {/* Floating Toast Notification */}
      <Toast toast={toast} />
    </div>
  );
}
