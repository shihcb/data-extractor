import React, { useState, useEffect } from 'react';
import CopyableRow from './CopyableRow';

export default function Step2ExtractedData({ data, docType, isCompleted, onCopyField }) {
  // Cache data to keep fields rendered during transition out
  const [cachedData, setCachedData] = useState(data);

  useEffect(() => {
    if (data) {
      setCachedData(data);
    }
  }, [data]);

  const displayData = data || cachedData;

  if (!displayData) return null;

  const isPaycheck = docType === 'paycheck';

  return (
    <div className="animate-fade-in">
      {isPaycheck ? (
        <>
          <CopyableRow
            label="NET PAY"
            value={displayData.netPay}
            highlight={true}
            onCopy={onCopyField}
          />
          <CopyableRow
            label="GROSS PAY"
            value={displayData.grossIncome}
            onCopy={onCopyField}
          />
          <CopyableRow
            label="PAY PERIOD"
            value={displayData.payPeriod}
            onCopy={onCopyField}
          />
          <CopyableRow
            label="Total Hours Worked"
            value={displayData.hoursWorked}
            onCopy={onCopyField}
          />
          <CopyableRow
            label="CHECK NUMBER"
            value={displayData.paycheckNumber}
            onCopy={onCopyField}
          />
          <CopyableRow
            label="Pay Date"
            value={displayData.payDate}
            onCopy={onCopyField}
          />
        </>
      ) : (
        <>
          <CopyableRow
            label="STATEMENT BALANCE"
            value={displayData.statementBalance}
            highlight={true}
            onCopy={onCopyField}
          />
          <CopyableRow
            label="START DATE"
            value={displayData.startDate}
            onCopy={onCopyField}
          />
          <CopyableRow
            label="END DATE"
            value={displayData.endDate}
            onCopy={onCopyField}
          />
          <CopyableRow
            label="STATEMENT PERIOD"
            value={displayData.statementPeriod}
            onCopy={onCopyField}
          />
          {/* Check Number box has been removed from Bank Statements view */}
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
