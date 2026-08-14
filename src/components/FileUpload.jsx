import React, { useId } from 'react';
import { Upload, FileText, RefreshCw } from 'lucide-react';

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

  // Track docType synchronously during render to skip transitions instantly
  const [prevDocType, setPrevDocType] = React.useState(docType);
  const [skipTransition, setSkipTransition] = React.useState(false);

  if (docType !== prevDocType) {
    setPrevDocType(docType);
    setSkipTransition(true);
  }

  React.useEffect(() => {
    if (skipTransition) {
      const timer = setTimeout(() => {
        setSkipTransition(false);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [skipTransition]);

  const handleChange = (e) => {
    if (isProcessing) return;
    if (e.target.files && e.target.files[0]) {
      onFileUpload(e.target.files[0]);
      e.target.value = '';
    }
  };

  const isHidden = isProcessing;

  // We keep a single root element and avoid unmounting it, 
  // which prevents triggering the fade-in animation again and stops flickering.
  return (
    <div 
      className={`independent-row-card uploader-card relative overflow-hidden ${isProcessing ? 'processing' : ''}`}
      onDoubleClick={fileName && !isProcessing ? onClear : undefined}
      title={fileName && !isProcessing ? "Double-click to remove file" : undefined}
      style={{
        maxHeight: isHidden ? '0px' : '100px',
        opacity: isHidden ? 0 : 1,
        paddingTop: isHidden ? '0px' : '10px',
        paddingBottom: isHidden ? '0px' : '10px',
        marginTop: isHidden ? '0px' : '0px',
        marginBottom: isHidden ? '0px' : '12px',
        borderWidth: isHidden ? '0px' : '1px',
        overflow: 'hidden',
        pointerEvents: isHidden ? 'none' : 'auto',
        transition: skipTransition ? 'none' : 'max-height 0.55s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.45s cubic-bezier(0.16, 1, 0.3, 1), padding 0.55s cubic-bezier(0.16, 1, 0.3, 1), margin-bottom 0.55s cubic-bezier(0.16, 1, 0.3, 1), border-width 0.55s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      <input
        id={inputId}
        type="file"
        accept="application/pdf,image/png,image/jpeg,image/webp,text/plain,text/csv"
        onChange={handleChange}
        className="hidden"
        disabled={isProcessing}
      />

      {/* Uploaded state content container */}
      <div 
        style={{
          position: fileName ? 'relative' : 'absolute',
          left: fileName ? 'auto' : '0px',
          right: fileName ? 'auto' : '0px',
          width: '100%',
          height: '38px',
          flexShrink: 0,
          opacity: fileName ? 1 : 0,
          transform: fileName ? 'translate3d(0, 0, 0)' : 'translate3d(0, 4px, 0)',
          transition: skipTransition ? 'none' : 'opacity 0.3s ease-in-out, transform 0.3s ease-in-out',
          pointerEvents: fileName ? 'auto' : 'none',
        }}
        className="flex items-center justify-between"
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

      {/* Empty state content container */}
      <div 
        style={{
          position: !fileName ? 'relative' : 'absolute',
          left: !fileName ? 'auto' : '0px',
          right: !fileName ? 'auto' : '0px',
          width: '100%',
          height: '38px',
          flexShrink: 0,
          opacity: !fileName ? 1 : 0,
          transform: !fileName ? 'translate3d(0, 0, 0)' : 'translate3d(0, -4px, 0)',
          transition: skipTransition ? 'none' : 'opacity 0.3s ease-in-out, transform 0.3s ease-in-out',
          pointerEvents: !fileName ? 'auto' : 'none',
        }}
        className="flex items-center justify-between"
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
