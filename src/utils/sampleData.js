/**
 * Sample statements and paystubs for instant zero-config testing
 */

export const SAMPLE_PAYCHECK = {
  payPeriod: '08/01/2026 - 08/15/2026',
  grossIncome: '$3,850.00',
  netPay: '$2,914.50',
  hoursWorked: '80.00 hrs',
  paycheckNumber: 'CHK-9842107',
  orderNumber: 'ORD-2026-8819',
  batchNumber: 'BTH-0815-PAY',
  receiptNumber: 'RCPT-49102841',
  payDate: '08/18/2026',
  employer: 'Apex Global Technologies Inc.',
  employee: 'Shihab Chow (ID: EMP-4092)',
  deductions: {
    fedTax: '$462.00',
    stateTax: '$192.50',
    socialSecurity: '$238.70',
    medicare: '$55.83',
    retirement401k: '$115.50'
  },
  rawText: `APEX GLOBAL TECHNOLOGIES INC.
100 Silicon Way, Suite 400, San Francisco, CA 94105

EARNINGS STATEMENT / PAYSTUB
Employee Name: Shihab Chow (ID: EMP-4092)
Pay Period: 08/01/2026 - 08/15/2026
Pay Date: 08/18/2026

IDENTIFIERS & BATCH DETAILS:
Paycheck Number: CHK-9842107
Order Number: ORD-2026-8819
Batch Number: BTH-0815-PAY
Receipt Number: RCPT-49102841

EARNINGS SUMMARY:
Regular Hours: 80.00 hrs @ $48.125 / hr
Gross Earnings: $3,850.00

TAXES & DEDUCTIONS:
Federal Income Tax: $462.00
State Income Tax: $192.50
Social Security (FICA): $238.70
Medicare Tax: $55.83
401(k) Pre-Tax Contribution: $115.50

NET PAY DISTRIBUTIONS:
Net Take-Home Pay: $2,914.50
Direct Deposit to Account ending in *4921`
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
    { id: 4, date: '07/16', description: 'PAYMENT THANK YOU - MOBILE', amount: '$500.00', type: 'credit' },
    { id: 5, date: '07/22', description: 'DELTA AIR LINES ATLANTA GA', amount: '$380.20', type: 'debit' },
    { id: 6, date: '07/28', description: 'STARBUCKS STORE 10429 SEATTLE WA', amount: '$9.45', type: 'debit' }
  ],
  rawText: `CHASE FREEDOM UNLIMITED
P.O. Box 15298, Wilmington, DE 19850

ACCOUNT STATEMENT
Account Ending in: 8821
Billing Period: 07/01/2026 - 07/31/2026
Payment Due Date: 08/25/2026

ACCOUNT SUMMARY:
Previous Balance: $896.11
Payments & Credits: -$500.00
Purchases & Adjustments: +$1,086.24
New Balance: $1,482.35
Minimum Payment Due: $35.00

TRANSACTION DETAIL:
07/02 APPLE.COM/BILL CUPERTINO CA $14.99
07/05 WHOLE FOODS MKT AUSTIN TX $142.60
07/11 CHEVRON 0392 SAN JOSE CA $48.50
07/16 PAYMENT THANK YOU - MOBILE -$500.00
07/22 DELTA AIR LINES ATLANTA GA $380.20
07/28 STARBUCKS STORE 10429 SEATTLE WA $9.45`
};

export const SAMPLE_DEBIT_STATEMENT = {
  bankName: 'Bank of America Checking & Debit',
  cardLast4: '•••• 3094',
  statementPeriod: '07/01/2026 - 07/31/2026',
  statementBalance: '$5,240.18',
  minimumPayment: '$0.00',
  dueDate: 'N/A (Checking)',
  transactions: [
    { id: 1, date: '07/03', description: 'DIRECT DEPOSIT APEX GLOBAL PAYROLL', amount: '$2,914.50', type: 'credit' },
    { id: 2, date: '07/05', description: 'CON EDISON UTILITY AUTOPAY', amount: '$124.30', type: 'debit' },
    { id: 3, date: '07/10', description: 'TARGET STORE BROOKLYN NY', amount: '$86.15', type: 'debit' },
    { id: 4, date: '07/17', description: 'DIRECT DEPOSIT APEX GLOBAL PAYROLL', amount: '$2,914.50', type: 'credit' }
  ],
  rawText: `BANK OF AMERICA
Account Statement - Advantage Checking ending in 3094
Statement Period: 07/01/2026 - 07/31/2026

SUMMARY:
Beginning Balance: $2,580.48
Deposits and Credits: +$5,829.00
Withdrawals and Debits: -$3,169.30
Ending Balance: $5,240.18

TRANSACTIONS:
07/03 DIRECT DEPOSIT APEX GLOBAL PAYROLL $2,914.50
07/05 CON EDISON UTILITY AUTOPAY -$124.30
07/10 TARGET STORE BROOKLYN NY -$86.15
07/17 DIRECT DEPOSIT APEX GLOBAL PAYROLL $2,914.50`
};
