import React from 'react';
import CopyableRow from './CopyableRow';

export default function PaycheckResults({ paycheckData, onCopyField }) {
  if (!paycheckData) {
    return (
      <div className="reference-panel p-5 flex flex-col h-full">
        <div className="flex items-center justify-between mb-4 px-1">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-bold">
              2
            </span>
            <span className="font-extrabold text-sm text-slate-900">
              extracted values
            </span>
          </div>
          <span className="black-pill-badge">
            0 loaded
          </span>
        </div>

        <div className="reference-inset p-8 text-center flex-1 min-h-[380px] sm:min-h-[460px] flex flex-col items-center justify-center text-slate-400 font-medium text-xs">
          no values extracted yet. upload a statement on the left.
        </div>
      </div>
    );
  }

  return (
    <div className="reference-panel p-5 flex flex-col h-full animate-fade-in">
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-bold">
            2
          </span>
          <span className="font-extrabold text-sm text-slate-900">
            extracted values
          </span>
        </div>
        <span className="black-pill-badge">
          ready to copy
        </span>
      </div>

      <div className="space-y-3 overflow-y-auto flex-1 pr-0.5">
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
