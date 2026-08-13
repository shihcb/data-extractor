/**
 * Paycheck / Paystub Regex & Heuristic Extraction Engine
 * Extracts specific paycheck metadata from raw parsed statement text
 */

export function extractPaycheckData(text) {
  if (!text || typeof text !== 'string') {
    return getEmptyPaycheckData();
  }

  const cleanText = text.replace(/\r/g, '');
  const lines = cleanText.split('\n').map(l => l.trim()).filter(Boolean);

  // 1. Extract Pay Period
  let payPeriod = extractPayPeriod(cleanText);

  // 2. Extract Gross Income
  let grossIncome = extractAmountByKeywords(cleanText, [
    /gross\s*(?:pay|income|earnings|amount)/i,
    /total\s*gross/i,
    /current\s*gross/i,
    /gross/i
  ]);

  // 3. Extract Net Pay
  let netPay = extractAmountByKeywords(cleanText, [
    /net\s*(?:pay|income|earnings|amount|check|deposit)/i,
    /take\s*home\s*pay/i,
    /total\s*net/i,
    /net\s*\$/i
  ]);

  // 4. Extract Hours Worked
  let hoursWorked = extractHoursWorked(cleanText);

  // 5. Extract Paycheck / Check Number
  let paycheckNumber = extractPatternValue(cleanText, [
    /(?:paycheck|check|chk|advice)\s*(?:number|num|no|#)\s*[:.-]?\s*([A-Z0-9-]+)/i,
    /(?:check|chk|advice)\s*#\s*([A-Z0-9-]+)/i,
    /check\s*no[\.\s]*([A-Z0-9-]+)/i
  ]);

  // 6. Extract Order Number
  let orderNumber = extractPatternValue(cleanText, [
    /(?:order)\s*(?:number|num|no|#)\s*[:.-]?\s*([A-Z0-9-]+)/i,
    /order\s*#\s*([A-Z0-9-]+)/i,
    /ord\s*#\s*([A-Z0-9-]+)/i
  ]);

  // 7. Extract Batch Number
  let batchNumber = extractPatternValue(cleanText, [
    /(?:batch)\s*(?:number|num|no|#)\s*[:.-]?\s*([A-Z0-9-]+)/i,
    /batch\s*#\s*([A-Z0-9-]+)/i,
    /bth\s*#\s*([A-Z0-9-]+)/i
  ]);

  // 8. Extract Receipt / Ref Number
  let receiptNumber = extractPatternValue(cleanText, [
    /(?:receipt|ref|reference|transaction)\s*(?:number|num|no|#)\s*[:.-]?\s*([A-Z0-9-]+)/i,
    /(?:receipt|ref)\s*#\s*([A-Z0-9-]+)/i,
    /receipt\s*no[\.\s]*([A-Z0-9-]+)/i
  ]);

  // 9. Extract Pay Date
  let payDate = extractPatternValue(cleanText, [
    /(?:pay\s*date|check\s*date|payment\s*date|issue\s*date)\s*[:.-]?\s*(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4}|[A-Za-z]+\s+\d{1,2},\s*\d{4})/i
  ]);

  // 10. Extract Employer Name
  let employer = extractEmployerName(lines);

  // 11. Extract Employee Name
  let employee = extractPatternValue(cleanText, [
    /(?:employee\s*name|employee|worker)\s*[:.-]?\s*([A-Za-z\s.,-]+)/i,
    /paid\s*to\s*[:.-]?\s*([A-Za-z\s.,-]+)/i
  ]);

  // Deductions summary
  let fedTax = extractAmountByKeywords(cleanText, [/fed(?:eral)?\s*(?:withholding|tax|income\s*tax)/i]);
  let stateTax = extractAmountByKeywords(cleanText, [/state\s*(?:withholding|tax|income\s*tax)/i]);
  let socialSecurity = extractAmountByKeywords(cleanText, [/(?:social\s*security|ss|fica)\s*(?:tax)?/i]);
  let medicare = extractAmountByKeywords(cleanText, [/medicare\s*(?:tax)?/i]);
  let retirement401k = extractAmountByKeywords(cleanText, [/401k|401\(k\)|retirement/i]);

  return {
    payPeriod: payPeriod || 'Not Found',
    grossIncome: grossIncome ? formatCurrency(grossIncome) : 'Not Found',
    netPay: netPay ? formatCurrency(netPay) : 'Not Found',
    hoursWorked: hoursWorked || 'Not Found',
    paycheckNumber: paycheckNumber || 'Not Found',
    orderNumber: orderNumber || 'Not Found',
    batchNumber: batchNumber || 'Not Found',
    receiptNumber: receiptNumber || 'Not Found',
    payDate: payDate || 'Not Found',
    employer: employer || 'Not Found',
    employee: employee || 'Not Found',
    deductions: {
      fedTax: fedTax ? formatCurrency(fedTax) : null,
      stateTax: stateTax ? formatCurrency(stateTax) : null,
      socialSecurity: socialSecurity ? formatCurrency(socialSecurity) : null,
      medicare: medicare ? formatCurrency(medicare) : null,
      retirement401k: retirement401k ? formatCurrency(retirement401k) : null
    },
    rawText: cleanText
  };
}

function getEmptyPaycheckData() {
  return {
    payPeriod: 'Not Found',
    grossIncome: 'Not Found',
    netPay: 'Not Found',
    hoursWorked: 'Not Found',
    paycheckNumber: 'Not Found',
    orderNumber: 'Not Found',
    batchNumber: 'Not Found',
    receiptNumber: 'Not Found',
    payDate: 'Not Found',
    employer: 'Not Found',
    employee: 'Not Found',
    deductions: {},
    rawText: ''
  };
}

function extractPayPeriod(text) {
  // Pattern like: Pay Period: 01/01/2026 - 01/15/2026 or 01/01/2026 to 01/15/2026
  const periodMatch = text.match(/(?:pay\s*period|period\s*covered|period)\s*[:.-]?\s*(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4}\s*(?:-|to|through|–)\s*\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4})/i)
    || text.match(/(?:pay\s*period|period\s*covered|period)\s*[:.-]?\s*([A-Za-z]{3}\s+\d{1,2},\s*\d{4}\s*(?:-|to|through|–)\s*[A-Za-z]{3}\s+\d{1,2},\s*\d{4})/i)
    || text.match(/(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4}\s*(?:-|to|through|–)\s*\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4})/);
  
  if (periodMatch) return periodMatch[1].trim();

  // Range from/to
  const startEndMatch = text.match(/(?:period\s*start|start\s*date)\s*[:.-]?\s*(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4})[\s\S]*?(?:period\s*end|end\s*date)\s*[:.-]?\s*(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4})/i);
  if (startEndMatch) return `${startEndMatch[1]} - ${startEndMatch[2]}`;

  return null;
}

