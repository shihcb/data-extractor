import React, { useRef, useState } from 'react';
import { Upload, FileCode, CheckCircle2, AlertCircle, RefreshCw, Sparkles, FileText, Image } from 'lucide-react';

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
    <div className="glass-panel p-5 relative overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Upload size={18} className="text-cyan-400" />
          <h2 className="font-bold text-base text-slate-100">
            Upload {activeDocType === 'paycheck' ? 'Paystub / Paycheck' : 'Card Statement'}
          </h2>
        </div>
        {fileName && (
          <button
            onClick={onClear}
            className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1 transition-colors"
          >
            <RefreshCw size={12} /> Clear File
          </button>
        )}
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-300 ${
          isDragOver
            ? 'border-cyan-400 bg-cyan-500/10 shadow-lg shadow-cyan-500/20 scale-[1.01]'
            : fileName
            ? 'border-emerald-500/40 bg-emerald-950/20'
            : 'border-slate-800 hover:border-slate-600 bg-slate-900/40 hover:bg-slate-900/70'
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
          <div className="flex flex-col items-center justify-center py-4 gap-3">
            <div className="relative w-12 h-12 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" />
              <Sparkles size={20} className="text-cyan-400 animate-pulse" />
            </div>
            <div>
              <p className="font-semibold text-sm text-cyan-300">Extracting Statement Details...</p>
              <p className="text-xs text-slate-400 mt-1">Running client-side PDF/OCR regex parser</p>
            </div>
          </div>
        ) : fileName ? (
          <div className="flex items-center justify-center gap-3 py-2">
            <div className="p-2.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 size={24} />
            </div>
            <div className="text-left">
              <p className="font-bold text-sm text-emerald-300 max-w-[280px] sm:max-w-md truncate">
                {fileName}
              </p>
              <p className="text-xs text-slate-400">File loaded successfully. Click or drop to replace.</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-4 gap-2">
            <div className="w-12 h-12 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-300 group-hover:scale-110 transition-transform">
              <Upload size={22} className="text-cyan-400" />
            </div>
            <div>
              <p className="font-bold text-sm text-slate-200">
                Drag & Drop statement or <span className="text-cyan-400 underline decoration-cyan-400/40">Browse Files</span>
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Supports PDF, PNG, JPG, WebP, Text or CSV (Paychecks & Card Statements)
              </p>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="badge badge-paycheck text-[11px]">
                <FileText size={10} className="inline mr-1" /> PDF Auto-Parse
              </span>
              <span className="badge badge-card text-[11px]">
                <Image size={10} className="inline mr-1" /> Image OCR
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
