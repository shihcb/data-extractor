import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { ImageUp } from 'lucide-react';

const FORMATS = [
  { key: 'png',  label: 'PNG',  mime: 'image/png' },
  { key: 'jpg',  label: 'JPG',  mime: 'image/jpeg' },
  { key: 'webp', label: 'WEBP', mime: 'image/webp' },
  { key: 'pdf',  label: 'PDF',  mime: 'application/pdf' },
];

// Box padding (matches .image-converter-drop) and the smallest it shrinks to
const PAD_X = 24;
const PAD_Y = 18;
const MIN_IMAGE_BOX = 200;

const loadImage = (url) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.src = url;
});

// Same as the case converter's text box: max(320px, 60vh)
const emptyBoxHeight = () => Math.max(320, window.innerHeight * 0.6);

// A one-page PDF holding a JPEG, written by hand (no library needed).
// The page is the image's size at 96 dpi.
function jpegToPdf(jpeg, width, height) {
  const enc = new TextEncoder();
  const w = +(width * 0.75).toFixed(2);
  const h = +(height * 0.75).toFixed(2);
  const content = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>`,
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    null, // the image, written below with its binary data
  ];

  const parts = [];
  const offsets = [];
  let length = 0;
  const push = (chunk) => {
    const bytes = typeof chunk === 'string' ? enc.encode(chunk) : chunk;
    parts.push(bytes);
    length += bytes.length;
  };

  push('%PDF-1.4\n');
  objects.forEach((body, i) => {
    offsets.push(length);
    if (body === null) {
      push(`${i + 1} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
      push(jpeg);
      push('\nendstream\nendobj\n');
    } else {
      push(`${i + 1} 0 obj\n${body}\nendobj\n`);
    }
  });

  const xref = length;
  push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
  offsets.forEach(o => push(`${String(o).padStart(10, '0')} 00000 n \n`));
  push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  return new Blob(parts, { type: 'application/pdf' });
}

export default function ImageConverter({ active }) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [imageSize, setImageSize] = useState(null);
  const [boxHeight, setBoxHeight] = useState(emptyBoxHeight);
  const [dragging, setDragging] = useState(false);
  const [doneFormat, setDoneFormat] = useState('');
  const inputRef = useRef(null);
  const boxRef = useRef(null);

  const takeFile = async (f) => {
    if (!f || !f.type.startsWith('image/')) return;
    const url = URL.createObjectURL(f);
    try {
      const img = await loadImage(url);
      setImageSize({ w: img.naturalWidth, h: img.naturalHeight });
    } catch {
      URL.revokeObjectURL(url);
      return;
    }
    setFile(f);
    setPreviewUrl(url);
  };

  // The box fits the image's shape (up to the empty box's height), and
  // animates there via the height transition in index.css.
  useLayoutEffect(() => {
    const fit = () => {
      const maxH = emptyBoxHeight();
      if (!imageSize || !boxRef.current) {
        setBoxHeight(maxH);
        return;
      }
      const innerW = boxRef.current.clientWidth - PAD_X * 2;
      const fitted = innerW * (imageSize.h / imageSize.w) + PAD_Y * 2;
      setBoxHeight(Math.round(Math.min(maxH, Math.max(MIN_IMAGE_BOX, fitted))));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [imageSize]);

  // Paste an image anywhere on the page while this tab is open
  useEffect(() => {
    if (!active) return;
    const onPaste = (e) => {
      const item = [...(e.clipboardData?.files || [])].find(f => f.type.startsWith('image/'));
      if (item) {
        e.preventDefault();
        takeFile(item);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [active]);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const handleConvert = async (e, format) => {
    e.currentTarget.blur();
    if (!previewUrl) return;
    const img = await loadImage(previewUrl);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (format.key === 'jpg' || format.key === 'pdf') {
      // No transparency in JPG (or the JPEG inside the PDF): use white, not black
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(img, 0, 0);

    const toBlob = (mime) => new Promise(resolve => canvas.toBlob(resolve, mime, 0.92));
    let blob;
    if (format.key === 'pdf') {
      const jpeg = await toBlob('image/jpeg');
      if (!jpeg) return;
      blob = jpegToPdf(new Uint8Array(await jpeg.arrayBuffer()), canvas.width, canvas.height);
    } else {
      blob = await toBlob(format.mime);
    }
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
        ref={boxRef}
        className={`image-converter-drop ${dragging ? 'dragging' : ''}`}
        style={{ height: `${boxHeight}px` }}
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
          <img key={previewUrl} src={previewUrl} alt={file?.name || 'preview'} className="image-converter-preview" />
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
          className="case-btn case-btn-icon-only"
          onClick={(e) => { e.currentTarget.blur(); inputRef.current?.click(); }}
          title="Choose an image"
        >
          <ImageUp size={14} />
        </button>
        {FORMATS.map(format => (
          <button
            key={format.key}
            className={`case-btn ${doneFormat === format.key ? 'case-btn-copied' : ''}`}
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
