/**
 * Utility to extract structured document information using Gemini AI
 */

export async function extractDataWithAI(docType, rawText, apiKey) {
  if (!apiKey || !rawText) {
    throw new Error('Missing API Key or raw text content.');
  }

  let promptText = '';
  if (docType === 'paycheck') {
    promptText = `Extract information from the paycheck document text below.
Instructions:
1. Scan the ENTIRE document text to locate all required fields.
2. Ensure you look at headers, body sections, and footers.
3. Return a JSON object with the following schema:
{
  "payPeriod": "string (the range of dates for the pay period, e.g. '07/26/2026 - 08/01/2026', or 'N/A')",
  "grossIncome": "string (the gross income/pay amount, e.g. '$551.86', or 'N/A')",
  "netPay": "string (the net check/pay amount, e.g. '$406.84', or 'N/A')",
  "hoursWorked": "string (total hours worked, e.g. '25.97 hrs' or '25.97', or 'N/A')",
  "paycheckNumber": "string (check or voucher number, or 'N/A')",
  "orderNumber": "string (order/batch/voucher ref, or 'N/A')",
  "batchNumber": "string (batch/run number, or 'N/A')",
  "receiptNumber": "string (receipt number, or 'N/A')",
  "payDate": "string (the date of the payment, e.g. '08/07/2026', or 'N/A')",
  "employer": "string (employer or company name, or 'N/A')",
  "employee": "string (employee or worker name, or 'N/A')"
}

Document Text:
${rawText}`;
  } else if (docType === 'card') {
    promptText = `Extract information from the bank or credit card statement text below.
Instructions:
1. Scan the ENTIRE document text to locate all required fields.
2. Check top headers, transaction summaries, and payment info.
3. Return a JSON object with the following schema:
{
  "bankName": "string (name of the bank/card issuer, e.g. 'Chase Freedom Unlimited', or 'Bank Statement')",
  "cardLast4": "string (last 4 digits of the card or account, formatted as '•••• 1234', or 'N/A')",
  "statementPeriod": "string (statement period date range, e.g. '07/01/2026 - 07/31/2026', or 'N/A')",
  "startDate": "string (statement start date, e.g. '07/01/2026', or 'N/A')",
  "endDate": "string (statement end date, e.g. '07/31/2026', or 'N/A')",
  "statementBalance": "string (the new balance or total amount due, e.g. '$1,482.35', or 'N/A')"
}

Document Text:
${rawText}`;
  } else {
    promptText = `Extract information from the transaction email or receipt text below.
Instructions:
1. Scan the ENTIRE document text to find the transaction details.
2. For emails, the transaction date and time is often the date/time the email was received, which is listed in the email headers (e.g., 'Date:', 'Sent:') at the very beginning of the document. If present, extract that date and time.
3. Return a JSON object with the following schema:
{
  "amount": "string (the transaction amount, e.g. '$25.50', or 'N/A')",
  "dateTime": "string (the date and time of the transaction, e.g. 'August 21, 2026 at 4:30 PM', or 'N/A')",
  "merchant": "string (merchant name in UPPERCASE, e.g. 'STARBUCKS', or 'N/A')"
}

Document Text:
${rawText}`;
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: promptText }],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      }),
    }
  );

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData?.error?.message || `HTTP ${response.status}`);
  }

  const responseData = await response.json();
  const text = responseData?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Empty AI response.');
  }

  const parsed = JSON.parse(text);
  
  // Make sure we carry forward the rawText for components that need it
  return {
    ...parsed,
    rawText: rawText
  };
}
