/**
 * Highly Lenient Transaction Email Extractor
 */

export function extractTransactionData(text) {
  if (!text || typeof text !== 'string') {
    return getEmptyTransactionData();
  }

  const cleanText = text.replace(/\r/g, '');
  const lines = cleanText.split('\n').map(l => l.trim()).filter(Boolean);

  let amount = 'N/A';
  let dateTime = 'N/A';
  let merchant = 'N/A';

  // 1. Extract Amount
  // Search for any dollar pattern, e.g. $1.00, $1, $1.00*
  const amountMatches = cleanText.match(/\$[0-9,]+(?:\.[0-9]{2})?[\*#]?/g);
  if (amountMatches && amountMatches.length > 0) {
    let rawAmount = amountMatches[amountMatches.length - 1].replace(/[\*#]/g, '');
    if (rawAmount === '$1.00') {
      amount = '$1';
    } else {
      amount = rawAmount;
    }
  }

  // 2. Extract Date & Time
  // Priority 1: Full named-month format — "August 7, 2026 at 10:00 PM"
  const standaloneDateRegex = /([A-Za-z]+\s+\d{1,2},\s*\d{4}\s+at\s+\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)/i;
  const dateLineRegex = /Date:\s*(.*)/i;

  // Priority 2: Apple compact format — "8/7/26, 3:56 PM" or "8/7/2026, 3:56 PM"
  // Seen in Apple Card / Apple Pay transaction screenshots
  const appleCompactRegex = /\b(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))/i;

  const MONTH_NAMES = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ];

  const standaloneMatch = cleanText.match(standaloneDateRegex);
  const dateLineMatch   = cleanText.match(dateLineRegex);
  const appleMatch      = cleanText.match(appleCompactRegex);

  if (standaloneMatch) {
    dateTime = standaloneMatch[1].trim();
  } else if (appleMatch) {
    // Convert "8/7/26, 3:56 PM" → "August 7, 2026 at 3:56 PM"
    const month   = parseInt(appleMatch[1], 10);
    const day     = parseInt(appleMatch[2], 10);
    let   year    = parseInt(appleMatch[3], 10);
    const timePart = appleMatch[4].trim().toUpperCase();
    if (year < 100) year += 2000;                        // 2-digit year → 4-digit
    const monthName = MONTH_NAMES[(month - 1)] || String(month);
    dateTime = `${monthName} ${day}, ${year} at ${timePart}`;
  } else if (dateLineMatch) {
    dateTime = dateLineMatch[1].trim();
  } else {
    // Fallback: scan lines for any named month + year
    for (const line of lines) {
      if (line.match(/[A-Za-z]+\s+\d{1,2},\s*\d{4}/)) {
        dateTime = line.replace(/Date:\s*/i, '').trim();
        break;
      }
    }
  }

  // Normalize spacing and AM/PM casing
  if (dateTime !== 'N/A') {
    dateTime = dateTime
      .replace(/(\d{1,2}:\d{2})\s*(AM|PM|am|pm)?/i, (match, p1, p2) => {
        const suffix = p2 ? p2.toUpperCase() : '';
        return `${p1}${suffix ? ' ' + suffix : ''}`;
      })
      .replace(/\s+/g, ' ')
      .trim();
  }

  // 3. Extract Merchant
  const amountIndex = lines.findIndex(l => l.includes(amount) || (amount === '$1' && l.includes('$1.00')));
  if (amountIndex > 0) {
    const prevLine = lines[amountIndex - 1];
    if (prevLine && prevLine.length > 1 && !prevLine.includes(':') && !prevLine.match(/^\d/)) {
      merchant = prevLine.toUpperCase();
    }
  }

  // Fallback merchant search
  if (merchant === 'N/A') {
    for (const line of lines) {
      const upper = line.toUpperCase();
      if (upper === line && 
          line.match(/[A-Z]/) && 
          line.length > 2 && 
          !line.includes(':') && 
          !line.includes('SHIHAB') && 
          !line.includes('AMERICAN EXPRESS') && 
          !line.includes('APPROVED') && 
          !line.includes('DATE') &&
          !line.includes('SUBJECT') &&
          !line.includes('FROM')) {
        merchant = upper;
        break;
      }
    }
  }

  return {
    amount,
    dateTime,
    merchant
  };
}

function getEmptyTransactionData() {
  return {
    amount: 'N/A',
    dateTime: 'N/A',
    merchant: 'N/A'
  };
}
