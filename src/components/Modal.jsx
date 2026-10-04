import React, { useEffect, useRef, useState } from 'react';
import { MOTION_MS } from '../motion';

// A pop-up (the source repo's .modal-overlay + card): the backdrop fades,
// the card comes in from 14px down at 95% scale and leaves the same way.
// It stays mounted through its closing animation.
export default function Modal({ open, onClose, title, children }) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  const cardRef = useRef(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      // Hidden state committed first, then shown (Safari otherwise skips the fade)
      const t = setTimeout(() => setShown(true), 20);
      return () => clearTimeout(t);
    }
    setShown(false);
    const t = setTimeout(() => setMounted(false), MOTION_MS + 50);
    return () => clearTimeout(t);
  }, [open]);

  // While it's open: Escape closes it, Tab stays inside it, the page's own
  // shortcuts wait (body.modal-open), and focus goes back where it was after
  useEffect(() => {
    if (!open) return undefined;
    const before = document.activeElement;
    document.body.classList.add('modal-open');
    const onKey = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      const card = cardRef.current;
      if (!card) return;
      const stops = [...card.querySelectorAll('button, a[href], input, textarea, select, [tabindex]:not([tabindex="-1"])')].filter(el => !el.disabled);
      if (!stops.length) { e.preventDefault(); return; }
      const first = stops[0];
      const last = stops[stops.length - 1];
      if (!card.contains(document.activeElement)) { e.preventDefault(); first.focus(); return; }
      if (e.shiftKey && (document.activeElement === first || document.activeElement === card)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.classList.remove('modal-open');
      if (before && typeof before.focus === 'function' && document.contains(before)) before.focus({ preventScroll: true });
    };
  }, [open, onClose]);

  useEffect(() => {
    if (shown) cardRef.current?.focus();
  }, [shown]);

  if (!mounted) return null;

  return (
    <div
      className={`modal-overlay ${shown ? 'show' : ''}`}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div ref={cardRef} className="modal-card" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
        {title && <h3 className="modal-title">{title}</h3>}
        {children}
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>close</button>
        </div>
      </div>
    </div>
  );
}
