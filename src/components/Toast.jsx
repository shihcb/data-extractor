import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ToastContext } from '../toastContext';

// A small message at the bottom of the screen, as instagram-follower-checker
// does it: one toast that comes in from 14px down at 95% scale, stays 5
// seconds, and leaves the same way. A new message while it's up just
// changes the words (and restarts the 5 seconds).
const SHOW_MS = 5000;

export function ToastProvider({ children }) {
  const [toast, setToast] = useState({ text: '', warn: false });
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef(null);
  const showFrame = useRef(null);

  const show = useCallback((text, { warn = false } = {}) => {
    clearTimeout(hideTimer.current);
    cancelAnimationFrame(showFrame.current);
    setToast({ text, warn });
    // Its hidden state is drawn first, then it's shown: showing it in the
    // same frame lets Safari skip straight to the end
    showFrame.current = requestAnimationFrame(() => {
      showFrame.current = requestAnimationFrame(() => setVisible(true));
    });
    hideTimer.current = setTimeout(() => setVisible(false), SHOW_MS);
  }, []);

  useEffect(() => () => {
    clearTimeout(hideTimer.current);
    cancelAnimationFrame(showFrame.current);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className={`feature-toast ${toast.warn ? 'warn' : ''} ${visible ? 'show' : ''}`}
        aria-hidden={!visible}
      >
        <span className="feature-toast-text">{toast.text}</span>
      </div>
    </ToastContext.Provider>
  );
}
