import React, { useId } from 'react';
import { Upload, Loader2, FileText, RefreshCw } from 'lucide-react';

export default function FileUpload({ 
  onFileUpload, 
  isProcessing, 
  fileName, 
  onClear, 
  uploadText = 'UPLOAD STATEMENT',
  uploadedLabel = 'Uploaded Statement'
}) {
  const inputId = useId();

  const handleChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      onFileUpload(e.target.files[0]);
      e.target.value = '';
    }
  };

  // Determine current display heights for standard layout sizing
  const cardHeight = isProcessing ? '50px' : fileName ? '60px' : '52px';

  return (
    <div 
      className="independent-row-card uploader-card relative overflow-hidden"
      style={{
        height: cardHeight,
        transition: 'height 0.25s cubic-bezier(0.25, 1, 0.5, 1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}
      onDoubleClick={fileName && !isProcessing ? onClear : undefined}
      title={fileName && !isProcessing ? "Double-click to remove file" : undefined}
    >
      <input
        id={inputId}
        type="file"
        accept="application/pdf,image/png,image/jpeg,image/webp,text/plain,text/csv"
        onChange={handleChange}
        className="hidden"
      />

      {/* 1. Loading State */}
      <div 
        className="absolute inset-0 flex items-center justify-start px-4"
        style={{
          opacity: isProcessing ? 1 : 0,
          pointerEvents: isProcessing ? 'auto' : 'none',
          transform: isProcessing ? 'translate3d(0, 0, 0)' : 'translate3d(0, 10px, 0)',
          transition: 'opacity 0.2s ease, transform 0.2s cubic-bezier(0.25, 1, 0.5, 1)'
        }}
      >
        <div className="flex items-center gap-1.5 py-[15px]">
          <Loader2 size={16} className="text-black animate-spin shrink-0" />
          <span className="font-extrabold text-xs text-slate-800 tracking-wider">
            extracting data..
          </span>
        </div>
      </div>

      {/* 2. Uploaded State */}
      <div 
        className="absolute inset-0 flex items-center justify-between px-4"
        style={{
          opacity: !isProcessing && fileName ? 1 : 0,
          pointerEvents: !isProcessing && fileName ? 'auto' : 'none',
          transform: !isProcessing && fileName ? 'translate3d(0, 0, 0)' : 'translate3d(0, -10px, 0)',
          transition: 'opacity 0.2s ease, transform 0.2s cubic-bezier(0.25, 1, 0.5, 1)'
        }}
      >
        <div className="min-w-0 flex-1 text-left">
          <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-0.5">
            {uploadedLabel}
          </div>
          <div className="font-bold text-sm sm:text-base text-slate-800 truncate flex items-center gap-1.5 justify-start">
            <FileText size={16} className="text-emerald-600 shrink-0" />
            <span className="truncate">{fileName}</span>
          </div>
        </div>

        <label
          htmlFor={inputId}
          className="icon-copy-btn shrink-0 cursor-pointer"
          title="Upload a new file to override"
        >
          <RefreshCw size={14} />
        </label>
      </div>

      {/* 3. Empty (Default) State */}
      <div 
        className="absolute inset-0 flex items-center justify-between px-4"
        style={{
          opacity: !isProcessing && !fileName ? 1 : 0,
          pointerEvents: !isProcessing && !fileName ? 'auto' : 'none',
          transform: !isProcessing && !fileName ? 'translate3d(0, 0, 0)' : 'translate3d(0, 10px, 0)',
          transition: 'opacity 0.2s ease, transform 0.2s cubic-bezier(0.25, 1, 0.5, 1)'
        }}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1 text-left">
          <Upload size={16} className="text-slate-800 shrink-0" />
          <span className="font-extrabold text-xs sm:text-sm text-slate-800 tracking-wider">
            {uploadText}
          </span>
        </div>

        <label
          htmlFor={inputId}
          className="upload-plus-btn cursor-pointer"
          title="Choose file"
        >
          +
        </label>
      </div>
    </div>
  );
}
