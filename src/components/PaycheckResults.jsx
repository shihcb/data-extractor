import React from 'react';
import CopyableRow from './CopyableRow';

export default function PaycheckResults({ paycheckData, onCopyField }) {
  if (!paycheckData) return null;

  return (
    <div className="outer-shape p-5 space-y-3 animate-fade-in">
      <div className="flex items-center justify-between px-1 pb-1">
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-bold">
            2
          </span>
          <span className="font-bold text-sm text-slate-900">extracted values</span>
        </div>
        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
          ready to copy
        </span>
      </div>

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
          label="Total Hours Worked"
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
