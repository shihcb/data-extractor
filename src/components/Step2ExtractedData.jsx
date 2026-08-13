import React from 'react';
import CopyableRow from './CopyableRow';

export default function Step2ExtractedData({ data, docType, isCompleted, onCopyField }) {
  if (!isCompleted || !data) return null;

  const isPaycheck = docType === 'paycheck';

  return (
    <div className="animate-fade-in">
      {isPaycheck ? (
        <>
          <CopyableRow
            label="NET PAY"
            value={data.netPay}
            highlight={true}
            onCopy={onCopyField}
          />
          <CopyableRow
            label="GROSS PAY"
            value={data.grossIncome}
            onCopy={onCopyField}
          />
          <CopyableRow
            label="PAY PERIOD"
            value={data.payPeriod}
            onCopy={onCopyField}
          />
          <CopyableRow
            label="Total Hours Worked"
            value={data.hoursWorked}
            onCopy={onCopyField}
          />
          <CopyableRow
            label="CHECK NUMBER"
            value={data.paycheckNumber}
            onCopy={onCopyField}
          />
          <CopyableRow
            label="Pay Date"
            value={data.payDate}
            onCopy={onCopyField}
          />
          {/* Employer Name Box has been removed */}
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
  );
}
