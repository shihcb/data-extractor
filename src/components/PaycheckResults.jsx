import React from 'react';
import CopyableRow from './CopyableRow';

export default function PaycheckResults({ paycheckData, onCopyField }) {
  if (!paycheckData) return null;

  return (
    <div className="outer-shape p-6 sm:p-8 animate-fade-in space-y-4">
      {/* Clean Header Row */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold shadow-sm">
            2
          </span>
          <span className="font-extrabold text-base sm:text-lg text-slate-900 tracking-tight">
            Extracted Values
          </span>
        </div>
        <span className="bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-extrabold px-3 py-1 rounded-full">
          Ready to Copy
        </span>
      </div>

      {/* Field Cards spaced cleanly */}
      <div className="space-y-4 pt-2">
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
