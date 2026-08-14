import React, { useId } from 'react';
import { Upload, FileText, RefreshCw } from 'lucide-react';

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
    if (isProcessing) return;
    if (e.target.files && e.target.files[0]) {
      onFileUpload(e.target.files[0]);
      e.target.value = '';
    }
  };

  // ── Uploaded state ────────────────────────────────────────
  if (fileName) {
    return (
      <div 
        className="independent-row-card uploader-card animate-fade-in-up"
        onDoubleClick={onClear}
        title="Double-click to remove file"
        style={{ visibility: isProcessing ? 'hidden' : 'visible' }}
      >
        <input
          id={inputId}
          type="file"
          accept="application/pdf,image/png,image/jpeg,image/webp,text/plain,text/csv"
          onChange={handleChange}
          className="hidden"
          disabled={isProcessing}
        />

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
    );
  }

  // ── Empty state ───────────────────────────────────────────
  return (
    <div 
      className="independent-row-card uploader-card animate-fade-in-up"
      style={{ visibility: isProcessing ? 'hidden' : 'visible' }}
    >
      <input
        id={inputId}
        type="file"
        accept="application/pdf,image/png,image/jpeg,image/webp,text/plain,text/csv"
        onChange={handleChange}
        className="hidden"
        disabled={isProcessing}
      />

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
  );
}
