import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MOTION_MS } from '../motion';
import { ToastContext } from '../toastContext';

// A small message at the bottom of the screen (the source repo's
// feature-toast): comes in from 14px down at 95% scale, leaves the same way.
const SHOW_MS = 2200;

export function ToastProvider({ children }) {
  // { id, text, warn } — the one on screen (a new one replaces it)
  const [toast, setToast] = useState(null);
  const [visible, setVisible] = useState(false);
  const timers = useRef([]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const show = useCallback((text, { warn = false } = {}) => {
    clearTimers();
    setToast({ id: Date.now() + Math.random(), text, warn });
    setVisible(false);
    // Drawn hidden first, then shown: showing it in the same frame it's
    // added lets Safari skip straight to the end of the transition.
    timers.current.push(setTimeout(() => setVisible(true), 20));
    timers.current.push(setTimeout(() => setVisible(false), SHOW_MS));
    timers.current.push(setTimeout(() => setToast(null), SHOW_MS + MOTION_MS + 50));
  }, []);

  useEffect(() => clearTimers, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <div
          key={toast.id}
          role="status"
          aria-live="polite"
          className={`feature-toast ${toast.warn ? 'warn' : ''} ${visible ? 'show' : ''}`}
        >
          <span className="feature-toast-text">{toast.text}</span>
        </div>
      )}
    </ToastContext.Provider>
  );
}
