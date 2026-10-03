import React, { useState, useRef, useEffect } from 'react';
import { ImageUp } from 'lucide-react';

const FORMATS = [
  { key: 'png',  label: 'PNG',  mime: 'image/png' },
  { key: 'jpg',  label: 'JPG',  mime: 'image/jpeg' },
  { key: 'webp', label: 'WEBP', mime: 'image/webp' },
];

const loadImage = (url) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.src = url;
});

export default function ImageConverter() {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [dragging, setDragging] = useState(false);
  const [doneFormat, setDoneFormat] = useState('');
  const inputRef = useRef(null);

  const takeFile = (f) => {
    if (!f || !f.type.startsWith('image/')) return;
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  };

  // Paste an image anywhere on the page while this tab is open
  useEffect(() => {
    const onPaste = (e) => {
      const item = [...(e.clipboardData?.files || [])].find(f => f.type.startsWith('image/'));
      if (item) {
        e.preventDefault();
        takeFile(item);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const handleConvert = async (e, format) => {
    e.currentTarget.blur();
    if (!previewUrl) return;
    const img = await loadImage(previewUrl);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (format.key === 'jpg') {
      // JPG has no transparency: put it on white instead of black
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(img, 0, 0);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, format.mime, 0.92));
    if (!blob) return;

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'image';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${baseName}.${format.key}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    setDoneFormat(format.key);
    setTimeout(() => setDoneFormat(''), 1800);
  };

  return (
    <div className="case-converter-wrapper">
      <div
        className={`image-converter-drop ${dragging ? 'dragging' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          takeFile(e.dataTransfer?.files?.[0]);
        }}
      >
        {previewUrl ? (
          <img src={previewUrl} alt={file?.name || 'preview'} className="image-converter-preview" />
        ) : (
          <span className="image-converter-hint">drop, paste or click to add an image</span>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => { takeFile(e.target.files?.[0]); e.target.value = ''; }}
        />
      </div>
      <div className="case-converter-actions">
        <button
          className="case-btn case-btn-paste case-btn-icon-only"
          onClick={(e) => { e.currentTarget.blur(); inputRef.current?.click(); }}
          title="Choose an image"
        >
          <ImageUp size={14} />
        </button>
        {FORMATS.map(format => (
          <button
            key={format.key}
            className={`case-btn case-btn-upper ${doneFormat === format.key ? 'case-btn-copied' : ''}`}
            onClick={(e) => handleConvert(e, format)}
            disabled={!file}
          >
            {format.label}
          </button>
        ))}
      </div>
    </div>
  );
}
