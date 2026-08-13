import React, { useState } from 'react';
import { Download, Copy, Code, FileSpreadsheet, Lock, Check } from 'lucide-react';

export default function Step3Export({ data, docType, isCompleted, onNotification }) {
  const [copiedCsv, setCopiedCsv] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  if (!isCompleted || !data) {
    return (
      <div className="saas-card p-6 sm:p-9 opacity-50 transition-opacity">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-slate-300 text-slate-600 flex items-center justify-center text-xs font-black">
              3
            </span>
            <h2 className="text-xl font-bold text-slate-400 tracking-tight">
              Export & Share
            </h2>
          </div>
          <span className="flex items-center gap-1 text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
            <Lock size={12} /> Waiting for Upload
          </span>
        </div>
        <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs font-medium">
          Export options will be enabled once your statement is parsed.
        </div>
      </div>
    );
  }

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
    if (onNotification) onNotification('CSV Data', 'Copied CSV format to clipboard');
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
    if (onNotification) onNotification('Plain Text', 'Copied plain text summary');
    setTimeout(() => setCopiedText(false), 2000);
  };

  return (
    <div className="saas-card p-6 sm:p-9 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-full bg-[#0f172a] text-white flex items-center justify-center text-xs font-black shadow-sm">
            3
          </span>
          <div>
            <h2 className="text-xl font-bold text-[#0f172a] tracking-tight">
              Export & Share
            </h2>
            <p className="text-xs text-[#64748b] mt-0.5">Download structured files or copy directly</p>
          </div>
        </div>

        <span className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-extrabold px-3.5 py-1.5 rounded-full">
          Ready
        </span>
      </div>

      {/* Outlined Pill Buttons Grid */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleCopyCSV}
          className="btn-outline-pill"
        >
          {copiedCsv ? <Check size={16} className="text-emerald-600" /> : <FileSpreadsheet size={16} className="text-indigo-600" />}
          <span>{copiedCsv ? 'Copied CSV!' : 'Copy CSV Format'}</span>
        </button>

        <button
          onClick={handleDownloadCSV}
          className="btn-outline-pill"
        >
          <Download size={16} className="text-indigo-600" />
          <span>Download CSV</span>
        </button>

        <button
          onClick={handleDownloadJSON}
          className="btn-outline-pill"
        >
          <Code size={16} className="text-indigo-600" />
          <span>Download JSON</span>
        </button>

        <button
          onClick={handleCopyText}
          className="btn-outline-pill"
        >
          {copiedText ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} className="text-indigo-600" />}
          <span>{copiedText ? 'Copied Text!' : 'Copy Plain Text'}</span>
        </button>
      </div>
    </div>
  );
}
