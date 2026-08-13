import React, { useState } from 'react';
import CopyableRow from './CopyableRow';
import { Copy, Check } from 'lucide-react';

export default function CardStatementResults({ cardData, onCopyField }) {
  const [copiedTxId, setCopiedTxId] = useState(null);

  if (!cardData) {
    return (
      <div className="reference-panel p-5 flex flex-col h-full">
        <div className="flex items-center justify-between mb-4 px-1">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-bold">
              2
            </span>
            <span className="font-extrabold text-sm text-slate-900">
              extracted values
            </span>
          </div>
          <span className="black-pill-badge">
            0 loaded
          </span>
        </div>

        <div className="reference-inset p-8 text-center flex-1 min-h-[380px] sm:min-h-[460px] flex flex-col items-center justify-center text-slate-400 font-medium text-xs">
          no values extracted yet. upload a statement on the left.
        </div>
      </div>
    );
  }

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
    <div className="reference-panel p-5 flex flex-col h-full animate-fade-in">
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-bold">
            2
          </span>
          <span className="font-extrabold text-sm text-slate-900">
            extracted values
          </span>
        </div>
        <span className="black-pill-badge">
          ready to copy
        </span>
      </div>

      <div className="space-y-3 overflow-y-auto flex-1 pr-0.5">
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
          <div className="pt-2 space-y-2">
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
                    className="cursor-pointer reference-inset p-3.5 flex items-center justify-between gap-3 text-xs hover:border-slate-400 transition-all"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-slate-900 truncate">
                        <span className="font-mono text-slate-400 mr-2">{tx.date}</span>
                        {tx.description}
                      </div>
                      <div className="font-mono text-slate-600 font-bold mt-0.5">{tx.amount}</div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopyTx(tx)}
                      className={`copy-pill-btn shrink-0 ${isCopied ? 'copied' : ''}`}
                    >
                      {isCopied ? <Check size={12} /> : <Copy size={12} />}
                      <span>{isCopied ? 'copied' : 'copy'}</span>
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
