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
        </>
      ) : (
        <>
          <CopyableRow
            label="STATEMENT BALANCE"
            value={data.statementBalance}
            highlight={true}
            onCopy={onCopyField}
          />
          <CopyableRow
            label="START DATE"
            value={data.startDate}
            onCopy={onCopyField}
          />
          <CopyableRow
            label="END DATE"
            value={data.endDate}
            onCopy={onCopyField}
          />
          <CopyableRow
            label="STATEMENT PERIOD"
            value={data.statementPeriod}
            onCopy={onCopyField}
          />
          <CopyableRow
            label="CHECK NUMBER"
            value={data.cardLast4}
            onCopy={onCopyField}
          />
          <CopyableRow
            label="Pay Date"
            value="Not Found"
            onCopy={onCopyField}
          />
        </>
      )}
    </div>
  );
}