function extractHoursWorked(text) {
  const hoursMatch = text.match(/(?:total\s*hours|hours\s*worked|regular\s*hours|hrs\s*worked)\s*[:.-]?\s*(\d+(?:\.\d+)?)\s*(?:hrs|hours)?/i)
    || text.match(/(\d+(?:\.\d+)?)\s*(?:hrs|hours)\s*(?:worked|total)?/i)
    || text.match(/(?:hours|hrs)\s*[:.-]?\s*(\d+(?:\.\d+)?)/i);

  if (hoursMatch) {
    const val = parseFloat(hoursMatch[1]);
    if (!isNaN(val)) return `${val.toFixed(2)} hrs`;
  }
  return null;
}

function extractAmountByKeywords(text, regexes) {
  for (const regex of regexes) {
    const match = text.match(new RegExp(regex.source + `\\s*[:.-]?\\s*\\$?([0-9,]+(?:\\.[0-9]{2})?)`, 'i'));
    if (match && match[1]) {
      const val = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(val)) return val;
    }
  }

  // Check lines matching key words followed by currency values
  const lines = text.split('\n');
  for (const regex of regexes) {
    for (const line of lines) {
      if (regex.test(line)) {
        const amounts = line.match(/\$?([0-9,]+\.[0-9]{2})/g);
        if (amounts && amounts.length > 0) {
          const val = parseFloat(amounts[amounts.length - 1].replace(/[$,]/g, ''));
          if (!isNaN(val)) return val;
        }
      }
    }
  }

  return null;
}

function extractPatternValue(text, regexes) {
  for (const regex of regexes) {
    const match = text.match(regex);
    if (match && match[1]) {
      const val = match[1].trim();
      if (val && val.length > 1) return val;
    }
  }
  return null;
}

function extractEmployerName(lines) {
  for (let i = 0; i < Math.min(lines.length, 6); i++) {
    const line = lines[i];
    if (line.toLowerCase().includes('corp') || 
        line.toLowerCase().includes('inc') || 
        line.toLowerCase().includes('llc') || 
        line.toLowerCase().includes('technologies') || 
        line.toLowerCase().includes('company') ||
        line.toLowerCase().includes('payroll')) {
      return line.trim();
    }
  }
  return lines[0] || null;
}

function formatCurrency(val) {
  if (typeof val === 'number') {
    return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return val;
}
