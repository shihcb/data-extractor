import React, { useState } from 'react';
import { Download, Copy, Code, FileSpreadsheet, Check } from 'lucide-react';

export default function Step3Export({ data, docType, isCompleted, onNotification }) {
  const [copiedCsv, setCopiedCsv] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  if (!isCompleted || !data) return null; // Unclutter page by rendering nothing before upload!

  const isPaycheck = docType === 'paycheck';

  const getCsvString = () => {
    let rows = [];
    if (isPaycheck) {
      rows.push(['Field', 'Value']);
      rows.push(['Net Take-Home Pay', `"${data.netPay}"`]);
      rows.push(['Gross Income', `"${data.grossIncome}"`]);
      rows.push(['Pay Period', `"${data.payPeriod}"`]);
      rows.push(['Hours Worked', `"${data.hoursWorked}"`]);
      rows.push(['Paycheck Number', `"${data.paycheckNumber}"`]);
      rows.push(['Pay Date', `"${data.payDate}"`]);
      rows.push(['Employer', `"${data.employer}"`]);
    } else {
      rows.push(['Field', 'Value']);
      rows.push(['Total Balance', `"${data.statementBalance}"`]);
      rows.push(['Card Last 4', `"${data.cardLast4}"`]);
      rows.push(['Statement Period', `"${data.statementPeriod}"`]);
      rows.push(['Minimum Payment', `"${data.minimumPayment}"`]);
      rows.push(['Due Date', `"${data.dueDate}"`]);
      rows.push(['Bank Name', `"${data.bankName}"`]);
    }
    return rows.map(e => e.join(',')).join('\n');
  };

  const handleCopyCSV = () => {
    const csvStr = getCsvString();
    navigator.clipboard.writeText(csvStr);
    setCopiedCsv(true);
    if (onNotification) onNotification('CSV Data', 'Copied CSV format');
    setTimeout(() => setCopiedCsv(false), 2000);
  };

  const handleDownloadCSV = () => {
    const csvStr = getCsvString();
    const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${docType}_extracted_data.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (onNotification) onNotification('CSV File', 'Downloaded CSV file');
  };

  const handleDownloadJSON = () => {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${docType}_extracted_data.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (onNotification) onNotification('JSON File', 'Downloaded JSON file');
  };

  const handleCopyText = () => {
    let textStr = '';
    if (isPaycheck) {
      textStr = `Net Take-Home Pay: ${data.netPay}\nGross Income: ${data.grossIncome}\nPay Period: ${data.payPeriod}\nHours Worked: ${data.hoursWorked}\nCheck No: ${data.paycheckNumber}\nPay Date: ${data.payDate}\nEmployer: ${data.employer}`;
    } else {
      textStr = `Balance: ${data.statementBalance}\nCard Last 4: ${data.cardLast4}\nPeriod: ${data.statementPeriod}\nMin Payment: ${data.minimumPayment}\nDue Date: ${data.dueDate}\nBank: ${data.bankName}`;
    }
    navigator.clipboard.writeText(textStr);
    setCopiedText(true);
    if (onNotification) onNotification('Plain Text', 'Copied text summary');
    setTimeout(() => setCopiedText(false), 2000);
  };

  return (
    <div className="premium-card p-6 sm:p-8 animate-fade-in space-y-4">
      {/* Header */}
      <div className="pb-3 border-b border-slate-100">
        <h2 className="text-base font-extrabold text-slate-800 tracking-tight">
          Export options
        </h2>
      </div>

      {/* Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={handleCopyCSV}
          className="btn-outline-pill"
        >
          {copiedCsv ? <Check size={14} className="text-emerald-600" /> : <FileSpreadsheet size={14} className="text-indigo-600" />}
          <span>{copiedCsv ? 'Copied CSV' : 'Copy CSV'}</span>
        </button>

        <button
          onClick={handleDownloadCSV}
          className="btn-outline-pill"
        >
          <Download size={14} className="text-indigo-600" />
          <span>Download CSV</span>
        </button>

        <button
          onClick={handleDownloadJSON}
          className="btn-outline-pill"
        >
          <Code size={14} className="text-indigo-600" />
          <span>Download JSON</span>
        </button>

        <button
          onClick={handleCopyText}
          className="btn-outline-pill"
        >
          {copiedText ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} className="text-indigo-600" />}
          <span>{copiedText ? 'Copied Text' : 'Copy Text'}</span>
        </button>
      </div>
    </div>
  );
}
