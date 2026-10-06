import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ClipboardPaste, Copy, ImageUp } from 'lucide-react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { copyImageBlob, copyText, downloadBlob, isImageFile, shortName, useDoneFlags, usePastedFiles } from '../utils';
import { loadImage } from '../imageConvert';
import { MOTION_MS, flashOutline } from '../motion';
import { useToast } from '../toastContext';
import TabSwitcher from './TabSwitcher';
import TabPanes from './TabPanes';
import AutoHeight from './AutoHeight';
import Collapse from './Collapse';
import FadeText from './FadeText';
import FlipRow from './FlipRow';
import SlideText from './SlideText';
import usePop from './usePop';
import BoxRow from './BoxRow';
import useHistory, { useUndoKeys } from '../useHistory';

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

const QR_PX = 1024; // size of the saved / copied PNG
// On screen: 4px a square, scaled up crisp (image-rendering: pixelated).
// Drawn at 1024px on every letter typed, it took most of a frame as the
// buttons slid in; the full size is made only to save or copy
const QR_SCREEN_SCALE = 4;
const qrOptions = (level) => ({ errorCorrectionLevel: level, margin: 2, color: { dark: '#000000', light: '#ffffff' } });

// Reads a QR code from an image or video frame. Big images are scanned at
// a smaller size first (much faster), then at full size if nothing's found,
// light-on-dark codes too. A camera frame gets one quick look instead (the
// next frame is 200ms away; the full scan of each froze the page for seconds).
function decodeFrom(source, w, h, { sizes = [1024, 2048], invert = 'attemptBoth', canvas = document.createElement('canvas') } = {}) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  for (const max of sizes) {
    const s = Math.min(1, max / Math.max(w, h));
    canvas.width = Math.max(1, Math.round(w * s));
    canvas.height = Math.max(1, Math.round(h * s));
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const found = jsQR(data.data, canvas.width, canvas.height, { inversionAttempts: invert });
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

function MakeQr({ active }) {
  // Undo / redo, as in every tab: typing is a step per burst
  const [text, setText, history] = useHistory('');
  useUndoKeys(active, history, { inFields: true });
  const [level, setLevel] = useState('M');
  const [error, setError] = useState('');
  const [done, flagDone] = useDoneFlags();
  const canvasRef = useRef(null);
  const toast = useToast();
  const hasCode = !!text && !error;
  // The code pops in and out like the cards; edits redraw it in place
  usePop(canvasRef, hasCode);

  useEffect(() => {
    if (!text) {
      setError('');
      return;
    }
    let cancelled = false;
    QRCode.toCanvas(canvasRef.current, text, { ...qrOptions(level), scale: QR_SCREEN_SCALE })
      .then(() => {
        if (cancelled) return;
        setError('');
      })
      .catch(() => {
        if (cancelled) return;
        setError('too long for a QR code — shorten it or pick a lower level');
      });
    return () => { cancelled = true; };
  }, [text, level]);

  const textRef = useRef(null);
  const paste = async (e) => {
    if (e.detail) e.currentTarget.blur();
    try {
      const clip = await navigator.clipboard.readText();
      if (clip) {
        setText(clip);
        flagDone('paste');
      }
    } catch {
      textRef.current?.focus();
      toast('paste with ctrl+v or a long-press in the box');
    }
  };

  // The full-size PNG, drawn fresh (the one on screen is small)
  const pngBlob = async () => {
    const canvas = document.createElement('canvas');
    await QRCode.toCanvas(canvas, text, { ...qrOptions(level), width: QR_PX });
    try {
      return await new Promise((resolve, reject) => {
        canvas.toBlob(b => (b ? resolve(b) : reject(new Error('no image'))), 'image/png');
      });
    } finally {
      canvas.width = canvas.height = 0;
    }
  };

  const downloadPng = async (e) => {
    if (e.detail) e.currentTarget.blur();
    downloadBlob(await pngBlob(), 'qr-code.png');
    flagDone('png');
  };

  const downloadSvg = async (e) => {
    if (e.detail) e.currentTarget.blur();
    const svg = await QRCode.toString(text, { ...qrOptions(level), type: 'svg' });
    downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), 'qr-code.svg');
    flagDone('svg');
  };

  const copy = async (e) => {
    if (e.detail) e.currentTarget.blur();
    if (await copyImageBlob(pngBlob())) {
      flagDone('copy');
      toast('QR code copied');
    } else {
      toast("this browser can't copy images — save it instead", { warn: true });
    }
  };

  return (
    <div className="tool">
      <textarea
        ref={textRef}
        className="tool-textarea short qr-text"
        value={text}
        onChange={(e) => setText(e.target.value, 'type')}
        placeholder="text or a link"
        spellCheck={false}
        aria-label="Text for the QR code"
      />
      {/* Undo · redo | clear */}
      <BoxRow
        empty={!text}
        history={history}
        onTrash={() => history.reset('')}
        trashDisabled={!text}
        held={!!text}
        actions={(
          <button className={`btn btn-icon btn-grow ${done.paste ? 'btn-done' : ''}`} onClick={paste} title="Paste from clipboard" aria-label="Paste from clipboard">
            <ClipboardPaste size={14} />
            {/* (its word with it while the box is empty; shut to the icon once
                there's something: the word slide) */}
            <SlideText show={!text}><span className="btn-grow-word">paste</span></SlideText>
          </button>
        )}
      />
      {/* The error level: a setting, so in the options panel (as the image
          converter's), opening once there's text */}
      <Collapse open={!!text} className="options-collapse">
        <div className="options-panel">
          <FlipRow className="field-grid">
            <TabSwitcher className="tab-switcher-sm" tabs={LEVELS} active={level} onChange={setLevel} />
          </FlipRow>
        </div>
      </Collapse>
      <AutoHeight className="tool-meta" >
        <FadeText k={error ? 'error' : text ? 'level' : 'empty'}>
        {error || (text ? 'higher levels still scan when part of the code is covered or damaged' : 'the code updates as you type')}
      </FadeText>
      </AutoHeight>
      <AutoHeight className="tool-box qr-box-outer" innerClassName={`qr-box ${hasCode ? '' : 'qr-box-empty'}`}>
        <canvas ref={canvasRef} className="qr-canvas" aria-label="QR code" />
        <FadeText k={hasCode ? '' : 'hint'} className="tool-hint">{hasCode ? null : 'your QR code shows here'}</FadeText>
      </AutoHeight>
      {/* Copy and the saves: there once there's a code (the panel open) */}
      <Collapse open={hasCode}>
        {/* The action (copy, an icon), then the saves on their own row */}
        <div className="button-rows">
          <FlipRow>
            <button className={`btn btn-icon ${done.copy ? 'btn-done' : ''}`} onClick={copy} disabled={!hasCode} title="Copy the QR code" aria-label="Copy the QR code">
              <Copy size={14} />
            </button>
          </FlipRow>
          <FlipRow>
            <button className={`btn ${done.png ? 'btn-done' : ''}`} onClick={downloadPng} disabled={!hasCode}>
              save PNG
            </button>
            <button className={`btn ${done.svg ? 'btn-done' : ''}`} onClick={downloadSvg} disabled={!hasCode}>
              save SVG
            </button>
          </FlipRow>
        </div>
      </Collapse>
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
  // The camera's picture pops in and out like the cards
  usePop(videoRef, camera);

  // Stopping: the picture holds its last frame while it pops out (the
  // tracks stopped at once, it went blank and seemed to snap away before
  // the box eased shut); the camera itself goes off once it's gone
  const ending = useRef(null); // { stream, timer }
  const endNow = useCallback(() => {
    const end = ending.current;
    if (!end) return;
    ending.current = null;
    clearTimeout(end.timer);
    end.stream.getTracks().forEach(t => t.stop());
    const video = videoRef.current;
    if (video && video.srcObject === end.stream) video.srcObject = null;
  }, []);
  const stopCamera = useCallback((now = false) => {
    const stream = streamRef.current;
    streamRef.current = null;
    setCamera(false);
    if (!stream) return;
    endNow();
    videoRef.current?.pause();
    ending.current = { stream, timer: setTimeout(endNow, MOTION_MS + 100) };
    if (now === true) endNow();
  }, [endNow]);

  const show = (text) => {
    const next = text ? { text } : { none: true };
    setResult(next);
    setLastResult(next);
    // Opening, the panel opens with it; a new result in an open one swaps
    // its words (the text swap) — and a found code gets the outline flash
    requestAnimationFrame(() => {
      if (text) flashOutline(resultRef.current);
    });
  };

  const scanFiles = useCallback(async (files) => {
    const file = [...files].find(isImageFile);
    if (!file) return;
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      // A picture given while the camera's on: the camera goes (still
      // scanning, it wrote over what the picture showed)
      if (streamRef.current) stopCamera();
      show(decodeFrom(img, img.naturalWidth, img.naturalHeight));
    } catch {
      toast(`couldn't open ${shortName(file.name) || 'that image'}`, { warn: true });
    } finally {
      URL.revokeObjectURL(url);
    }
  }, [toast, stopCamera]);

  usePastedFiles(active, isImageFile, scanFiles);

  const asking = useRef(false);
  const activeRef = useRef(active);
  activeRef.current = active;
  const startCamera = async (e) => {
    if (e.detail) e.currentTarget.blur();
    if (!navigator.mediaDevices?.getUserMedia) {
      toast('no camera access in this browser', { warn: true });
      return;
    }
    // One ask at a time; a camera that arrives after the tab was left (or
    // after a second tap) is turned straight off, not left running unseen
    if (asking.current) return;
    asking.current = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      if (!activeRef.current || streamRef.current) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }
      // (one still popping out goes off now: the picture is the new one's)
      endNow();
      streamRef.current = stream;
      // Shown only once the picture's size is known: shown first, the video
      // took a placeholder size, then jumped to the camera's mid-pop, and the
      // box eased to the wrong height, snapped and eased again. Its exact
      // shape is set too, so nothing measures it again.
      const video = videoRef.current;
      video.srcObject = stream;
      await new Promise((resolve) => {
        if (video.videoWidth) { resolve(); return; }
        video.addEventListener('loadedmetadata', resolve, { once: true });
        setTimeout(resolve, 1500);
      });
      if (streamRef.current !== stream) return; // stopped meanwhile
      if (video.videoWidth && video.videoHeight) video.style.aspectRatio = `${video.videoWidth} / ${video.videoHeight}`;
      video.play().catch(() => {});
      setResult(null);
      setCamera(true);
    } catch {
      toast('camera not allowed', { warn: true });
    } finally {
      asking.current = false;
    }
  };

  // While the camera's on: look for a code a few times a second
  useEffect(() => {
    if (!camera) return;
    const video = videoRef.current;
    if (video.srcObject !== streamRef.current) {
      video.srcObject = streamRef.current;
      video.play().catch(() => {});
    }
    let stopped = false;
    const frame = document.createElement('canvas');
    // Not while the camera's picture pops in and its box grows: each look
    // is heavy work, and it made that motion stutter
    const from = performance.now() + MOTION_MS + 50;
    const timer = setInterval(() => {
      if (stopped || performance.now() < from || video.readyState < 2 || !video.videoWidth) return;
      const text = decodeFrom(video, video.videoWidth, video.videoHeight, { sizes: [640], invert: 'dontInvert', canvas: frame });
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
  useEffect(() => () => stopCamera(true), [stopCamera]);

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
        <video ref={videoRef} className="qr-video drop-preview" playsInline muted />
        <FadeText k={camera ? '' : 'hint'} className="tool-hint">{camera ? null : 'drop, paste or click to scan an image'}</FadeText>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => { scanFiles(e.target.files || []); e.target.value = ''; }}
        />
      </AutoHeight>

      <FlipRow>
        <button className="btn btn-icon" onClick={(e) => { if (e.detail) e.currentTarget.blur(); inputRef.current?.click(); }} title="Choose an image" aria-label="Choose an image">
          <ImageUp size={14} />
        </button>
        {/* One button: its words swap (text swap) and it eases to its new width */}
        <button
          className="btn"
          onClick={(e) => {
            if (camera) { if (e.detail) e.currentTarget.blur(); stopCamera(); }
            else startCamera(e);
          }}
        >
          <FadeText k={camera ? 'stop' : 'use'} className="btn-label">{camera ? 'stop camera' : 'use camera'}</FadeText>
        </button>
      </FlipRow>

      {/* Grows in from nothing; keeps showing the last result while it closes */}
      <Collapse open={!!result} className="qr-result-collapse">
        <AutoHeight boxRef={resultRef} className="tool-box qr-result-box" innerClassName="qr-result">
          {!shown ? null : shown.none ? (
            <FadeText as="p" k="none" className="tool-hint">no QR code found — try a sharper or closer picture</FadeText>
          ) : (
            <>
              <FadeText as="p" k={shown.text} className="qr-result-text selectable">{shown.text}</FadeText>
              <FlipRow>
                <button
                  className={`btn btn-icon ${done.copy ? 'btn-done' : ''}`}
                  title="Copy the text"
                  aria-label="Copy the text"
                  onClick={async (e) => {
                    if (e.detail) e.currentTarget.blur();
                    if (await copyText(shown.text)) flagDone('copy');
                    else toast("couldn't copy — select the text and copy it", { warn: true });
                  }}
                >
                  <Copy size={14} />
                </button>
                {link && (
                  <a className="btn" href={link} target="_blank" rel="noopener noreferrer">
                    open link
                  </a>
                )}
              </FlipRow>
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
          <MakeQr active={active && mode === 'make'} />
          <ScanQr active={active && mode === 'scan'} />
        </TabPanes>
      </div>
    </div>
  );
}
