/**
 * Sample statements and paystubs updated with user ground truth paystub values
 */

export const SAMPLE_PAYCHECK = {
  payPeriod: '07/26/2026 - 08/01/2026',
  grossIncome: '$551.86',
  netPay: '$406.84',
  hoursWorked: '25.97 hrs',
  paycheckNumber: '8150775',
  orderNumber: 'Not Found',
  batchNumber: 'Not Found',
  receiptNumber: 'Not Found',
  payDate: '08/07/2026',
  employer: 'KAPS Airport Services',
  employee: 'Shihab S Shikder',
  rawText: `From: alerts@prosoftware.com
Subject: Pay Stub for 08/07/2026
Date: August 7, 2026 at 2:40AM
To: shihabbbb@icloud.com

CORNERSTONE PEO
Pay Stub for 08/07/2026
Your 08/07/2026 pay stub is now available!

Pay Date: 08/07/2026 Period: 07/26/2026 - 08/01/2026

Employee: Shihab S Shikder
Client: KAPS Airport Services

Check No. Gross Pay Tips / NonPay Taxes Deductions Net Direct Deposit Check Amount Fed Taxable
8150775 551.86 0.00 102.52 42.50 406.84 406.84 0.00 551.86
YTD 13,864.03 0.00 2,541.59 385.00 10,937.44 10,937.44 0.00 13,864.03

Pay Type Hr/Unit Rate Current YTD
Hourly 25.97 21.25 551.86 13,513.40
Total Earnings 25.97 551.86 13,864.03

Taxes Current YTD
Soc Sec 34.22 859.58
Federal Income Tax 24.30 594.62
State Withholding - NY 18.95 464.22
CITY - NY City Resident 14.07 346.13
Medicare 8.00 201.01

Direct Deposits Amount
CHECKING Acct: ****************8798 406.84`
};

export const SAMPLE_CREDIT_CARD = {
  bankName: 'Chase Freedom Unlimited',
  cardLast4: '•••• 8821',
  statementPeriod: '07/01/2026 - 07/31/2026',
  statementBalance: '$1,482.35',
  minimumPayment: '$35.00',
  dueDate: '08/25/2026',
  transactions: [
    { id: 1, date: '07/02', description: 'APPLE.COM/BILL CUPERTINO CA', amount: '$14.99', type: 'debit' },
    { id: 2, date: '07/05', description: 'WHOLE FOODS MKT AUSTIN TX', amount: '$142.60', type: 'debit' },
    { id: 3, date: '07/11', description: 'CHEVRON 0392 SAN JOSE CA', amount: '$48.50', type: 'debit' },
    { id: 4, date: '07/16', description: 'PAYMENT THANK YOU - MOBILE', amount: '$500.00', type: 'credit' }
  ],
  rawText: `CHASE FREEDOM UNLIMITED
Account Ending in: 8821
Billing Period: 07/01/2026 - 07/31/2026
Payment Due Date: 08/25/2026
New Balance: $1,482.35
Minimum Payment Due: $35.00`
};
