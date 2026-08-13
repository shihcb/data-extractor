import React, { useRef } from 'react';
import { Upload, Loader2, Check } from 'lucide-react';

export default function FileUpload({ onFileUpload, isProcessing, fileName, onClear }) {
  const fileInputRef = useRef(null);

  const handleClick = () => {
    if (fileName) {
      onClear();
    }
    fileInputRef.current?.click();
  };

  return (
    <div className="flex flex-col items-center justify-center py-4">
      {/* Sleek Centered Upload Icon Button */}
      <button
        onClick={handleClick}
        disabled={isProcessing}
        type="button"
        className={`w-28 h-28 sm:w-32 sm:h-32 rounded-[28px] bg-white border border-slate-200 shadow-md hover:shadow-lg flex items-center justify-center transition-all hover:-translate-y-1.5 focus:outline-hidden ${
          isProcessing ? 'border-indigo-400 bg-indigo-50/20' : fileName ? 'border-emerald-300 bg-emerald-50/25 ring-4 ring-emerald-500/10' : 'hover:border-indigo-500'
        }`}
        title={fileName ? `File loaded: ${fileName}. Click to upload another.` : 'Upload Statement'}
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
        ) : fileName ? (
          <Check size={36} className="text-emerald-600 animate-bounce" />
        ) : (
          <Upload size={36} className="text-slate-800" />
        )}
      </button>

      {/* Very clean file name indicator below, only if loaded */}
      {fileName && !isProcessing && (
        <span className="text-[11px] font-bold text-slate-400 mt-3 truncate max-w-xs animate-fade-in">
          {fileName}
        </span>
      )}
    </div>
  );
}
