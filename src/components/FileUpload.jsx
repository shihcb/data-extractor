import React, { useId } from 'react';
import { Upload, FileText, RefreshCw, X, Archive, Trash2 } from 'lucide-react';

export default function FileUpload({ 
  onFileUpload, 
  isProcessing, 
  fileName, 
  onClear, 
  uploadText = 'UPLOAD STATEMENT',
  uploadedLabel = 'Uploaded Statement',
  docType,
  archiveItems = [],
  onLoadArchive,
  onDeleteArchive,
  onClearAllArchives
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
  const [isArchiveOpen, setIsArchiveOpen] = React.useState(false);

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
      
      // Blur input and active element to release focused states and clear stuck hover styles
      e.target.blur();
      if (document.activeElement) {
        document.activeElement.blur();
      }
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isProcessing) return;
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      onFileUpload(files[0]);
    }
  };

  return (
    <div className="w-full flex flex-col gap-1.5 mb-3">
      {/* File Upload Main Card Container */}
      <div 
        className={`independent-row-card uploader-card select-none relative overflow-hidden ${isProcessing ? 'processing pointer-events-none cursor-wait' : ''}`}
        onDragOver={handleDrag}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
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
            transition: 'opacity 0.3s ease-in-out',
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

                <button
                  type="button"
                  onClick={() => setIsArchiveOpen(!isArchiveOpen)}
                  className={`icon-copy-btn shrink-0 cursor-pointer ${isArchiveOpen ? 'archive-active' : ''}`}
                  title="Toggle Archive"
                >
                  <Archive size={14} />
                </button>
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

              <div className="flex items-center gap-2 shrink-0">
                <label
                  htmlFor={inputId}
                  className="upload-plus-btn shrink-0 cursor-pointer"
                  title="Choose file"
                >
                  +
                </label>

                <button
                  type="button"
                  onClick={() => setIsArchiveOpen(!isArchiveOpen)}
                  className={`icon-copy-btn shrink-0 cursor-pointer ${isArchiveOpen ? 'archive-active' : ''}`}
                  title="Toggle Archive"
                >
                  <Archive size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Archive Submenu Drawer */}
      <div className={`archive-panel ${isArchiveOpen ? 'open' : 'closed'}`}>
        <div className="flex items-center justify-between mb-4">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
            Archived Documents ({archiveItems.length})
          </span>
          {archiveItems.length > 0 && (
            <div className="w-[38px] flex justify-center shrink-0 mr-[5px]">
              <button
                type="button"
                onClick={onClearAllArchives}
                className="text-[10px] font-extrabold text-red-500 hover:text-red-700 transition-colors uppercase tracking-wider cursor-pointer whitespace-nowrap"
              >
                Clear All
              </button>
            </div>
          )}
        </div>

        <div className="archive-list pr-1 flex flex-col gap-0">
          {archiveItems.length === 0 ? (
            <div className="text-slate-400 text-xs py-4 text-center font-medium italic">
              No archived documents yet.
            </div>
          ) : (
            archiveItems.map((item) => (
              <div 
                key={item.id} 
                className="flex items-center justify-between py-0.5"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <FileText size={14} className="text-slate-400 shrink-0" />
                  <div className="font-bold text-xs sm:text-sm text-slate-700 truncate" title={item.name}>
                    {item.name}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0 ml-3">
                  <button
                    type="button"
                    onClick={() => onLoadArchive(item)}
                    className="icon-copy-btn cursor-pointer w-[17px] h-[17px]"
                    title="Load document"
                  >
                    <Upload size={10} />
                  </button>

                  <button
                    type="button"
                    onClick={() => onDeleteArchive(item.id)}
                    className="icon-clear-btn cursor-pointer w-[17px] h-[17px]"
                    title="Delete from archive"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
