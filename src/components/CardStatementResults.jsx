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
    <div className="space-y-3 animate-fade-in pt-2">
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
        <div className="pt-3 space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
            Itemized Transactions
          </div>

          <div className="space-y-2">
            {cardData.transactions.map((tx) => {
              const isCopied = copiedTxId === tx.id;
              return (
                <div
                  key={tx.id}
                  onClick={() => handleCopyTx(tx)}
                  className="cursor-pointer bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm transition-all hover:shadow-md hover:border-indigo-300 hover:-translate-y-0.5 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-800 truncate">
                      <span className="font-mono text-slate-400 mr-2">{tx.date}</span>
                      {tx.description}
                    </div>
                    <div className="font-mono text-slate-600 font-bold mt-0.5">{tx.amount}</div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopyTx(tx)}
                    className={`shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-xl font-bold transition-all ${
                      isCopied
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-indigo-600 hover:text-white'
                    }`}
                  >
                    {isCopied ? <Check size={12} /> : <Copy size={12} />}
                    <span>{isCopied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
