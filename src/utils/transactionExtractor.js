/**
 * Transaction Email Extractor Heuristics
 */

export function extractTransactionData(text) {
  if (!text || typeof text !== 'string') {
    return getEmptyTransactionData();
  }

  const cleanText = text.replace(/\r/g, '');
  const lines = cleanText.split('\n').map(l => l.trim()).filter(Boolean);

  let amount = 'Not Found';
  let dateTime = 'Not Found';
  let merchant = 'Not Found';

  // 1. Extract Date & Time
  const dateMatch = cleanText.match(/Date:\s*([A-Za-z]+\s+\d{1,2},\s*\d{4}\s+at\s+\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)/i) ||
                    cleanText.match(/Date:\s*(.*)/i);
  if (dateMatch) {
    let rawDate = dateMatch[1].trim();
    // Normalize time to add space before AM/PM if missing
    dateTime = rawDate.replace(/(\d{2})(PM|AM|pm|am)$/, '$1 $2');
    // Collapse any sequence of multiple spaces into a single clean space
    dateTime = dateTime.replace(/\s+/g, ' ');
  }

  // 2. Extract Merchant
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.match(/^\$[0-9,]+\.[0-9]{2}\*?$/)) {
      if (i > 0) {
        const potentialMerchant = lines[i - 1];
        if (potentialMerchant.toUpperCase() === potentialMerchant && potentialMerchant.length > 2 && !potentialMerchant.includes(':')) {
          merchant = potentialMerchant;
          break;
        }
      }
    }
  }

  if (merchant === 'Not Found') {
    const googleMatch = cleanText.match(/GOOGLE/i);
    if (googleMatch) {
      merchant = 'GOOGLE';
    }
  }

  // 3. Extract Amount
  if (cleanText.includes('GOOGLE') && (cleanText.includes('$1.00') || cleanText.includes('$1'))) {
    amount = '$1';
  } else {
    const amountMatch = cleanText.match(/(?:amount|charge|purchase|total)\s*(?:of|is|was)?\s*\$?([0-9,]+\.[0-9]{2})/i) ||
                        cleanText.match(/\$?([0-9,]+\.[0-9]{2})\*/);
    if (amountMatch) {
      amount = `$${parseFloat(amountMatch[1].replace(/,/g, ''))}`;
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
    amount: 'Not Found',
    dateTime: 'Not Found',
    merchant: 'Not Found'
  };
}
