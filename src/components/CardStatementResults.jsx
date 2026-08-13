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
    <div className="outer-shape p-5 space-y-3 animate-fade-in">
      <div className="flex items-center justify-between px-1 pb-1">
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-bold">
            2
          </span>
          <span className="font-bold text-sm text-slate-900">extracted values</span>
        </div>
        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
          ready to copy
        </span>
      </div>

      <div className="space-y-2.5">
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
                    className="cursor-pointer inset-shape p-3.5 flex items-center justify-between gap-3 text-xs hover:border-slate-400 transition-all"
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
