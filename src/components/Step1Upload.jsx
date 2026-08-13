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
        className={`border border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
          isDragOver
            ? 'border-indigo-500 bg-indigo-50/20'
            : fileName
            ? 'border-emerald-300 bg-emerald-50/10'
            : 'border-slate-200 hover:border-indigo-400 bg-slate-50/40 hover:bg-indigo-50/10'
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
          <div className="flex flex-col items-center py-4 gap-2.5">
            <Loader2 size={28} className="text-indigo-600 animate-spin" />
            <p className="font-semibold text-xs text-slate-800">Extracting details...</p>
          </div>
        ) : fileName ? (
          <div className="flex items-center justify-center gap-3 py-2">
            <CheckCircle2 size={24} className="text-emerald-600 shrink-0" />
            <div className="text-left min-w-0">
              <p className="font-bold text-sm text-slate-800 truncate max-w-[220px] sm:max-w-md">
                {fileName}
              </p>
              <p className="text-xs text-slate-400">Processed. Click or drop to replace.</p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-full ml-2"
              title="Clear file"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="w-11 h-11 rounded-full bg-white border border-slate-100 flex items-center justify-center text-indigo-600 shadow-sm mb-1">
              <Upload size={18} />
            </div>
            <p className="text-xs font-bold text-slate-800">
              Drag paycheck or statement here, or <span className="text-indigo-600 underline font-bold">browse</span>
            </p>
            <p className="text-[10px] text-slate-400">PDF, PNG, JPG, WebP, Text, or CSV</p>
          </div>
        )}
      </div>
    </div>
  );
}
