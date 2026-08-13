import React, { useRef, useState } from 'react';
import { Upload, CheckCircle2, RefreshCw, Loader2 } from 'lucide-react';

export default function Step1Upload({ onFileUpload, isProcessing, fileName, onClear }) {
  const fileInputRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      onFileUpload(e.target.files[0]);
    }
  };

  return (
    <div className="saas-card p-6 sm:p-9">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-full bg-[#0f172a] text-white flex items-center justify-center text-xs font-black shadow-sm">
            1
          </span>
          <h2 className="text-xl font-bold text-[#0f172a] tracking-tight">
            Upload Statement
          </h2>
        </div>

        <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-extrabold px-3.5 py-1.5 rounded-full">
          PDF / Image
        </span>
      </div>

      {/* Dashed Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-200 ${
          isDragOver
            ? 'border-indigo-600 bg-indigo-50/60 scale-[1.003]'
            : fileName
            ? 'border-emerald-400 bg-emerald-50/20'
            : 'border-slate-300 hover:border-indigo-400 bg-slate-50/60 hover:bg-indigo-50/30'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv"
          onChange={handleFileChange}
          className="hidden"
        />

        {isProcessing ? (
          <div className="flex flex-col items-center py-6 gap-3">
            <Loader2 size={36} className="text-indigo-600 animate-spin" />
            <p className="font-extrabold text-base text-[#0f172a]">Extracting data…</p>
            <p className="text-xs text-[#64748b]">Running client-side regex & layout parser</p>
          </div>
        ) : fileName ? (
          <div className="flex items-center justify-center gap-4 py-4">
            <CheckCircle2 size={32} className="text-emerald-600 shrink-0" />
            <div className="text-left min-w-0">
              <p className="font-extrabold text-base sm:text-lg text-[#0f172a] truncate max-w-xs sm:max-w-md">
                {fileName}
              </p>
              <p className="text-xs font-semibold text-[#64748b] mt-0.5">File processed. Click to replace.</p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="p-2 text-slate-400 hover:text-rose-600 rounded-full hover:bg-rose-50 transition-colors ml-2"
              title="Clear file"
            >
              <RefreshCw size={18} />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-4">
            {/* Circle Upload Icon */}
            <div className="w-14 h-14 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-indigo-600 mb-1">
              <Upload size={24} />
            </div>
            <div>
              <p className="text-base sm:text-lg font-extrabold text-[#0f172a]">
                Drag & drop paycheck statement here, or <span className="text-indigo-600 underline font-extrabold decoration-indigo-300">browse</span>
              </p>
              <p className="text-xs font-medium text-[#64748b] mt-1.5">
                Supports PDF, PNG, JPG, WebP, Text, or CSV files
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
