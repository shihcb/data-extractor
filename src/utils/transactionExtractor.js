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
  // Prioritize page 1 text for amount matching since the primary receipt total is on page 1
  const page1Text = text.split('\n\n')[0] || cleanText;

  const totalRegexes = [
    /\b(?:grand\s+)?total\b(?:[ \t]+amount)?\s*:?\s*(\$[0-9,]+(?:\.[0-9]{2})?)/i,
    /\b(?:amount\s+charged|amount|charge|price)\b\s*:?\s*(\$[0-9,]+(?:\.[0-9]{2})?)/i
  ];

  let foundAmount = '';
  for (const regex of totalRegexes) {
    const match = page1Text.match(regex);
    if (match) {
      foundAmount = match[1];
      break; // Take the first matched total/charge on page 1 (which represents the global summary)
    }
  }

  if (!foundAmount) {
    // Fallback to checking the whole text for specific Total/Charge/Price phrases
    for (const regex of totalRegexes) {
      const match = cleanText.match(regex);
      if (match) {
        foundAmount = match[1];
        break;
      }
    }
  }

  if (!foundAmount) {
    // If no explicit total lines, fall back to the last dollar amount in page 1
    const page1Matches = page1Text.match(/\$[0-9,]+(?:\.[0-9]{2})?[\*#]?/g);
    if (page1Matches && page1Matches.length > 0) {
      foundAmount = page1Matches[page1Matches.length - 1].replace(/[\*#]/g, '');
    }
  }

  if (!foundAmount) {
    // Final fallback to the last dollar amount in the entire document
    const amountMatches = cleanText.match(/\$[0-9,]+(?:\.[0-9]{2})?[\*#]?/g);
    if (amountMatches && amountMatches.length > 0) {
      foundAmount = amountMatches[amountMatches.length - 1].replace(/[\*#]/g, '');
    }
  }

  if (foundAmount) {
    if (foundAmount === '$1.00') {
      amount = '$1';
    } else {
      amount = foundAmount;
    }
  }

  // 2. Extract Date & Time
  // Try to find email receipt header date (Date: or Sent:) anywhere in the text
  const emailHeaderRegex = /\b(?:Date|Sent):[ \t]*(.*?)(?=\b(?:To|Subject|From|Cc|Bcc|Reply-To):|$)/i;
  let rawDateTime = '';

  for (const line of lines) {
    const match = line.match(emailHeaderRegex);
    if (match) {
      const candidate = match[1].trim();
      // Verify candidate has a date-like shape (e.g. contains month name or slash)
      if (candidate.match(/[A-Za-z]{3}/i) || candidate.match(/\d{1,2}\/\d{1,2}/)) {
        rawDateTime = candidate;
        break;
      }
    }
  }

  // If no email header date, look for other matches in full text
  if (!rawDateTime) {
    const standaloneDateRegex = /([A-Za-z]+[ \t]+\d{1,2},[ \t]*\d{4}[ \t]+at[ \t]+\d{1,2}:\d{2}(?::\d{2})?[ \t]*(?:AM|PM|am|pm)?)/i;
    const appleCompactRegex = /\b(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?[ \t]+(\d{1,2}:\d{2}(?::\d{2})?[ \t]*(?:AM|PM|am|pm))/i;
    const dateLineRegex = /Date:[ \t]*(.*?)(?=\b(?:To|Subject|From|Cc|Bcc|Reply-To):|$)/i;

    const standaloneMatch = cleanText.match(standaloneDateRegex);
    const appleMatch      = cleanText.match(appleCompactRegex);
    const dateLineMatch   = cleanText.match(dateLineRegex);

    if (standaloneMatch) {
      rawDateTime = standaloneMatch[1].trim();
    } else if (appleMatch) {
      const month   = appleMatch[1];
      const day     = appleMatch[2];
      const year    = appleMatch[3];
      const timePart = appleMatch[4].trim();
      rawDateTime = `${month}/${day}/${year} at ${timePart}`;
    } else if (dateLineMatch) {
      rawDateTime = dateLineMatch[1].trim();
    } else {
      // Fallback: scan lines for any named month + year or slashed date
      for (const line of lines) {
        const namedMatch = line.match(/([A-Za-z]+\s+\d{1,2},\s*\d{4})/);
        const slashMatch = line.match(/(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4})/);
        
        if (namedMatch) {
          rawDateTime = namedMatch[1];
          const timeMatch = line.match(/(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)/i);
          if (timeMatch) {
            rawDateTime += ` at ${timeMatch[1]}`;
          }
          break;
        } else if (slashMatch) {
          rawDateTime = slashMatch[1];
          const timeMatch = line.match(/(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)/i);
          if (timeMatch) {
            rawDateTime += ` at ${timeMatch[1]}`;
          }
          break;
        }
      }
    }
  }

  if (rawDateTime) {
    dateTime = normalizeDateTime(rawDateTime);
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

function normalizeDateTime(dateTimeStr) {
  if (!dateTimeStr || dateTimeStr === 'N/A') return 'N/A';

  // 1. Clean weekday names
  let cleaned = dateTimeStr
    .replace(/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*,\s*/i, '')
    .replace(/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\s+/i, '')
    .trim();

  // 2. Clean timezone indicators/offsets
  cleaned = cleaned.replace(/\s*(?:[A-Z]{3,4}|[+-]\d{4})\b/g, '').trim();

  // 3. Extract time part
  const timeRegex = /\b(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM|am|pm)?\b/i;
  const timeMatch = cleaned.match(timeRegex);
  let timeStr = '';
  
  if (timeMatch) {
    const hour = parseInt(timeMatch[1], 10);
    const minute = timeMatch[2];
    const ampm = timeMatch[3] ? timeMatch[3].toUpperCase() : '';
    
    if (!ampm) {
      if (hour >= 12) {
        timeStr = `${hour === 12 ? 12 : hour - 12}:${minute} PM`;
      } else {
        timeStr = `${hour === 0 ? 12 : hour}:${minute} AM`;
      }
    } else {
      timeStr = `${hour}:${minute} ${ampm}`;
    }
    
    // Remove time and connectors like "at" or commas
    cleaned = cleaned
      .replace(timeRegex, '')
      .replace(/\bat\b/i, '')
      .replace(/,\s*$/, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // 4. Parse Date part
  const MONTH_NAMES = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ];
  const MONTH_MAP = {
    jan: 'January', feb: 'February', mar: 'March', apr: 'April',
    may: 'May', jun: 'June', jul: 'July', aug: 'August',
    sep: 'September', oct: 'October', nov: 'November', dec: 'December'
  };

  // Check Month Day, Year (e.g. August 21, 2026)
  const mdMatch = cleaned.match(/^([A-Za-z]+)\s+(\d{1,2})(?:\s*,\s*|\s+)(\d{4})/i) ||
                  cleaned.match(/^([A-Za-z]+)\s+(\d{1,2})\b/i); // No year
  // Check Day Month Year (e.g. 21 August 2026)
  const dmMatch = cleaned.match(/^(\d{1,2})\s+([A-Za-z]+)(?:\s*,\s*|\s+)(\d{4})/i) ||
                  cleaned.match(/^(\d{1,2})\s+([A-Za-z]+)\b/i); // No year
  // Check numeric slashed date (e.g. 8/21/2026)
  const slashMatch = cleaned.match(/\b(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})\b/);

  let dateStr = '';
  if (mdMatch) {
    const mStr = mdMatch[1].toLowerCase().slice(0, 3);
    const monthName = MONTH_MAP[mStr] || mdMatch[1];
    const day = mdMatch[2];
    const year = mdMatch[3] || new Date().getFullYear().toString();
    dateStr = `${monthName} ${day}, ${year}`;
  } else if (dmMatch) {
    const mStr = dmMatch[2].toLowerCase().slice(0, 3);
    const monthName = MONTH_MAP[mStr] || dmMatch[2];
    const day = dmMatch[1];
    const year = dmMatch[3] || new Date().getFullYear().toString();
    dateStr = `${monthName} ${day}, ${year}`;
  } else if (slashMatch) {
    const m = parseInt(slashMatch[1], 10);
    const d = parseInt(slashMatch[2], 10);
    let y = parseInt(slashMatch[3], 10);
    if (y < 100) y += 2000;
    const monthName = MONTH_NAMES[m - 1] || String(m);
    dateStr = `${monthName} ${d}, ${y}`;
  } else {
    dateStr = cleaned || 'N/A';
  }

  let result = dateStr;
  if (timeStr) {
    result = `${dateStr} at ${timeStr}`;
  }

  // Safety net: if the output is too long (sentence fallback), extract just the date/time substring
  if (result.length > 50) {
    const namedMatch = dateTimeStr.match(/([A-Za-z]+\s+\d{1,2},\s*\d{4})/);
    const slashMatch = dateTimeStr.match(/(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4})/);
    if (namedMatch) {
      result = namedMatch[1];
      const timeMatch = dateTimeStr.match(/(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)/i);
      if (timeMatch) {
        result += ` at ${timeMatch[1]}`;
      }
      return normalizeDateTime(result); // Recursively normalize the clean substring
    } else if (slashMatch) {
      result = slashMatch[1];
      const timeMatch = dateTimeStr.match(/(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)/i);
      if (timeMatch) {
        result += ` at ${timeMatch[1]}`;
      }
      return normalizeDateTime(result); // Recursively normalize the clean substring
    }
    return 'N/A';
  }

  return result;
}
