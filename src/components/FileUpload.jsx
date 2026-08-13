import React, { useRef } from 'react';
import { Upload, Loader2, FileText, RefreshCw } from 'lucide-react';

export default function FileUpload({ onFileUpload, isProcessing, fileName, onClear }) {
  const fileInputRef = useRef(null);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  // If a file is uploaded, render the file card EXACTLY like the other boxes for consistent styling!
  if (fileName && !isProcessing) {
    return (
      <div
        onClick={handleClick}
        className="independent-row-card cursor-pointer"
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
          <div className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-1">
            Uploaded Statement
          </div>
          <div className="font-bold text-lg sm:text-xl text-slate-900 truncate flex items-center gap-2">
            <FileText size={20} className="text-indigo-600 shrink-0" />
            <span className="truncate">{fileName}</span>
          </div>
        </div>

        {/* Action Button: triggers replace */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleClick();
          }}
          className="icon-copy-btn shrink-0"
          title="Replace statement file"
        >
          <RefreshCw size={18} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-4">
      {/* Empty State Centered Upload Icon Button */}
      <button
        onClick={handleClick}
        disabled={isProcessing}
        type="button"
        className={`w-28 h-28 sm:w-32 sm:h-32 rounded-[28px] bg-white border border-slate-200 shadow-md hover:shadow-lg flex items-center justify-center transition-all hover:-translate-y-1.5 focus:outline-hidden ${
          isProcessing ? 'border-indigo-400 bg-indigo-50/20' : 'hover:border-indigo-500'
        }`}
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

        {isProcessing ? (
          <Loader2 size={36} className="text-indigo-600 animate-spin" />
        ) : (
          <Upload size={36} className="text-slate-800" />
        )}
      </button>
    </div>
  );
}
