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
    <div className="premium-card p-6 sm:p-8">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-10 sm:p-16 text-center cursor-pointer transition-all duration-200 ${
          isDragOver
            ? 'border-indigo-600 bg-indigo-50/40 scale-[1.002]'
            : fileName
            ? 'border-emerald-300 bg-emerald-50/10'
            : 'border-slate-300 hover:border-indigo-500 bg-slate-50/60 hover:bg-indigo-50/10'
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
            <p className="font-extrabold text-base text-[#0f172a]">Extracting statement data...</p>
          </div>
        ) : fileName ? (
          <div className="flex items-center justify-center gap-4 py-4">
            <CheckCircle2 size={32} className="text-emerald-600 shrink-0" />
            <div className="text-left min-w-0">
              <p className="font-extrabold text-base sm:text-lg text-slate-800 truncate max-w-xs sm:max-w-md">
                {fileName}
              </p>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">Processed successfully. Click to replace.</p>
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
          <div className="flex flex-col items-center gap-3.5 py-4">
            <div className="w-14 h-14 rounded-full bg-white border border-slate-200/80 shadow-sm flex items-center justify-center text-indigo-600 mb-1">
              <Upload size={24} />
            </div>
            <div>
              <p className="text-base sm:text-lg font-extrabold text-slate-900">
                Drag paycheck or statement here, or <span className="text-indigo-600 underline font-extrabold">browse</span>
              </p>
              <p className="text-xs font-semibold text-slate-400 mt-1.5">
                Supports PDF, PNG, JPG, WebP, Text, or CSV files
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
