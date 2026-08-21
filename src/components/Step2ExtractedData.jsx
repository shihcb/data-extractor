import React, { useState, useEffect } from 'react';
import CopyableRow from './CopyableRow';

export default function Step2ExtractedData({ data, docType, onCopyField, method }) {
  const isPaycheck = docType === 'paycheck';
  const isCard = docType === 'card';
  const isTransaction = docType === 'transaction';

  const displayData = data || {};

  // Helper to resolve month names to chronological indices (0-11)
  const getMonthIndex = (dateStr) => {
    const months = [
      ["jan", "january"], ["feb", "february"], ["mar", "march"],
      ["apr", "april"], ["may"], ["jun", "june"],
      ["jul", "july"], ["aug", "august"], ["sep", "september"],
      ["oct", "october"], ["nov", "november"], ["dec", "december"]
    ];
    const lower = dateStr.toLowerCase();
    for (let i = 0; i < months.length; i++) {
      for (const m of months[i]) {
        if (lower.includes(m)) return i;
      }
    }
    const numMatch = dateStr.match(/^(\d{1,2})/);
    if (numMatch) {
      const m = parseInt(numMatch[1], 10);
      if (m >= 1 && m <= 12) return m - 1;
    }
    return -1;
  };

  // Normalizes dates to append matching year, adjusting for year boundary changes (Dec -> Jan cross-year boundary)
  const normalizeDateWithYear = (start, end) => {
    if (!start || start === 'N/A' || start === 'Not Found') return 'N/A';
    
    let cleanedStart = start.replace(/^[A-Za-z]{3,10}\s*,\s*/, '').trim();
    let cleanedEnd = end ? end.replace(/^[A-Za-z]{3,10}\s*,\s*/, '').trim() : '';

    const startHasYear = /\b\d{4}\b/.test(cleanedStart) || (cleanedStart.split('/').length === 3 && cleanedStart.split('/')[2].length === 2);
    if (!startHasYear && cleanedEnd) {
      const yearMatch = cleanedEnd.match(/\b\d{4}\b/) || cleanedEnd.match(/\/(\d{2})$/);
      if (yearMatch) {
        let endYear = parseInt(yearMatch[0].replace('/', ''), 10);
        if (endYear < 100) endYear += 2000;
        
        const startMonthIdx = getMonthIndex(cleanedStart);
        const endMonthIdx = getMonthIndex(cleanedEnd);
        
        if (startMonthIdx !== -1 && endMonthIdx !== -1) {
          let startYear = endYear;
          if (startMonthIdx > endMonthIdx) {
            startYear = endYear - 1;
          }
          if (cleanedStart.includes('/')) {
            return `${cleanedStart}/${startYear}`;
          }
          return `${cleanedStart}, ${startYear}`;
        }
      }
    }
    return cleanedStart;
  };

  // Formats any raw date string to full "January 1, 2026" layout
  const formatDateToFull = (dateStr) => {
    if (!dateStr || dateStr === 'N/A' || dateStr === 'Not Found') return 'N/A';
    
    let cleaned = dateStr.replace(/^[A-Za-z]{3,10}\s*,\s*/, '').trim();

    // 1. Try numeric parsing M/D/YY or MM/DD/YYYY
    const numMatch = cleaned.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})$/);
    if (numMatch) {
      const m = parseInt(numMatch[1], 10);
      const d = parseInt(numMatch[2], 10);
      let y = parseInt(numMatch[3], 10);
      if (y < 100) y += 2000;
      const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ];
      if (m >= 1 && m <= 12) {
        return `${monthNames[m - 1]} ${d}, ${y}`;
      }
    }

    // 2. Try alphabetical month parsing "Dec 25" or "December 25, 2026"
    const alphaMatch = cleaned.match(/^([A-Za-z]{3,10})\s+(\d{1,2})(?:\s*,\s*(\d{4}))?$/i);
    if (alphaMatch) {
      const monthKey = alphaMatch[1].toLowerCase().slice(0, 3);
      const monthsMap = {
        jan: "January", feb: "February", mar: "March", apr: "April",
        may: "May", jun: "June", jul: "July", aug: "August",
        sep: "September", oct: "October", nov: "November", dec: "December"
      };
      const monthName = monthsMap[monthKey] || alphaMatch[1];
      const day = alphaMatch[2];
      const year = alphaMatch[3] ? alphaMatch[3] : new Date().getFullYear();
      return `${monthName} ${day}, ${year}`;
    }

    return cleaned;
  };

  // Formats ranges like "Dec 25 - Jan 24, 2026" by normalizing dates and setting full month formats
  const formatPeriodRange = (rangeStr) => {
    if (!rangeStr || rangeStr === 'N/A' || rangeStr === 'Not Found') return 'N/A';
    const dates = rangeStr.split(/\s*(?:-|to|through|–|—)\s*/);
    if (dates.length >= 2) {
      let start = dates[0].trim();
      let end = dates[1].trim();
      start = normalizeDateWithYear(start, end);
      return `${formatDateToFull(start)} — ${formatDateToFull(end)}`;
    }
    return formatDateToFull(rangeStr);
  };

  // Format Date & Time spacing, capitalization, and date formatting
  const formatDateTime = (str) => {
    if (!str || str === 'N/A' || str === 'Not Found') return 'N/A';
    
    const parts = str.split(/\s+at\s+/i);
    if (parts.length === 2) {
      const datePart = formatDateToFull(parts[0].trim());
      const timePart = parts[1].replace(/(\d{1,2}:\d{2})\s*(AM|PM|am|pm)?/i, (match, p1, p2) => {
        const suffix = p2 ? p2.toUpperCase() : '';
        return `${p1} ${suffix}`;
      }).replace(/\s+/g, ' ').trim();
      return `${datePart} at ${timePart}`;
    }
    
    return formatDateToFull(str);
  };

  const hasData = data && Object.keys(data).length > 0;

  return (
    <div className="space-y-4">
      {hasData && (
        <div className="flex items-center justify-between mb-1 px-1 select-none">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
            Extracted Results
          </span>
          <span className={`text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
            method === 'ai' 
              ? 'bg-indigo-50 border-indigo-100 text-indigo-600' 
              : method === 'error'
              ? 'bg-red-50 border-red-100 text-red-600'
              : 'bg-amber-50 border-amber-100 text-amber-600'
          }`}>
            {method === 'ai' 
              ? '🤖 AI Extraction' 
              : method === 'error'
              ? '⚠️ AI Failed (Fallback)'
              : '⚡ Local Parsing'}
          </span>
        </div>
      )}

      {isPaycheck && (
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
            value={formatPeriodRange(displayData.payPeriod)}
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
            value={formatDateToFull(displayData.payDate)}
            onCopy={onCopyField}
          />
        </>
      )}

      {isCard && (
        <>
          <CopyableRow
            label="STATEMENT BALANCE"
            value={displayData.statementBalance}
            highlight={true}
            onCopy={onCopyField}
          />
          <CopyableRow
            label="START DATE"
            value={formatDateToFull(displayData.startDate)}
            onCopy={onCopyField}
          />
          <CopyableRow
            label="END DATE"
            value={formatDateToFull(displayData.endDate)}
            onCopy={onCopyField}
          />
          <CopyableRow
            label="STATEMENT PERIOD"
            value={formatPeriodRange(displayData.statementPeriod)}
            onCopy={onCopyField}
          />
        </>
      )}

      {isTransaction && (
        <>
          <CopyableRow
            label="AMOUNT"
            value={displayData.amount}
            highlight={true}
            onCopy={onCopyField}
            forceLowercaseCopy={true}
          />
          <CopyableRow
            label="DATE & TIME"
            value={formatDateTime(displayData.dateTime)}
            onCopy={onCopyField}
            forceLowercaseCopy={false}
          />
        </>
      )}
    </div>
  );
}
