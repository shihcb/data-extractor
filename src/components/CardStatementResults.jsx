import React, { useState } from 'react';
import CopyableRow from './CopyableRow';
import { Copy, Check } from 'lucide-react';

export default function CardStatementResults({ cardData, onCopyField }) {
  const [copiedTxId, setCopiedTxId] = useState(null);

  if (!cardData) return null;

  const handleCopyTx = (tx) => {
    const textToCopy = `${tx.date} - ${tx.description}: ${tx.amount}`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedTxId(tx.id);
    if (onCopyField) {
      onCopyField('Transaction', textToCopy);
    }
    setTimeout(() => setCopiedTxId(null), 1800);
  };

  return (
    <div className="outer-shape p-6 sm:p-8 animate-fade-in space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold shadow-sm">
            2
          </span>
          <span className="font-extrabold text-base sm:text-lg text-slate-900 tracking-tight">
            Extracted Values
          </span>
        </div>
        <span className="bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-extrabold px-3 py-1 rounded-full">
          Ready to Copy
        </span>
      </div>

      <div className="space-y-4 pt-2">
        <CopyableRow
          label="Total Balance Due"
          value={cardData.statementBalance}
          highlight={true}
          onCopy={onCopyField}
        />

        <CopyableRow
          label="Card / Account Last 4"
          value={cardData.cardLast4}
          onCopy={onCopyField}
        />

        <CopyableRow
          label="Statement Period"
          value={cardData.statementPeriod}
          onCopy={onCopyField}
        />

        <CopyableRow
          label="Minimum Payment"
          value={cardData.minimumPayment}
          onCopy={onCopyField}
        />

        <CopyableRow
          label="Payment Due Date"
          value={cardData.dueDate}
          onCopy={onCopyField}
        />

        <CopyableRow
          label="Issuing Bank Name"
          value={cardData.bankName}
          onCopy={onCopyField}
        />

        {/* Itemized Transactions */}
        {cardData.transactions && cardData.transactions.length > 0 && (
          <div className="pt-4 space-y-3">
            <div className="text-xs font-extrabold uppercase tracking-wider text-slate-400 px-1">
              Itemized Transactions
            </div>

            <div className="space-y-3">
              {cardData.transactions.map((tx) => {
                const isCopied = copiedTxId === tx.id;
                return (
                  <div
                    key={tx.id}
                    onClick={() => handleCopyTx(tx)}
                    className="cursor-pointer inset-shape p-5 flex items-center justify-between gap-4 text-sm hover:border-slate-400 transition-all"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-extrabold text-slate-900 text-base truncate">
                        <span className="font-mono text-slate-400 mr-2">{tx.date}</span>
                        {tx.description}
                      </div>
                      <div className="font-mono text-slate-700 font-bold text-base mt-0.5">{tx.amount}</div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopyTx(tx)}
                      className={`copy-pill-btn shrink-0 ${isCopied ? 'copied' : ''}`}
                    >
                      {isCopied ? <Check size={14} /> : <Copy size={14} />}
                      <span>{isCopied ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
