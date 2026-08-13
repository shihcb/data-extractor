import React from 'react';
import { Copy } from 'lucide-react';
import CopyableRow from './CopyableRow';

export default function Step2ExtractedData({ data, docType, isCompleted, onCopyField, onCopyAll }) {
  if (!isCompleted || !data) return null; // Unclutter page by rendering nothing before upload!

  const isPaycheck = docType === 'paycheck';

  return (
    <div className="premium-card p-6 sm:p-8 animate-fade-in space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div>
          <h2 className="text-base font-extrabold text-slate-800 tracking-tight">
            Extracted Values
          </h2>
        </div>

        <button
          onClick={onCopyAll}
          className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100/50 transition-colors"
        >
          <Copy size={13} />
          <span>Copy All</span>
        </button>
      </div>

      {/* Rows */}
      <div className="space-y-2">
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
              label="Pay Period"
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
