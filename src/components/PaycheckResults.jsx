import React from 'react';
import CopyableRow from './CopyableRow';
import { Copy } from 'lucide-react';

export default function PaycheckResults({ paycheckData, onCopyField, onCopyAll }) {
  if (!paycheckData) return null;

  return (
    <div className="minimal-card p-6 space-y-4 animate-fade-in">
      {/* Title & Copy All Button */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h3 className="font-extrabold text-base text-slate-900">
          Extracted Paycheck Values
        </h3>

        <button
          onClick={onCopyAll}
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 transition-colors"
        >
          <Copy size={13} />
          <span>Copy All</span>
        </button>
      </div>

      {/* Field Rows */}
      <div className="space-y-2.5">
        <CopyableRow
          label="Net Take-Home Pay"
          value={paycheckData.netPay}
          highlight={true}
          onCopy={onCopyField}
        />

        <CopyableRow
          label="Gross Income"
          value={paycheckData.grossIncome}
          onCopy={onCopyField}
        />

        <CopyableRow
          label="Pay Period (Dates Covered)"
          value={paycheckData.payPeriod}
          onCopy={onCopyField}
        />

        <CopyableRow
          label="Hours Worked"
          value={paycheckData.hoursWorked}
          onCopy={onCopyField}
        />

        <CopyableRow
          label="Paycheck / Check Number"
          value={paycheckData.paycheckNumber}
          onCopy={onCopyField}
        />

        <CopyableRow
          label="Order Number"
          value={paycheckData.orderNumber}
          onCopy={onCopyField}
        />

        <CopyableRow
          label="Batch Number"
          value={paycheckData.batchNumber}
          onCopy={onCopyField}
        />

        <CopyableRow
          label="Receipt / Advice Number"
          value={paycheckData.receiptNumber}
          onCopy={onCopyField}
        />

        <CopyableRow
          label="Pay Date"
          value={paycheckData.payDate}
          onCopy={onCopyField}
        />

        <CopyableRow
          label="Employer Name"
          value={paycheckData.employer}
          onCopy={onCopyField}
        />
      </div>
    </div>
  );
}
