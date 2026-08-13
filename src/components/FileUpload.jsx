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
    <div className="outer-shape p-5">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-bold">
            1
          </span>
          <span className="font-bold text-sm text-slate-900">upload statement</span>
        </div>
        <span className="bg-slate-900 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full">
          pdf / image
        </span>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`inset-shape p-8 text-center cursor-pointer transition-all ${
          isDragOver
            ? 'border-slate-800 bg-slate-100/80 scale-[1.005]'
            : fileName
            ? 'border-emerald-300 bg-emerald-50/40'
            : 'hover:border-slate-300 hover:bg-slate-100/50'
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
            <Loader2 size={24} className="text-slate-900 animate-spin" />
            <p className="font-bold text-xs text-slate-800">extracting statement data...</p>
          </div>
        ) : fileName ? (
          <div className="flex items-center justify-center gap-3 py-2">
            <CheckCircle size={22} className="text-emerald-600 shrink-0" />
            <div className="text-left min-w-0">
              <p className="font-bold text-sm text-slate-900 truncate">{fileName}</p>
              <p className="text-xs text-slate-500">click to replace file</p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="text-xs text-slate-400 hover:text-rose-600 p-1.5 ml-2"
              title="Clear file"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-4">
            <div className="w-10 h-10 rounded-full bg-slate-200/80 border border-slate-300/80 flex items-center justify-center text-slate-800 mb-1">
              <Upload size={18} />
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
