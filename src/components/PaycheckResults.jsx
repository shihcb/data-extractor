import React from 'react';
import CopyableRow from './CopyableRow';

export default function PaycheckResults({ paycheckData, onCopyField }) {
  if (!paycheckData) return null;

  return (
    <div className="space-y-3 animate-fade-in pt-2">
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
  );
}
