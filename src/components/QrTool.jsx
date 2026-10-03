import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Copy, Download, ExternalLink, ImageUp } from 'lucide-react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { copyImageBlob, copyText, downloadBlob, isImageFile, useDoneFlags, usePastedFiles } from '../utils';
import { loadImage } from '../imageConvert';
import { fadeIn, flashOutline } from '../motion';
import { useToast } from '../toastContext';
import TabSwitcher from './TabSwitcher';
import TabPanes from './TabPanes';
import AutoHeight from './AutoHeight';
import Collapse from './Collapse';
import FadeText from './FadeText';

const MODES = [
  { key: 'make', label: 'make' },
  { key: 'scan', label: 'scan' },
];

const LEVELS = [
  { key: 'L', label: 'low' },
  { key: 'M', label: 'medium' },
  { key: 'Q', label: 'high' },
  { key: 'H', label: 'highest' },
];

const QR_PX = 1024; // size of the downloaded PNG
const qrOptions = (level) => ({ errorCorrectionLevel: level, margin: 2, color: { dark: '#000000', light: '#ffffff' } });

// Reads a QR code from an image or video frame. Big images are scanned at
// a smaller size first (much faster), then at full size if nothing's found.
function decodeFrom(source, w, h) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  for (const max of [1024, 2048]) {
    const s = Math.min(1, max / Math.max(w, h));
    canvas.width = Math.max(1, Math.round(w * s));
    canvas.height = Math.max(1, Math.round(h * s));
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const found = jsQR(data.data, canvas.width, canvas.height, { inversionAttempts: 'attemptBoth' });
    if (found) return found.data;
    if (s === 1) break;
  }
  return null;
}

// Only web links get an "open" button
const asWebLink = (text) => {
  try {
    const url = new URL(text.trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
};

function MakeQr() {
  const [text, setText] = useState('');
  const [level, setLevel] = useState('M');
  const [error, setError] = useState('');
  const [done, flagDone] = useDoneFlags();
  const canvasRef = useRef(null);
  const hadCode = useRef(false);
  const toast = useToast();
  const hasCode = !!text && !error;

  useEffect(() => {
    if (!text) {
      setError('');
      hadCode.current = false;
      return;
    }
    let cancelled = false;
    QRCode.toCanvas(canvasRef.current, text, { ...qrOptions(level), width: QR_PX })
      .then(() => {
        if (cancelled) return;
        setError('');
        // The first code fades in; later edits redraw in place
        if (!hadCode.current) fadeIn(canvasRef.current);
        hadCode.current = true;
      })
      .catch(() => {
        if (cancelled) return;
        setError('too long for a QR code — shorten it or pick a lower level');
        hadCode.current = false;
      });
    return () => { cancelled = true; };
  }, [text, level]);

  const pngBlob = () => new Promise((resolve, reject) => {
    canvasRef.current.toBlob(b => (b ? resolve(b) : reject(new Error('no image'))), 'image/png');
  });

  const downloadPng = async (e) => {
    e.currentTarget.blur();
    downloadBlob(await pngBlob(), 'qr-code.png');
    flagDone('png');
  };

  const downloadSvg = async (e) => {
    e.currentTarget.blur();
    const svg = await QRCode.toString(text, { ...qrOptions(level), type: 'svg' });
    downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), 'qr-code.svg');
    flagDone('svg');
  };

  const copy = async (e) => {
    e.currentTarget.blur();
    if (await copyImageBlob(pngBlob())) {
      flagDone('copy');
      toast('QR code copied');
    } else {
      toast("this browser can't copy images — download it instead", { warn: true });
    }
  };

  return (
    <div className="tool">
      <textarea
        className="tool-textarea short"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="text or a link"
        spellCheck={false}
        aria-label="Text for the QR code"
      />
      <div className="tool-actions">
        <TabSwitcher className="tab-switcher-sm" tabs={LEVELS} active={level} onChange={setLevel} />
      </div>
      <AutoHeight className="tool-meta" >
        <FadeText k={error ? 'error' : text ? 'level' : 'empty'}>
        {error || (text ? 'higher levels still scan when part of the code is covered or damaged' : 'the code updates as you type')}
      </FadeText>
      </AutoHeight>
      <AutoHeight className="tool-box qr-box-outer" innerClassName={`qr-box ${hasCode ? '' : 'qr-box-empty'}`}>
        <canvas ref={canvasRef} className="qr-canvas" style={{ display: hasCode ? undefined : 'none' }} aria-label="QR code" />
        <FadeText k={hasCode ? '' : 'hint'} className="tool-hint">{hasCode ? null : 'your QR code shows here'}</FadeText>
      </AutoHeight>
      <div className="tool-actions">
        <button className={`btn btn-primary ${done.png ? 'btn-done' : ''}`} onClick={downloadPng} disabled={!hasCode}>
          <Download size={14} /> PNG
        </button>
        <button className={`btn ${done.svg ? 'btn-done' : ''}`} onClick={downloadSvg} disabled={!hasCode}>
          <Download size={14} /> SVG
        </button>
        <button className={`btn ${done.copy ? 'btn-done' : ''}`} onClick={copy} disabled={!hasCode}>
          <Copy size={14} /> copy
        </button>
      </div>
    </div>
  );
}

