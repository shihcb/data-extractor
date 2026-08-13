import React, { useRef, useState } from 'react';
import { Upload, CheckCircle, RefreshCw, Loader2 } from 'lucide-react';

export default function FileUpload({ onFileUpload, isProcessing, fileName, onClear }) {
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
    <div className="outer-shape p-6 sm:p-8">
      {/* Section Header with badge placed cleanly inside without overlap */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold shadow-sm">
            1
          </span>
          <span className="font-extrabold text-base sm:text-lg text-slate-900 tracking-tight">
            Upload Statement
          </span>
        </div>
        <span className="bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold px-3 py-1 rounded-full">
          PDF / Image
        </span>
      </div>

      {/* Spacious Drag and Drop Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-200 ${
          isDragOver
            ? 'border-indigo-600 bg-indigo-50/60 scale-[1.005]'
            : fileName
            ? 'border-emerald-400 bg-emerald-50/30'
            : 'border-slate-300 hover:border-slate-400 bg-slate-50/60 hover:bg-slate-100/50'
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
            <Loader2 size={32} className="text-slate-900 animate-spin" />
            <p className="font-bold text-sm text-slate-900">Extracting statement data...</p>
          </div>
        ) : fileName ? (
          <div className="flex items-center justify-center gap-4 py-4">
            <CheckCircle size={28} className="text-emerald-600 shrink-0" />
            <div className="text-left min-w-0">
              <p className="font-extrabold text-base sm:text-lg text-slate-900 truncate max-w-xs sm:max-w-md">
                {fileName}
              </p>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">Click to replace file</p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="p-2 text-slate-400 hover:text-rose-600 rounded-full hover:bg-rose-50 transition-colors ml-2"
              title="Clear file"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="w-14 h-14 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-900 mb-1">
              <Upload size={24} />
            </div>
            <div>
              <p className="text-base sm:text-lg font-extrabold text-slate-900">
                Drag & drop paycheck statement here, or <span className="text-indigo-600 underline">browse</span>
              </p>
              <p className="text-xs font-medium text-slate-500 mt-1">
                Supports PDF, PNG, JPG, WebP, Text, or CSV files
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
