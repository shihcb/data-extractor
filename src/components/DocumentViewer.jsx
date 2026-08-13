import React, { useState } from 'react';
import { Eye, Download, Code, FileText, Search, Copy, Check } from 'lucide-react';

export default function DocumentViewer({ rawText, extractedData, docType }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [viewTab, setViewTab] = useState('raw'); // 'raw' | 'json'

  const handleCopyRaw = () => {
    navigator.clipboard.writeText(rawText || '');
    setCopiedRaw(true);
    setTimeout(() => setCopiedRaw(false), 2000);
  };

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(extractedData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${docType}_extracted_data.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportCSV = () => {
    let csvRows = [];
    if (docType === 'paycheck') {
      csvRows.push(['Field', 'Value']);
      csvRows.push(['Pay Period', `"${extractedData.payPeriod}"`]);
      csvRows.push(['Gross Income', `"${extractedData.grossIncome}"`]);
      csvRows.push(['Net Pay', `"${extractedData.netPay}"`]);
      csvRows.push(['Hours Worked', `"${extractedData.hoursWorked}"`]);
      csvRows.push(['Paycheck Number', `"${extractedData.paycheckNumber}"`]);
      csvRows.push(['Order Number', `"${extractedData.orderNumber}"`]);
      csvRows.push(['Batch Number', `"${extractedData.batchNumber}"`]);
      csvRows.push(['Receipt Number', `"${extractedData.receiptNumber}"`]);
      csvRows.push(['Pay Date', `"${extractedData.payDate}"`]);
      csvRows.push(['Employer', `"${extractedData.employer}"`]);
      csvRows.push(['Employee', `"${extractedData.employee}"`]);
    } else {
      csvRows.push(['Bank Name', `"${extractedData.bankName}"`]);
      csvRows.push(['Card Last 4', `"${extractedData.cardLast4}"`]);
      csvRows.push(['Statement Period', `"${extractedData.statementPeriod}"`]);
      csvRows.push(['Statement Balance', `"${extractedData.statementBalance}"`]);
      csvRows.push(['Minimum Payment', `"${extractedData.minimumPayment}"`]);
      csvRows.push(['Due Date', `"${extractedData.dueDate}"`]);
      csvRows.push([]);
      csvRows.push(['Transaction Date', 'Description', 'Amount', 'Type']);
      (extractedData.transactions || []).forEach(tx => {
        csvRows.push([`"${tx.date}"`, `"${tx.description}"`, `"${tx.amount}"`, `"${tx.type}"`]);
      });
    }

    const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => e.join(",")).join("\n");
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", encodeURI(csvContent));
    downloadAnchor.setAttribute("download", `${docType}_extracted_data.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="glass-panel p-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Eye size={18} className="text-cyan-400" />
          <h3 className="font-bold text-base text-slate-100">Document Raw Source & Export</h3>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center p-0.5 bg-slate-900 rounded-lg border border-slate-800">
            <button
              onClick={() => setViewTab('raw')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                viewTab === 'raw' ? 'bg-slate-800 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Raw Text
            </button>
            <button
              onClick={() => setViewTab('json')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                viewTab === 'json' ? 'bg-slate-800 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              JSON Structure
            </button>
          </div>

          <button
            onClick={handleCopyRaw}
            className="copy-btn text-xs py-1.5 px-3"
          >
            {copiedRaw ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            <span>{copiedRaw ? 'Copied!' : 'Copy Raw'}</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="copy-btn text-xs py-1.5 px-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
          >
            <Download size={12} />
            <span>CSV</span>
          </button>

          <button
            onClick={handleExportJSON}
            className="copy-btn text-xs py-1.5 px-3 bg-violet-500/10 hover:bg-violet-500/20 text-violet-300 border-violet-500/30"
          >
            <Code size={12} />
            <span>JSON</span>
          </button>
        </div>
      </div>

      {/* Raw text preview area */}
      <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-4 font-mono text-xs text-slate-300 max-h-[300px] overflow-y-auto leading-relaxed whitespace-pre-wrap select-all">
        {viewTab === 'raw' ? (
          rawText || <span className="text-slate-500 italic">No document text parsed yet.</span>
        ) : (
          JSON.stringify(extractedData, null, 2)
        )}
      </div>
    </div>
  );
}
