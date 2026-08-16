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
  const [isArchiveOpen, setIsArchiveOpen] = React.useState(() => {
    return localStorage.getItem('extrkt_archive_open') === 'true';
  });
  const [isClearingAll, setIsClearingAll] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState(null);
  // visibleIds: IDs that have completed their fade-in and are at opacity 1.
  // New items are NOT in this set on first render → start at opacity 0.
  const [visibleIds, setVisibleIds] = React.useState(
    () => new Set(archiveItems.map(i => i.id))
  );
  // Animated height for the archive panel inner content
  const contentRef = React.useRef(null);
  const [panelHeight, setPanelHeight] = React.useState(null);

  React.useEffect(() => {
    localStorage.setItem('extrkt_archive_open', isArchiveOpen);
  }, [isArchiveOpen]);

  // ResizeObserver: measure the inner content and animate the panel height
  React.useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setPanelHeight(entry.contentRect.height);
      }
    });
    ro.observe(el);
    // Set initial height immediately
    setPanelHeight(el.getBoundingClientRect().height);
    return () => ro.disconnect();
  }, []);

  // Compute new IDs during render (not in effect) so the first paint is at opacity 0
  const currentIds = archiveItems.map(i => i.id);
  const newIds = currentIds.filter(id => !visibleIds.has(id));
  const newIdsKey = newIds.join(',');

  // useLayoutEffect fires before browser paint → schedules rAF to flip visible
  // This guarantees: paint1=opacity0, paint2=opacity1 (real CSS transition)
  React.useLayoutEffect(() => {
    if (!newIdsKey) return;
    const ids = newIdsKey.split(',').filter(Boolean);
    const raf = requestAnimationFrame(() => {
      setVisibleIds(prev => {
        const next = new Set(prev);
        ids.forEach(id => next.add(id));
        return next;
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [newIdsKey]);

  // Clean up removed IDs from visibleIds after deletion
  React.useEffect(() => {
    const currentIdSet = new Set(archiveItems.map(i => i.id));
    setVisibleIds(prev => {
      let changed = false;
      const next = new Set(prev);
      for (const id of prev) {
        if (!currentIdSet.has(id)) { next.delete(id); changed = true; }
      }
      return changed ? next : prev;
    });
  }, [archiveItems]);

  const handleDeleteWithFade = (id) => {
    setDeletingId(id);
    setTimeout(() => {
      onDeleteArchive(id);
      setDeletingId(null);
    }, 480);
  };

  const handleClearWithFade = () => {
    setIsClearingAll(true);
    setTimeout(() => {
      onClearAllArchives();
      setIsClearingAll(false);
    }, 480);
  };

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
      <div
        className={`archive-panel ${isArchiveOpen ? 'open' : 'closed'}`}
        style={isArchiveOpen
          ? { height: panelHeight !== null ? `${panelHeight}px` : 'auto' }
          : { height: '0px' }}
      >
        {/* Inner content wrapper — measured by ResizeObserver */}
        <div ref={contentRef} className="py-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex-1 min-w-0">
              Archived Documents ({archiveItems.length})
            </span>
            {archiveItems.length > 0 && (
              <div className="flex items-center gap-0.5 shrink-0 ml-3 w-[36px] justify-center pl-[11px]">
                <button
                  type="button"
                  onClick={handleClearWithFade}
                  className="text-[10px] font-extrabold text-red-500 uppercase tracking-wider cursor-pointer whitespace-nowrap"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          <div
            className="archive-list pr-1 flex flex-col gap-0"
            style={{ opacity: isClearingAll ? 0 : 1, transition: 'opacity 0.45s cubic-bezier(0.4, 0, 0.2, 1)' }}
          >
          {archiveItems.length > 0 && (
            archiveItems.map((item) => {
              const isVisible = visibleIds.has(item.id);
              const isDeleting = deletingId === item.id;
              return (
              <div
                key={item.id}
                className="flex items-center justify-between"
                style={{
                  maxHeight: isDeleting || !isVisible ? '0px' : '40px',
                  paddingTop: isDeleting || !isVisible ? '0px' : '2px',
                  paddingBottom: isDeleting || !isVisible ? '0px' : '2px',
                  opacity: isDeleting || !isVisible ? 0 : 1,
                  overflow: 'hidden',
                  transition: 'max-height 0.45s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.45s cubic-bezier(0.4, 0, 0.2, 1), padding 0.45s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <FileText size={14} className="text-slate-400 shrink-0" />
                  <div className="font-bold text-xs sm:text-sm text-slate-700 truncate" title={item.name}>
                    {item.name}
                  </div>
                </div>

                <div className="flex items-center gap-0.5 shrink-0 ml-3">
                  <button
                    type="button"
                    onClick={() => onLoadArchive(item)}
                    className="icon-copy-btn cursor-pointer w-[17px] h-[17px]"
                    title="Load document"
                  >
                    <Upload size={12} />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteWithFade(item.id)}
                    className="icon-clear-btn cursor-pointer w-[17px] h-[17px]"
                    title="Delete from archive"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
            })
          )}
        </div>  {/* archive-list */}
        </div>  {/* contentRef inner wrapper */}
      </div>  {/* archive-panel */}
    </div>
  );
}
