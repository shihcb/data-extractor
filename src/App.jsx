import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import FileUpload from './components/FileUpload';
import PaycheckResults from './components/PaycheckResults';
import CardStatementResults from './components/CardStatementResults';
import DocumentViewer from './components/DocumentViewer';
import Toast from './components/Toast';
import confetti from 'canvas-confetti';

import { parsePdfText } from './utils/pdfParser';
import { parseImageText } from './utils/imageParser';
import { extractPaycheckData } from './utils/paycheckExtractor';
import { extractCardStatementData } from './utils/cardStatementExtractor';
import { SAMPLE_PAYCHECK, SAMPLE_CREDIT_CARD, SAMPLE_DEBIT_STATEMENT } from './utils/sampleData';
import { Sparkles, Shield, Cpu, RefreshCw, FileSpreadsheet, Info } from 'lucide-react';

export default function App() {
  const [activeDocType, setActiveDocType] = useState('paycheck'); // 'paycheck' | 'card'
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
    }, 2500);

    // Trigger subtle confetti burst on Net Pay or Statement Balance copy
    if (label.includes('Net') || label.includes('Balance')) {
      confetti({
        particleCount: 35,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#06b6d4', '#10b981', '#8b5cf6']
      });
    }
  };

  const handleLoadSample = (type) => {
    setActiveDocType(type);
    if (type === 'paycheck') {
      setPaycheckData(SAMPLE_PAYCHECK);
      setFileName('Sample_ADP_Workday_Paystub.pdf');
      setRawText(SAMPLE_PAYCHECK.rawText);
      handleCopyNotification('Sample Paystub', 'Loaded demo paycheck statement');
    } else {
      setCardData(SAMPLE_CREDIT_CARD);
      setFileName('Sample_Chase_Credit_Card_Statement.pdf');
      setRawText(SAMPLE_CREDIT_CARD.rawText);
      handleCopyNotification('Sample Card', 'Loaded demo credit card statement');
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
        // Plain text or CSV
        extractedRawText = await file.text();
      }

      setRawText(extractedRawText);

      // Auto-detect doc type if text matches key statement words
      const textLower = extractedRawText.toLowerCase();
      const isPaycheckText = textLower.includes('pay') || textLower.includes('gross') || textLower.includes('net') || textLower.includes('earnings') || textLower.includes('hours');

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
    const summary = `PAYCHECK STATEMENT SUMMARY:
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
    handleCopyNotification('Paycheck Summary', 'Full paystub summary copied');
  };

  const handleCopyFullCardSummary = () => {
    if (!cardData) return;
    const summary = `CARD STATEMENT SUMMARY:
Bank / Issuer: ${cardData.bankName}
Card Last 4: ${cardData.cardLast4}
Statement Period: ${cardData.statementPeriod}
Total Balance Due: ${cardData.statementBalance}
Minimum Payment: ${cardData.minimumPayment}
Due Date: ${cardData.dueDate}`;

    navigator.clipboard.writeText(summary);
    handleCopyNotification('Card Summary', 'Full card statement summary copied');
  };

  return (
    <div className="min-h-screen flex flex-col pb-16">
      {/* Header Bar */}
      <Header
        activeDocType={activeDocType}
        setActiveDocType={setActiveDocType}
        onLoadSample={handleLoadSample}
      />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 pt-6 flex-1 w-full space-y-6">
        
        {/* Banner Alert informing user about single line copy buttons */}
        <div className="glass-panel p-4 bg-slate-900/60 border-cyan-500/30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0">
              <Info size={20} />
            </div>
            <p className="text-xs sm:text-sm text-slate-300">
              <span className="font-bold text-white">Line-by-Line Copy Mode Active: </span>
              Every field (Net Pay, Gross Income, Hours Worked, Pay Period, Check #, Order #, Batch #, Receipt #) has its own dedicated <span className="text-cyan-300 font-semibold">[Copy]</span> button on its line.
            </p>
          </div>
          <div className="hidden md:flex items-center gap-2 shrink-0">
            <button
              onClick={() => handleLoadSample('paycheck')}
              className="text-xs text-violet-300 hover:text-violet-200 underline font-semibold"
            >
              Try Paystub Sample
            </button>
            <span className="text-slate-600">|</span>
            <button
              onClick={() => handleLoadSample('card')}
              className="text-xs text-cyan-300 hover:text-cyan-200 underline font-semibold"
            >
              Try Card Sample
            </button>
          </div>
        </div>

        {/* Upload Box */}
        <FileUpload
          onFileUpload={handleFileUpload}
          isProcessing={isProcessing}
          activeDocType={activeDocType}
          fileName={fileName}
          onClear={handleClearFile}
        />

        {/* Extracted Content Results */}
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

        {/* Document Raw & JSON Viewer */}
        <DocumentViewer
          rawText={rawText}
          extractedData={activeDocType === 'paycheck' ? paycheckData : cardData}
          docType={activeDocType}
        />
      </main>

      {/* Footer */}
      <footer className="mt-12 border-t border-slate-800/80 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© 2026 Extrkt Data Extractor. All client-side processing, absolute privacy.</p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1 text-slate-400">
              <Shield size={12} className="text-emerald-400" /> Privacy First
            </span>
            <span className="flex items-center gap-1 text-slate-400">
              <Cpu size={12} className="text-cyan-400" /> Regex & PDF.js Engine
            </span>
          </div>
        </div>
      </footer>

      {/* Floating Toast */}
      <Toast toast={toast} />
    </div>
  );
}