function ScanQr({ active }) {
  const [result, setResult] = useState(null); // { text } | { none: true }
  const [lastResult, setLastResult] = useState(null);
  const [camera, setCamera] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [done, flagDone] = useDoneFlags();
  const inputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const resultRef = useRef(null);
  const toast = useToast();

  const show = (text) => {
    const wasOpen = !!resultRef.current?.closest('.motion-collapse')?.offsetHeight;
    const next = text ? { text } : { none: true };
    setResult(next);
    setLastResult(next);
    requestAnimationFrame(() => {
      // Opening, the panel's own fade shows it; a new result in an open one fades in
      if (wasOpen) fadeIn(resultRef.current);
      if (text) flashOutline(resultRef.current);
    });
  };

  const scanFiles = useCallback(async (files) => {
    const file = [...files].find(isImageFile);
    if (!file) return;
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      show(decodeFrom(img, img.naturalWidth, img.naturalHeight));
    } catch {
      toast(`couldn't open ${file.name || 'that image'}`, { warn: true });
    } finally {
      URL.revokeObjectURL(url);
    }
  }, [toast]);

  usePastedFiles(active, isImageFile, scanFiles);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCamera(false);
  }, []);

  const startCamera = async (e) => {
    e.currentTarget.blur();
    if (!navigator.mediaDevices?.getUserMedia) {
      toast('no camera access in this browser', { warn: true });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      streamRef.current = stream;
      setResult(null);
      setCamera(true);
    } catch {
      toast('camera not allowed', { warn: true });
    }
  };

  // While the camera's on: look for a code a few times a second
  useEffect(() => {
    if (!camera) return;
    const video = videoRef.current;
    video.srcObject = streamRef.current;
    video.play().catch(() => {});
    let stopped = false;
    const timer = setInterval(() => {
      if (stopped || video.readyState < 2 || !video.videoWidth) return;
      const text = decodeFrom(video, video.videoWidth, video.videoHeight);
      if (text) {
        stopped = true;
        stopCamera();
        show(text);
      }
    }, 200);
    return () => { stopped = true; clearInterval(timer); };
  }, [camera, stopCamera]);

  // The camera goes off when you leave the tab (and when the app closes)
  useEffect(() => { if (!active) stopCamera(); }, [active, stopCamera]);
  useEffect(() => stopCamera, [stopCamera]);

  // What the result box shows (the last result, while it closes)
  const shown = result || lastResult;
  const link = shown?.text ? asWebLink(shown.text) : null;

  return (
    <div className="tool">
      <AutoHeight
        className={`tool-box qr-scan-outer ${dragging ? 'dragging' : ''}`}
        innerClassName="drop-box qr-scan-box"
        onClick={() => { if (!camera) inputRef.current?.click(); }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false); }}
        onDrop={(e) => { e.preventDefault(); setDragging(false); scanFiles(e.dataTransfer?.files || []); }}
        role="button"
        tabIndex={0}
        aria-label="Choose an image with a QR code"
        onKeyDown={(e) => { if (!camera && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); inputRef.current?.click(); } }}
      >
        {camera && <video ref={videoRef} className="qr-video drop-preview" playsInline muted />}
        <FadeText k={camera ? '' : 'hint'} className="tool-hint">{camera ? null : 'drop, paste or click to scan an image'}</FadeText>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => { scanFiles(e.target.files || []); e.target.value = ''; }}
        />
      </AutoHeight>

      <div className="tool-actions">
        <button className="btn btn-icon" onClick={(e) => { e.currentTarget.blur(); inputRef.current?.click(); }} title="Choose an image" aria-label="Choose an image">
          <ImageUp size={14} />
        </button>
        {camera ? (
          <button className="btn" onClick={(e) => { e.currentTarget.blur(); stopCamera(); }}>stop camera</button>
        ) : (
          <button className="btn" onClick={startCamera}><Camera size={14} /> use camera</button>
        )}
      </div>

      {/* Grows in from nothing; keeps showing the last result while it closes */}
      <Collapse open={!!result} className="qr-result-collapse">
        <AutoHeight boxRef={resultRef} className="tool-box qr-result-box" innerClassName="qr-result">
          {!shown ? null : shown.none ? (
            <FadeText as="p" k="none" className="tool-hint">no QR code found — try a sharper or closer picture</FadeText>
          ) : (
            <>
              <FadeText as="p" k={shown.text} className="qr-result-text selectable">{shown.text}</FadeText>
              <div className="tool-actions">
                <button
                  className={`btn ${done.copy ? 'btn-done' : ''}`}
                  onClick={async (e) => {
                    e.currentTarget.blur();
                    if (await copyText(shown.text)) flagDone('copy');
                    else toast("couldn't copy — select the text and copy it", { warn: true });
                  }}
                >
                  <Copy size={14} /> copy
                </button>
                {link && (
                  <a className="btn" href={link} target="_blank" rel="noopener noreferrer">
                    <ExternalLink size={14} /> open link
                  </a>
                )}
              </div>
            </>
          )}
        </AutoHeight>
      </Collapse>
    </div>
  );
}

export default function QrTool({ active }) {
  const [mode, setMode] = useState('make');
  return (
    <div className="tool">
      <TabSwitcher className="tab-switcher-sm" tabs={MODES} active={mode} onChange={setMode} />
      <div className="qr-panes">
        <TabPanes tabs={MODES} active={mode}>
          <MakeQr />
          <ScanQr active={active && mode === 'scan'} />
        </TabPanes>
      </div>
    </div>
  );
}
