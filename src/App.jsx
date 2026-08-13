import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import FileUpload from './components/FileUpload';
import PaycheckResults from './components/PaycheckResults';
import CardStatementResults from './components/CardStatementResults';
import DocumentViewer from './components/DocumentViewer';
import Toast from './components/Toast';

import { parsePdfText } from './utils/pdfParser';
import { parseImageText } from './utils/imageParser';
import { extractPaycheckData } from './utils/paycheckExtractor';
import { extractCardStatementData } from './utils/cardStatementExtractor';
import { SAMPLE_PAYCHECK, SAMPLE_CREDIT_CARD } from './utils/sampleData';

export default function App() {
  const [activeDocType, setActiveDocType] = useState('paycheck');
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileName, setFileName] = useState('');
  
  const [paycheckData, setPaycheckData] = useState(SAMPLE_PAYCHECK);
  const [cardData, setCardData] = useState(SAMPLE_CREDIT_CARD);
  const [rawText, setRawText] = useState(SAMPLE_PAYCHECK.rawText);

  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (activeDocType === 'paycheck' && paycheckData) {
      setRawText(paycheckData.rawText);
    } else if (activeDocType === 'card' && cardData) {
      setRawText(cardData.rawText);
    }
  }, [activeDocType, paycheckData, cardData]);

  const handleCopyNotification = (label, value) => {
    setToast({ label, value });
    setTimeout(() => {
      setToast(null);
    }, 2000);
  };

  const handleLoadSample = (type) => {
    setActiveDocType(type);
    if (type === 'paycheck') {
      setPaycheckData(SAMPLE_PAYCHECK);
      setFileName('Sample_Paystub.pdf');
      setRawText(SAMPLE_PAYCHECK.rawText);
      handleCopyNotification('Sample Paystub', 'Loaded sample paystub');
    } else {
      setCardData(SAMPLE_CREDIT_CARD);
      setFileName('Sample_Credit_Card_Statement.pdf');
      setRawText(SAMPLE_CREDIT_CARD.rawText);
      handleCopyNotification('Sample Card', 'Loaded sample card statement');
    }
  };

  const handleClearFile = () => {
    setFileName('');
    if (activeDocType === 'paycheck') {
      setPaycheckData(null);
    } else {
      setCardData(null);
    }
    setRawText('');
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

      setRawText(extractedRawText);

      const textLower = extractedRawText.toLowerCase();
      const isPaycheckText = textLower.includes('pay') || textLower.includes('gross') || textLower.includes('net') || textLower.includes('hours');

      if (isPaycheckText || activeDocType === 'paycheck') {
        const parsedPaycheck = extractPaycheckData(extractedRawText);
        setPaycheckData(parsedPaycheck);
        setActiveDocType('paycheck');
      } else {
        const parsedCard = extractCardStatementData(extractedRawText);
        setCardData(parsedCard);
        setActiveDocType('card');
      }

      handleCopyNotification('File Upload', `Parsed ${file.name}`);
    } catch (err) {
      console.error('File parsing error:', err);
      alert('Error parsing file: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyFullPaycheckSummary = () => {
    if (!paycheckData) return;
    const summary = `PAYCHECK STATEMENT:
Pay Period: ${paycheckData.payPeriod}
Gross Income: ${paycheckData.grossIncome}
Net Take-Home Pay: ${paycheckData.netPay}
Hours Worked: ${paycheckData.hoursWorked}
Paycheck Number: ${paycheckData.paycheckNumber}
Order Number: ${paycheckData.orderNumber}
Batch Number: ${paycheckData.batchNumber}
Receipt Number: ${paycheckData.receiptNumber}
Pay Date: ${paycheckData.payDate}
Employer: ${paycheckData.employer}`;

    navigator.clipboard.writeText(summary);
    handleCopyNotification('Paycheck Summary', 'Summary copied');
  };

  const handleCopyFullCardSummary = () => {
    if (!cardData) return;
    const summary = `CARD STATEMENT:
Bank Name: ${cardData.bankName}
Card Last 4: ${cardData.cardLast4}
Statement Period: ${cardData.statementPeriod}
Total Balance: ${cardData.statementBalance}
Minimum Payment: ${cardData.minimumPayment}
Due Date: ${cardData.dueDate}`;

    navigator.clipboard.writeText(summary);
    handleCopyNotification('Card Summary', 'Summary copied');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-start py-8 px-4 sm:px-6">
      <div className="w-full max-w-xl mx-auto space-y-4">
        
        {/* Simple Header */}
        <Header />

        {/* Minimal File Upload */}
        <FileUpload
          onFileUpload={handleFileUpload}
          isProcessing={isProcessing}
          fileName={fileName}
          onClear={handleClearFile}
          onLoadSample={handleLoadSample}
        />

        {/* Extracted Line-by-Line Results */}
        {activeDocType === 'paycheck' ? (
          <PaycheckResults
            paycheckData={paycheckData}
            onCopyField={handleCopyNotification}
            onCopyAll={handleCopyFullPaycheckSummary}
          />
        ) : (
          <CardStatementResults
            cardData={cardData}
            onCopyField={handleCopyNotification}
            onCopyAll={handleCopyFullCardSummary}
          />
        )}

        {/* Collapsible Raw Text */}
        <DocumentViewer rawText={rawText} />
      </div>

      <Toast toast={toast} />
    </div>
  );
}
