/**
 * Utility to extract structured document information using Gemini AI
 */

export async function extractDataWithAI(docType, rawText, apiKey, base64Image = null, mimeType = 'image/jpeg') {
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
    promptText = `You are a high-precision data extraction assistant.
Extract transaction details from the receipt or email below.
You are provided with BOTH:
1. The raw extracted text of the document.
2. A high-resolution page image of the document (use this to read headers, tables, and visual sections that might be missing or garbled in the raw text).

Instructions:
1. Scan the ENTIRE document text AND the provided page image to find the required fields.
2. For "amount" (transaction price):
   - Look for keywords like "price", "total", "order total", "charge", "amount", or "$" in the text and image.
   - If multiple amounts are listed, identify the final total charge (e.g. after tax and fees).
   - If there are no clear keywords, make the best educated guess of the final transaction amount from the context (e.g. the main highlighted number, or the value next to the merchant).
3. For "dateTime" (date and time of transaction):
   - Scan the ENTIRE document text and page image (especially the headers at the top of the page).
   - In printed emails, the transaction date and time is often the email receipt header date (e.g. "Date: Aug 18, 2026 at 9:42:20 AM" or "Sent: Tuesday, August 18, 2026, 9:42 AM").
   - These email headers are often rendered visually at the very top of the page image but might be missing in the raw text. Read them from the image!
   - Extract the full date AND the specific time if present (e.g., "August 18, 2026 at 9:42 AM").
   - If you only find a date without a time (e.g. "Aug 18, 2026" at the bottom), search again for any time next to it or in the headers. If no time exists anywhere, return just the date.
4. For "merchant":
   - Identify the merchant or seller name.
   - Format the merchant name in UPPERCASE (e.g. "AMAZON MARKETPLACE", "STARBUCKS").

Return a JSON object with the following schema:
{
  "amount": "string (e.g. '$511.70', or 'N/A')",
  "dateTime": "string (e.g. 'August 18, 2026 at 9:42 AM', or 'N/A')",
  "merchant": "string (e.g. 'AMAZON', or 'N/A')"
}

Document Extracted Text:
"""
${rawText}
"""`;
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: promptText },
              ...(base64Image ? [{
                inlineData: {
                  mimeType: mimeType,
                  data: base64Image
                }
              }] : [])
            ],
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
