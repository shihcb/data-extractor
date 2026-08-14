import React, { useRef } from 'react';
import { Upload, Loader2, FileText, RefreshCw } from 'lucide-react';

export default function FileUpload({ onFileUpload, isProcessing, fileName, onClear }) {
  const fileInputRef = useRef(null);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  // If processing, show loading indicator inside a horizontal card matching value box style
  if (isProcessing) {
    return (
      <div className="independent-row-card justify-center py-5">
        <Loader2 size={20} className="text-indigo-600 animate-spin" />
        <span className="font-bold text-xs text-slate-700 ml-2">Extracting statement data...</span>
      </div>
    );
  }

  // If a file is uploaded, show the horizontal card style with file name
  if (fileName) {
    return (
      <div
        onClick={handleClick}
        className="independent-row-card cursor-pointer uploader-card"
        title="Click to upload another statement"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              onFileUpload(e.target.files[0]);
            }
          }}
          className="hidden"
        />

        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-0.5">
            Uploaded Statement
          </div>
          <div className="font-bold text-sm sm:text-base text-slate-800 truncate flex items-center gap-2">
            <FileText size={18} className="text-indigo-600 shrink-0" />
            <span className="truncate">{fileName}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleClick();
          }}
          className="icon-copy-btn shrink-0"
          title="Replace statement file"
        >
          <RefreshCw size={16} />
        </button>
      </div>
    );
  }

  // When no file is uploaded, keep the SAME horizontal card appearance:
  // "UPLOAD STATEMENT" with the upload symbol next to it
  return (
    <div
      onClick={handleClick}
      className="independent-row-card cursor-pointer uploader-card hover:border-indigo-500"
      title="Upload Statement"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            onFileUpload(e.target.files[0]);
          }
        }}
        className="hidden"
      />

      <div className="flex items-center gap-2.5">
        <Upload size={18} className="text-slate-800 shrink-0" />
        <span className="font-extrabold text-xs sm:text-sm text-slate-800 tracking-wider">
          UPLOAD STATEMENT
        </span>
      </div>

      <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400">
        +
      </div>
    </div>
  );
}
