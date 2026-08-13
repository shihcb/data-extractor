import React from 'react';
import { 
  Calendar, 
  DollarSign, 
  Clock, 
  Hash, 
  Layers, 
  Receipt, 
  Building2, 
  User, 
  FileCheck,
  Percent,
  Copy,
  Check
} from 'lucide-react';
import CopyableRow from './CopyableRow';

export default function PaycheckResults({ paycheckData, onCopyField, onCopyAll }) {
  if (!paycheckData) return null;

  return (
    <div className="space-[#16] flex flex-col gap-6 animate-fade-in">
      {/* Top Banner Overview */}
      <div className="glass-panel p-5 relative overflow-hidden bg-gradient-to-r from-slate-900/90 via-violet-950/30 to-slate-900/90 border-violet-500/30">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-violet-500/20 border border-violet-500/40 flex items-center justify-center text-violet-400 font-bold">
              <DollarSign size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-lg sm:text-xl text-white">
                  Paycheck Breakdown
                </h3>
                <span className="badge badge-paycheck">Extracted</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Every field below has a dedicated 1-click copy button on its line.
              </p>
            </div>
          </div>

          <button
            onClick={onCopyAll}
            className="copy-btn bg-violet-600/30 hover:bg-violet-600/50 border-violet-500/40 text-violet-200 shadow-md shadow-violet-500/10"
          >
            <Copy size={14} />
            <span>Copy Full Paystub Summary</span>
          </button>
        </div>
      </div>

      {/* Core Financial Metrics (Net Pay, Gross Income, Hours, Period) */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          Primary Earnings & Period
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Net Pay (Highlighted) */}
          <CopyableRow
            label="Net Take-Home Pay"
            value={paycheckData.netPay}
            icon={DollarSign}
            tag="NET"
            highlight={true}
            onCopy={onCopyField}
          />

          {/* Gross Income */}
          <CopyableRow
            label="Gross Income"
            value={paycheckData.grossIncome}
            icon={DollarSign}
            tag="GROSS"
            onCopy={onCopyField}
          />

          {/* Pay Period */}
          <CopyableRow
            label="Pay Period (Dates Covered)"
            value={paycheckData.payPeriod}
            icon={Calendar}
            onCopy={onCopyField}
          />

          {/* Hours Worked */}
          <CopyableRow
            label="Total Hours Worked"
            value={paycheckData.hoursWorked}
            icon={Clock}
            onCopy={onCopyField}
          />
        </div>
      </div>

      {/* Identifiers & Receipt/Batch Numbers */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
          Statement Identifiers & Batch Numbers
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Paycheck / Check Number */}
          <CopyableRow
            label="Paycheck / Check Number"
            value={paycheckData.paycheckNumber}
            icon={Hash}
            onCopy={onCopyField}
          />

          {/* Order Number */}
          <CopyableRow
            label="Order Number"
            value={paycheckData.orderNumber}
            icon={FileCheck}
            onCopy={onCopyField}
          />

          {/* Batch Number */}
          <CopyableRow
            label="Batch Number"
            value={paycheckData.batchNumber}
            icon={Layers}
            onCopy={onCopyField}
          />

          {/* Receipt / Advice Number */}
          <CopyableRow
            label="Receipt / Advice Number"
            value={paycheckData.receiptNumber}
            icon={Receipt}
            onCopy={onCopyField}
          />
        </div>
      </div>

      {/* Employer & Employee Context */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-violet-400"></span>
          Employer & Payment Info
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <CopyableRow
            label="Employer Name"
            value={paycheckData.employer}
            icon={Building2}
            onCopy={onCopyField}
          />

          <CopyableRow
            label="Employee Name / ID"
            value={paycheckData.employee}
            icon={User}
            onCopy={onCopyField}
          />

          <CopyableRow
            label="Pay / Issue Date"
            value={paycheckData.payDate}
            icon={Calendar}
            onCopy={onCopyField}
          />
        </div>
      </div>

      {/* Deductions Breakdown (if available) */}
      {paycheckData.deductions && Object.keys(paycheckData.deductions).some(k => paycheckData.deductions[k]) && (
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            Taxes & Deductions Line Breakdown
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {paycheckData.deductions.fedTax && (
              <CopyableRow
                label="Federal Income Tax"
                value={paycheckData.deductions.fedTax}
                icon={Percent}
                onCopy={onCopyField}
              />
            )}
            {paycheckData.deductions.stateTax && (
              <CopyableRow
                label="State Income Tax"
                value={paycheckData.deductions.stateTax}
                icon={Percent}
                onCopy={onCopyField}
              />
            )}
            {paycheckData.deductions.socialSecurity && (
              <CopyableRow
                label="Social Security (FICA)"
                value={paycheckData.deductions.socialSecurity}
                icon={Percent}
                onCopy={onCopyField}
              />
            )}
            {paycheckData.deductions.medicare && (
              <CopyableRow
                label="Medicare Tax"
                value={paycheckData.deductions.medicare}
                icon={Percent}
                onCopy={onCopyField}
              />
            )}
            {paycheckData.deductions.retirement401k && (
              <CopyableRow
                label="401(k) Pre-Tax Contribution"
                value={paycheckData.deductions.retirement401k}
                icon={Percent}
                onCopy={onCopyField}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
