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
  // Unique ID per instance so label htmlFor is always correct
  const inputId = useId();

  const handleChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      onFileUpload(e.target.files[0]);
      // Reset so selecting the same file again fires onChange
      e.target.value = '';
    }
  };

  // ── Loading state ─────────────────────────────────────────
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

  // ── Uploaded state ────────────────────────────────────────
  // RefreshCw is a <label> so iOS activates the input on the first tap
  if (fileName) {
    return (
      <div className="independent-row-card uploader-card">
        <input
          id={inputId}
          type="file"
          accept="application/pdf,image/png,image/jpeg,image/webp,text/plain,text/csv"
          onChange={handleChange}
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

        {/* label htmlFor = native association — single tap on iOS triggers picker */}
        <label
          htmlFor={inputId}
          className="icon-copy-btn shrink-0 cursor-pointer"
          title="Upload a new file to override"
        >
          <RefreshCw size={14} />
        </label>
      </div>
    );
  }

  // ── Empty state ───────────────────────────────────────────
  // "+" box is a <label> — single tap on iOS triggers picker directly
  return (
    <div className="independent-row-card uploader-card">
      <input
        id={inputId}
        type="file"
        accept="application/pdf,image/png,image/jpeg,image/webp,text/plain,text/csv"
        onChange={handleChange}
        className="hidden"
      />

      <div className="flex items-center gap-2.5 min-w-0 flex-1 text-left">
        <Upload size={16} className="text-slate-800 shrink-0" />
        <span className="font-extrabold text-xs sm:text-sm text-slate-800 tracking-wider">
          {uploadText}
        </span>
      </div>

      {/* label htmlFor = native association — single tap on iOS triggers picker */}
      <label
        htmlFor={inputId}
        className="upload-plus-btn cursor-pointer"
        title="Choose file"
      >
        +
      </label>
    </div>
  );
}
