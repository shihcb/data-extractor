import React, { useRef } from 'react';
import { Upload, Loader2, FileText, RefreshCw, Clipboard } from 'lucide-react';

export default function FileUpload({ onFileUpload, onPasteText, isProcessing, fileName, onClear }) {
  const fileInputRef = useRef(null);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handlePasteClick = async (e) => {
    e.stopPropagation();
    try {
      const clipboardItems = await navigator.clipboard.read();
      
      for (const item of clipboardItems) {
        // Detect if it contains file paths copied from OS Finder (text/uri-list)
        if (item.types.includes('text/uri-list')) {
          alert("To paste a file copied from Finder/Explorer, please press Cmd+V (or Ctrl+V) directly on the page.");
          return;
        }

        // Look for PDF file in clipboard
        const pdfType = item.types.find(t => t === 'application/pdf');
        if (pdfType) {
          const blob = await item.getType('application/pdf');
          const file = new File([blob], "Pasted statement.pdf", { type: 'application/pdf' });
          onFileUpload(file);
          return;
        }

        // Look for Image file in clipboard
        const imgType = item.types.find(t => t.startsWith('image/'));
        if (imgType) {
          const blob = await item.getType(imgType);
          const ext = imgType.split('/')[1] || 'png';
          const file = new File([blob], `Pasted statement.${ext}`, { type: imgType });
          onFileUpload(file);
          return;
        }
      }

      // Fallback to text copy-paste
      const text = await navigator.clipboard.readText();
      if (text && onPasteText) {
        onPasteText(text);
      }
    } catch (err) {
      console.warn('Could not read clipboard items:', err);
      // Fallback direct readText
      try {
        const text = await navigator.clipboard.readText();
        if (text && onPasteText) {
          onPasteText(text);
        }
      } catch (textErr) {
        console.warn('Text fallback failed:', textErr);
      }
    }
  };

  // If processing, show loading indicator inside a horizontal card matching value box style
  if (isProcessing) {
    return (
      <div className="independent-row-card justify-center py-5 animate-fade-in">
        <Loader2 size={18} className="text-indigo-600 animate-spin" />
        <span className="font-bold text-xs text-slate-700 ml-2">Extracting statement data...</span>
      </div>
    );
  }

  // If a file is uploaded, show the horizontal card style with file name
  if (fileName) {
    return (
      <div
        className="independent-row-card uploader-card animate-fade-in"
        title="File uploaded"
      >
        <div className="min-w-0 flex-1 text-left">
          <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-0.5">
            Uploaded Statement
          </div>
          <div className="font-bold text-sm sm:text-base text-slate-800 truncate flex items-center gap-1.5 justify-start">
            <FileText size={16} className="text-indigo-600 shrink-0" />
            <span className="truncate">{fileName}</span>
          </div>
        </div>

        {/* Reload button clears/removes the files and goes to a blank state */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          className="icon-copy-btn shrink-0"
          title="Remove file and clear data"
        >
          <RefreshCw size={14} />
        </button>
      </div>
    );
  }

  // When no file is uploaded, keep the SAME horizontal card appearance:
  return (
    <div
      onClick={handleClick}
      className="independent-row-card cursor-pointer uploader-card hover:border-indigo-500 animate-fade-in"
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

      <div className="flex items-center gap-2.5 min-w-0 flex-1 text-left">
        <Upload size={16} className="text-slate-800 shrink-0" />
        <span className="font-extrabold text-xs sm:text-sm text-slate-800 tracking-wider">
          UPLOAD STATEMENT
        </span>
      </div>

      {/* Action buttons: paste & plus symbol with identical box outline stylings */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={handlePasteClick}
          className="w-[34px] h-[34px] rounded-lg bg-slate-50 border border-slate-300 flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-indigo-50/40 hover:border-indigo-200 transition-colors focus:outline-hidden"
          title="Paste statement file from clipboard"
        >
          <Clipboard size={15} />
        </button>

        <div className="w-[34px] h-[34px] rounded-lg bg-slate-50 border border-slate-300 flex items-center justify-center text-slate-400 text-lg font-bold leading-none select-none">
          +
        </div>
      </div>
    </div>
  );
}
