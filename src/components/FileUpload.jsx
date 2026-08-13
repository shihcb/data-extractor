import React, { useRef, useState } from 'react';
import { Upload, CheckCircle, RefreshCw, Loader2 } from 'lucide-react';

export default function FileUpload({ onFileUpload, isProcessing, activeDocType, fileName, onClear }) {
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
    <div className="minimal-card p-6">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
          isDragOver
            ? 'border-indigo-500 bg-indigo-50/50'
            : fileName
            ? 'border-emerald-300 bg-emerald-50/30'
            : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
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
          <div className="flex flex-col items-center py-2 gap-2">
            <Loader2 size={24} className="text-indigo-600 animate-spin" />
            <p className="font-semibold text-xs text-indigo-900">Extracting Text Details...</p>
          </div>
        ) : fileName ? (
          <div className="flex items-center justify-center gap-3">
            <CheckCircle size={22} className="text-emerald-600 shrink-0" />
            <div className="text-left min-w-0">
              <p className="font-bold text-sm text-slate-800 truncate">{fileName}</p>
              <p className="text-xs text-slate-500">Click to replace file</p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="text-xs text-slate-400 hover:text-rose-600 p-1 ml-2"
              title="Clear file"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Upload size={18} />
            </div>
            <p className="text-xs font-bold text-slate-700">
              Drop {activeDocType === 'paycheck' ? 'paycheck' : 'statement'} PDF or image here, or <span className="text-indigo-600 underline">browse</span>
            </p>
            <p className="text-[11px] text-slate-400">PDF, PNG, JPG, WebP, Text, or CSV</p>
          </div>
        )}
      </div>
    </div>
  );
}
