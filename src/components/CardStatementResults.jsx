import React, { useState } from 'react';
import CopyableRow from './CopyableRow';
import { Copy, Check } from 'lucide-react';

export default function CardStatementResults({ cardData, onCopyField, onCopyAll }) {
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
    <div className="minimal-card p-6 space-y-4 animate-fade-in">
      {/* Title & Copy All Button */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h3 className="font-extrabold text-base text-slate-900">
          Extracted Card Values
        </h3>

        <button
          onClick={onCopyAll}
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 transition-colors"
        >
          <Copy size={13} />
          <span>Copy All</span>
        </button>
      </div>

      {/* Field Rows */}
      <div className="space-y-2.5">
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
          label="Total Balance Due"
          value={cardData.statementBalance}
          highlight={true}
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
      </div>

      {/* Itemized Transactions */}
      {cardData.transactions && cardData.transactions.length > 0 && (
        <div className="pt-2 border-t border-slate-100">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            Itemized Transactions ({cardData.transactions.length})
          </div>

          <div className="space-y-2">
            {cardData.transactions.map((tx) => {
              const isCopied = copiedTxId === tx.id;
              return (
                <div
                  key={tx.id}
                  className="field-row flex items-center justify-between gap-3 py-2 px-3 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-800 truncate">
                      <span className="font-mono text-slate-400 mr-2">{tx.date}</span>
                      {tx.description}
                    </div>
                    <div className="font-mono text-slate-500 mt-0.5">{tx.amount}</div>
                  </div>

                  <button
                    onClick={() => handleCopyTx(tx)}
                    className={`copy-btn text-xs py-1 px-2.5 ${isCopied ? 'copied' : ''}`}
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
