import React, { useId } from 'react';
import { Upload, FileText, RefreshCw, X } from 'lucide-react';

export default function FileUpload({ 
  onFileUpload, 
  isProcessing, 
  fileName, 
  onClear, 
  uploadText = 'UPLOAD STATEMENT',
  uploadedLabel = 'Uploaded Statement',
  docType
}) {
  const inputId = useId();

  // Track docType to detect tab switches
  const [prevDocType, setPrevDocType] = React.useState(docType);
  
  // Layout states
  const [displayFileName, setDisplayFileName] = React.useState(fileName || '');
  const [displayUploadText, setDisplayUploadText] = React.useState(uploadText);
  const [displayUploadedLabel, setDisplayUploadedLabel] = React.useState(uploadedLabel);
  const [isPlaceholder, setIsPlaceholder] = React.useState(!fileName);
  const [isAnimating, setIsAnimating] = React.useState(false);

  // Sync state changes
  React.useEffect(() => {
    // 1. Tab switch: update everything instantly with no animation
    if (docType !== prevDocType) {
      setPrevDocType(docType);
      setDisplayFileName(fileName || '');
      setDisplayUploadText(uploadText);
      setDisplayUploadedLabel(uploadedLabel);
      setIsPlaceholder(!fileName);
      setIsAnimating(false);
      return;
    }

    // 2. Value change (upload / clear): trigger smooth cross-fade animation
    const nextPlaceholder = !fileName;
    const nextFileName = fileName || '';

    if (nextFileName !== displayFileName || nextPlaceholder !== isPlaceholder) {
      setIsAnimating(true);
      const timer = setTimeout(() => {
        setDisplayFileName(nextFileName);
        setDisplayUploadText(uploadText);
        setDisplayUploadedLabel(uploadedLabel);
        setIsPlaceholder(nextPlaceholder);
        setIsAnimating(false);
      }, 350);
      return () => clearTimeout(timer);
    } else {
      // Keep texts in sync
      setDisplayUploadText(uploadText);
      setDisplayUploadedLabel(uploadedLabel);
    }
  }, [fileName, uploadText, uploadedLabel, docType, prevDocType, displayFileName, isPlaceholder]);

  const handleChange = (e) => {
    if (isProcessing) return;
    if (e.target.files && e.target.files[0]) {
      onFileUpload(e.target.files[0]);
      e.target.value = '';
    }
  };

  return (
    <div 
      className={`independent-row-card uploader-card select-none relative overflow-hidden ${isProcessing ? 'processing pointer-events-none cursor-wait' : ''}`}
    >
      <input
        id={inputId}
        type="file"
        accept="application/pdf,image/png,image/jpeg,image/webp,text/plain,text/csv"
        onChange={handleChange}
        className="hidden"
        disabled={isProcessing}
      />

      <div
        style={{
          opacity: isAnimating ? 0 : 1,
          transform: isAnimating ? 'translateY(2px)' : 'translateY(0)',
          transition: 'opacity 0.3s ease-in-out, transform 0.3s ease-in-out',
          width: '100%'
        }}
      >
        {!isPlaceholder ? (
          // ── Uploaded state content ────────────────────────────────
          <div className="w-full flex items-center justify-between h-[38px] shrink-0">
            <div className="min-w-0 flex-1 text-left">
              <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-0.5">
                {displayUploadedLabel}
              </div>
              <div className="font-bold text-sm sm:text-base text-slate-800 truncate flex items-center gap-1.5 justify-start">
                <FileText size={16} className="text-emerald-600 shrink-0" />
                <span className="truncate">{displayFileName}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClear();
                }}
                className="icon-clear-btn shrink-0 cursor-pointer"
                title="Clear file"
              >
                <X size={14} />
              </button>

              <label
                htmlFor={inputId}
                className="icon-copy-btn shrink-0 cursor-pointer"
                title="Upload a new file to override"
              >
                <RefreshCw size={14} />
              </label>
            </div>
          </div>
        ) : (
          // ── Empty state content ───────────────────────────────────
          <div className="w-full flex items-center justify-between h-[38px] shrink-0">
            <div className="flex items-center gap-2.5 min-w-0 flex-1 text-left">
              <Upload size={16} className="text-slate-800 shrink-0" />
              <span className="font-extrabold text-xs sm:text-sm text-slate-800 tracking-wider">
                {displayUploadText}
              </span>
            </div>

            <label
              htmlFor={inputId}
              className="upload-plus-btn shrink-0 cursor-pointer"
              title="Choose file"
            >
              +
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
