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
    <div className="reference-panel p-5 flex flex-col h-full">
      {/* Panel Header matching Column 1 in screenshot */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-bold">
            1
          </span>
          <span className="font-extrabold text-sm text-slate-900">
            upload statement
          </span>
        </div>
        <span className="black-pill-badge">
          pdf / image
        </span>
      </div>

      {/* Tall Inset Container Box (matching tall enter usernames shape in screenshot) */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`reference-inset p-8 text-center cursor-pointer transition-all flex-1 min-h-[380px] sm:min-h-[460px] flex flex-col items-center justify-center ${
          isDragOver
            ? 'border-slate-800 bg-slate-100/80 scale-[1.002]'
            : fileName
            ? 'border-emerald-300 bg-emerald-50/40'
            : 'hover:border-slate-300 hover:bg-slate-100/40'
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
          <div className="flex flex-col items-center py-4 gap-2">
            <Loader2 size={28} className="text-slate-900 animate-spin" />
            <p className="font-bold text-xs text-slate-800">extracting statement data...</p>
          </div>
        ) : fileName ? (
          <div className="flex flex-col items-center justify-center gap-3 py-4">
            <CheckCircle size={32} className="text-emerald-600 shrink-0" />
            <div className="text-center">
              <p className="font-extrabold text-sm text-slate-900 truncate max-w-xs">{fileName}</p>
              <p className="text-xs text-slate-400 mt-1">click to replace file</p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="mt-2 text-xs text-slate-400 hover:text-rose-600 flex items-center gap-1 font-semibold"
            >
              <RefreshCw size={12} /> clear statement
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="w-12 h-12 rounded-full bg-slate-200/80 border border-slate-300/80 flex items-center justify-center text-slate-800 mb-1">
              <Upload size={20} />
            </div>
            <p className="text-sm font-bold text-slate-800">
              drag & drop statement file here, or <span className="underline">browse</span>
            </p>
            <p className="text-xs text-slate-400">PDF, PNG, JPG, WebP, Text, or CSV</p>
          </div>
        )}
      </div>
    </div>
  );
}
