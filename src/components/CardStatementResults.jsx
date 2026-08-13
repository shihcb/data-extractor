import React, { useState } from 'react';
import { 
  CreditCard, 
  Calendar, 
  DollarSign, 
  Building2, 
  Search, 
  Copy, 
  Check, 
  ArrowUpRight, 
  ArrowDownLeft,
  Clock
} from 'lucide-react';
import CopyableRow from './CopyableRow';

export default function CardStatementResults({ cardData, onCopyField, onCopyAll }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedTxId, setCopiedTxId] = useState(null);

  if (!cardData) return null;

  const filteredTransactions = (cardData.transactions || []).filter(tx => 
    tx.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tx.date.includes(searchQuery) ||
    tx.amount.includes(searchQuery)
  );

  const handleCopyTx = (tx) => {
    const textToCopy = `${tx.date} - ${tx.description}: ${tx.amount}`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedTxId(tx.id);
    if (onCopyField) {
      onCopyField('Transaction', textToCopy);
    }
    setTimeout(() => {
      setCopiedTxId(null);
    }, 2000);
  };

  return (
    <div className="space-y-6 flex flex-col gap-6 animate-fade-in">
      {/* Header Banner */}
      <div className="glass-panel p-5 relative overflow-hidden bg-gradient-to-r from-slate-900/90 via-cyan-950/30 to-slate-900/90 border-cyan-500/30">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 font-bold">
              <CreditCard size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-lg sm:text-xl text-white">
                  {cardData.bankName}
                </h3>
                <span className="badge badge-card">Statement Parsed</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Granular field extraction with line-by-line single-click copy buttons.
              </p>
            </div>
          </div>

          <button
            onClick={onCopyAll}
            className="copy-btn bg-cyan-600/30 hover:bg-cyan-600/50 border-cyan-500/40 text-cyan-200 shadow-md shadow-cyan-500/10"
          >
            <Copy size={14} />
            <span>Copy Full Statement Summary</span>
          </button>
        </div>
      </div>

      {/* Primary Account & Statement Metrics */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
          Account & Balance Information
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Card / Account Ending */}
          <CopyableRow
            label="Card / Account Last 4 Digits"
            value={cardData.cardLast4}
            icon={CreditCard}
            onCopy={onCopyField}
          />

          {/* Statement Period */}
          <CopyableRow
            label="Statement Billing Period"
            value={cardData.statementPeriod}
            icon={Calendar}
            onCopy={onCopyField}
          />

          {/* Statement Balance (Highlighted) */}
          <CopyableRow
            label="Total New Balance / Amount Due"
            value={cardData.statementBalance}
            icon={DollarSign}
            tag="BALANCE"
            highlight={true}
            onCopy={onCopyField}
          />

          {/* Minimum Payment */}
          <CopyableRow
            label="Minimum Payment Due"
            value={cardData.minimumPayment}
            icon={DollarSign}
            onCopy={onCopyField}
          />

          {/* Payment Due Date */}
          <CopyableRow
            label="Payment Due Date"
            value={cardData.dueDate}
            icon={Clock}
            onCopy={onCopyField}
          />

          {/* Bank / Issuer Name */}
          <CopyableRow
            label="Issuing Bank / Financial Institution"
            value={cardData.bankName}
            icon={Building2}
            onCopy={onCopyField}
          />
        </div>
      </div>

      {/* Itemized Transactions Table with individual copy buttons */}
      <div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            Itemized Transactions ({filteredTransactions.length})
          </h4>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search merchant or amount..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="glass-input w-full pl-8 py-1.5 text-xs"
            />
          </div>
        </div>

        <div className="space-y-2">
          {filteredTransactions.length === 0 ? (
            <div className="glass-panel p-6 text-center text-slate-400 text-sm italic">
              No transactions matching "{searchQuery}"
            </div>
          ) : (
            filteredTransactions.map((tx) => {
              const isCopied = copiedTxId === tx.id;
              return (
                <div
                  key={tx.id}
                  className="field-row flex items-center justify-between gap-3 py-2.5 px-4"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`p-2 rounded-lg shrink-0 ${
                      tx.type === 'credit' 
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                        : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                    }`}>
                      {tx.type === 'credit' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-400 font-semibold">{tx.date}</span>
                        <span className="font-semibold text-sm text-slate-100 truncate">{tx.description}</span>
                      </div>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">
                        {tx.amount} ({tx.type === 'credit' ? 'Credit / Payment' : 'Debit Purchase'})
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleCopyTx(tx)}
                    className={`copy-btn ${isCopied ? 'copied' : ''}`}
                    title="Copy full transaction line"
                  >
                    {isCopied ? (
                      <>
                        <Check size={13} className="text-emerald-400 animate-bounce" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={13} />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
