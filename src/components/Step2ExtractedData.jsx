import React from 'react';
import { Copy, Lock, Sparkles } from 'lucide-react';
import CopyableRow from './CopyableRow';

export default function Step2ExtractedData({ data, docType, isCompleted, onCopyField, onCopyAll }) {
  if (!isCompleted || !data) {
    return (
      <div className="saas-card p-6 sm:p-9 opacity-50 transition-opacity">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-slate-300 text-slate-600 flex items-center justify-center text-xs font-black">
              2
            </span>
            <h2 className="text-xl font-bold text-slate-400 tracking-tight">
              Extracted Data
            </h2>
          </div>
          <span className="flex items-center gap-1 text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
            <Lock size={12} /> Waiting for Upload
          </span>
        </div>
        <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs font-medium">
          Upload a statement in Step 1 to automatically extract parsed fields line-by-line.
        </div>
      </div>
    );
  }

  const isPaycheck = docType === 'paycheck';

  return (
    <div className="saas-card p-6 sm:p-9 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-full bg-[#0f172a] text-white flex items-center justify-center text-xs font-black shadow-sm">
            2
          </span>
          <div>
            <h2 className="text-xl font-bold text-[#0f172a] tracking-tight">
              Extracted Data
            </h2>
            <p className="text-xs text-[#64748b] mt-0.5">Click any row or button to copy individual fields</p>
          </div>
        </div>

        <button
          onClick={onCopyAll}
          className="btn-indigo-copy"
        >
          <Copy size={14} />
          <span>Copy All</span>
        </button>
      </div>

      {/* Field Grid Rows */}
      <div className="space-y-3">
        {isPaycheck ? (
          <>
            <CopyableRow
              label="Net Take-Home Pay"
              value={data.netPay}
              highlight={true}
              onCopy={onCopyField}
            />
            <CopyableRow
              label="Gross Income"
              value={data.grossIncome}
              onCopy={onCopyField}
            />
            <CopyableRow
              label="Pay Period (Dates Covered)"
              value={data.payPeriod}
              onCopy={onCopyField}
            />
            <CopyableRow
              label="Total Hours Worked"
              value={data.hoursWorked}
              onCopy={onCopyField}
            />
            <CopyableRow
              label="Paycheck / Check Number"
              value={data.paycheckNumber}
              onCopy={onCopyField}
            />
            <CopyableRow
              label="Pay Date"
              value={data.payDate}
              onCopy={onCopyField}
            />
            <CopyableRow
              label="Employer Name"
              value={data.employer}
              onCopy={onCopyField}
            />
          </>
        ) : (
          <>
            <CopyableRow
              label="Total Balance Due"
              value={data.statementBalance}
              highlight={true}
              onCopy={onCopyField}
            />
            <CopyableRow
              label="Card / Account Last 4"
              value={data.cardLast4}
              onCopy={onCopyField}
            />
            <CopyableRow
              label="Statement Period"
              value={data.statementPeriod}
              onCopy={onCopyField}
            />
            <CopyableRow
              label="Minimum Payment"
              value={data.minimumPayment}
              onCopy={onCopyField}
            />
            <CopyableRow
              label="Payment Due Date"
              value={data.dueDate}
              onCopy={onCopyField}
            />
            <CopyableRow
              label="Issuing Bank Name"
              value={data.bankName}
              onCopy={onCopyField}
            />
          </>
        )}
      </div>
    </div>
  );
}
