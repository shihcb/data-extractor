import React, { useRef } from 'react';
import { Upload, Loader2, FileText, RefreshCw } from 'lucide-react';

export default function FileUpload({ 
  onFileUpload, 
  isProcessing, 
  fileName, 
  onClear, 
  uploadText = 'UPLOAD STATEMENT',
  uploadedLabel = 'Uploaded Statement'
}) {
  const fileInputRef = useRef(null);

  const handleClick = (e) => {
    e.stopPropagation();
    fileInputRef.current?.click();
  };

  // If processing, show loading indicator left-aligned with "extracting data.."
  if (isProcessing) {
    return (
      <div className="independent-row-card uploader-card justify-start py-[15px]">
        <div className="flex items-center gap-2.5">
          <Loader2 size={16} className="text-indigo-600 animate-spin shrink-0" />
          <span className="font-extrabold text-xs text-slate-800 tracking-wider">
            extracting data..
          </span>
        </div>
      </div>
    );
  }

  // If a file is uploaded:
  // - Clicking the outer box does NOT trigger file selector.
  // - Only clicking the RefreshCw reload/reset button triggers the file picker.
  if (fileName) {
    return (
      <div
        className="independent-row-card uploader-card"
        title="File uploaded"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,image/png,image/jpeg,image/webp,text/plain,text/csv"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              onFileUpload(e.target.files[0]);
            }
          }}
          className="hidden"
        />

        <div className="min-w-0 flex-1 text-left">
          <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-0.5">
            {uploadedLabel}
          </div>
          <div className="font-bold text-sm sm:text-base text-slate-800 truncate flex items-center gap-1.5 justify-start">
            <FileText size={16} className="text-indigo-600 shrink-0" />
            <span className="truncate">{fileName}</span>
          </div>
        </div>

        {/* Clicking this button directly triggers file selector to choose a new file and override */}
        <button
          type="button"
          onClick={handleClick}
          className="icon-copy-btn shrink-0"
          title="Upload a new file to override"
        >
          <RefreshCw size={14} />
        </button>
      </div>
    );
  }

  // When no file is uploaded:
  // - Clicking the outer box does NOT trigger file selector.
  // - Only clicking the "+" button triggers the file picker.
  return (
    <div
      className="independent-row-card uploader-card"
      title="Upload Statement"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,image/png,image/jpeg,image/webp,text/plain,text/csv"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            onFileUpload(e.target.files[0]);
          }
        }}
        className="hidden"
      />

      <div className="flex items-center gap-2.5 min-w-0 flex-1 text-left">
        <Upload size={16} className="text-slate-800 shrink-0" />
        <span className="font-extrabold text-xs sm:text-sm text-slate-800 tracking-wider">
          {uploadText}
        </span>
      </div>

      {/* Action buttons: "+" symbol box is the ONLY clickable target to trigger file selection */}
      <div className="flex items-center gap-1.5 shrink-0">
        <div 
          onClick={handleClick}
          className="w-[34px] h-[34px] rounded-lg bg-slate-50 border border-slate-300 flex items-center justify-center text-slate-400 text-lg font-bold leading-none select-none cursor-pointer hover:border-indigo-500 hover:text-indigo-600 transition-colors"
          title="Choose file"
        >
          +
        </div>
      </div>
    </div>
  );
}
