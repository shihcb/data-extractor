import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard } from 'lucide-react';
import CaseConverter from './components/CaseConverter';
import ImageConverter from './components/ImageConverter';
import PdfTools from './components/PdfTools';
import PdfEditor from './components/PdfEditor';
import QrTool from './components/QrTool';
import TextDiff from './components/TextDiff';
import TabSwitcher from './components/TabSwitcher';
import TabPanes from './components/TabPanes';
import Modal from './components/Modal';
import { ToastProvider } from './components/Toast';
import { MOTION_MS, motionEase, prefersReducedMotion } from './motion';
import { heightStillToCome } from './heightMotion';

const TABS = [
  { key: 'case',      label: 'case converter' },
  { key: 'image',     label: 'image converter' },
  { key: 'pdf',       label: 'pdf tools' },
  { key: 'pdfedit',   label: 'pdf editor' },
  { key: 'qr',        label: 'qr code' },
  { key: 'diff',      label: 'text diff' },
];

// A file dropped anywhere outside a drop box must not open in the browser
// in place of the app (and take all the work with it). Drop boxes handle
// their own drops first; here the rest are just stopped.
if (typeof window !== 'undefined') {
  const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
  window.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
  window.addEventListener('drop', (e) => { if (hasFiles(e)) e.preventDefault(); });
}

const readTab = () => {
  try {
    const saved = localStorage.getItem('active_tab');
    return TABS.some(t => t.key === saved) ? saved : 'case';
  } catch {
    return 'case';
  }
};

const isTyping = () => {
  const el = document.activeElement;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
};

export default function App() {
  const [activeTab, setActiveTab] = useState(readTab);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const closeShortcuts = useCallback(() => setShortcutsOpen(false), []);

  useEffect(() => {
    try {
      localStorage.setItem('active_tab', activeTab);
    } catch {
      // storage unavailable; the tab just won't be remembered
    }
  }, [activeTab]);

  // Content shrinking (a file row deleted near the bottom of the page) must
  // not pull the page down. The page always has a floor at the bottom of the
  // view — but never taller than its content, so on its own it adds nothing.
  // It's in place before anything shrinks, so a shorter page keeps exactly the
  // room it needs to stay put; scrolling up gives that room back. Scrolling
  // can never raise it past the content (an earlier version followed every
  // scroll, and iPhone's growing view as its toolbar hides made it add blank
  // space without end).
  const shellRef = useRef(null);
  useEffect(() => {
    const shell = shellRef.current;
    const content = shell.firstElementChild;
    let natural = 0;
    let floor = 0;
    const naturalHeight = () => {
      const cs = getComputedStyle(shell);
      return content.offsetHeight + (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    };
    // Written only when it changes: this runs on every frame a box eases, and
    // rewriting the page's height each time made a phone lay it all out twice
    const apply = () => {
      const h = floor ? `${Math.floor(floor)}px` : '';
      if (shell.style.minHeight !== h) shell.style.minHeight = h;
    };
    const onScroll = () => {
      // Held room (floor above the content) can only shrink; otherwise the
      // floor follows the view, capped at the content
      floor = Math.min(window.scrollY + window.innerHeight, Math.max(natural, floor));
      apply();
      updateLock();
    };
    // When something is deleted and blank room opens up below the content,
    // the page slides up on the app's curve until that room is gone (instead
    // of holding it until you scroll it away). When everything fits on screen
    // again it slides all the way to the top and stops scrolling until
    // there's more than a screenful; it scrolls again as soon as it needs to.
    const root = document.documentElement;
    let glide = null;
    // (the breathing room below the content doesn't count: only the content)
    const fits = () => {
      const cs = getComputedStyle(shell);
      return content.offsetHeight + (parseFloat(cs.paddingTop) || 0) <= window.innerHeight + 1;
    };
    // Where the page belongs once the boxes easing now have landed: the
    // content's bottom at the view's bottom (the top, if it all fits). Aimed
    // at from the first frame, the page and the box move together on the
    // same curve; aimed at where the box is drawn, the page waited until
    // blank room showed, then rushed after the box.
    const target = () => {
      const still = heightStillToCome();
      const cs = getComputedStyle(shell);
      if (content.offsetHeight + still + (parseFloat(cs.paddingTop) || 0) <= window.innerHeight + 1) return 0;
      return Math.max(0, naturalHeight() + still - window.innerHeight);
    };
    const updateLock = () => {
      const lock = fits() && window.scrollY < 1 && !glide;
      if (root.classList.contains('page-fits') !== lock) root.classList.toggle('page-fits', lock);
    };
    const stopGlide = () => {
      if (!glide) return;
      cancelAnimationFrame(glide);
      glide = null;
    };
    const glideUp = () => {
      if (glide || window.scrollY <= target() + 1) return;
      // The room to give back, which shrinks to nothing on the curve
      const extra = window.scrollY - target();
      const t0 = performance.now();
      if (prefersReducedMotion()) {
        window.scrollTo(0, target());
        onScroll();
        return;
      }
      // Each frame heads for where things end up now (another change can
      // land mid-glide)
      const step = (now) => {
        const t = Math.min(1, (now - t0) / MOTION_MS);
        const to = target();
        window.scrollTo(0, Math.min(window.scrollY, to + extra * (1 - motionEase(t))));
        if (t < 1 && window.scrollY > to + 0.5) {
          glide = requestAnimationFrame(step);
        } else {
          glide = null;
          onScroll();
          // Still further to go (something else shrank meanwhile): carry on
          glideUp();
        }
      };
      glide = requestAnimationFrame(step);
    };
    const onResize = () => {
      natural = naturalHeight();
      if (floor > natural) {
        // Shorter content: hold what's in view, no more
        floor = Math.min(floor, window.scrollY + window.innerHeight);
      }
      apply();
      if (heightStillToCome() < -0.5 && !glide) {
        // A box easing shut: the page's bottom follows the content's bottom
        // frame by frame, so no blank room ever opens to be scrolled away
        // afterwards (that late scroll was the jump)
        const to = Math.max(0, natural - window.innerHeight);
        if (window.scrollY > to + 0.5) {
          window.scrollTo(0, to);
          floor = Math.min(floor, to + window.innerHeight);
          apply();
        }
      } else if (window.scrollY > target() + 1) {
        glideUp();
      }
      updateLock();
    };
    natural = naturalHeight();
    onScroll();
    const ro = new ResizeObserver(onResize);
    ro.observe(content);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    // Your own scrolling takes over from a glide
    window.addEventListener('wheel', stopGlide, { passive: true });
    window.addEventListener('touchstart', stopGlide, { passive: true });
    updateLock();
    return () => {
      ro.disconnect();
      cancelAnimationFrame(glide);
      window.removeEventListener('wheel', stopGlide);
      window.removeEventListener('touchstart', stopGlide);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      root.classList.remove('page-fits');
    };
  }, []);

  // Shift+1..6 switch tabs, ? shows the shortcuts (not while typing)
  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping()) return;
      // (a pop-up open: only ? (to close it) — no switching tabs behind it)
      if (e.key !== '?' && document.body.classList.contains('modal-open')) return;
      if (e.key === '?') {
        e.preventDefault();
        setShortcutsOpen(open => !open);
        return;
      }
      if (!e.shiftKey) return;
      // e.code, not e.key: Shift+1 types "!" (or other symbols on other layouts)
      const match = /^Digit([1-9])$/.exec(e.code);
      const tab = match && TABS[Number(match[1]) - 1];
      if (tab) {
        e.preventDefault();
        setActiveTab(tab.key);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <ToastProvider>
      <div ref={shellRef} className="app-shell">
        <div className="app-container">
          <div className="tab-switcher-row page-tabs">
            <TabSwitcher tabs={TABS} active={activeTab} onChange={setActiveTab} />
          </div>
          <TabPanes tabs={TABS} active={activeTab}>
            <CaseConverter active={activeTab === 'case'} />
            <ImageConverter active={activeTab === 'image'} />
            <PdfTools active={activeTab === 'pdf'} />
            <PdfEditor active={activeTab === 'pdfedit'} />
            <QrTool active={activeTab === 'qr'} />
            <TextDiff active={activeTab === 'diff'} />
          </TabPanes>
        </div>
      </div>

      <button
        className="btn btn-icon shortcuts-btn"
        onClick={(e) => { if (e.detail) e.currentTarget.blur(); setShortcutsOpen(true); }}
        title="Keyboard shortcuts (?)"
        aria-label="Keyboard shortcuts"
      >
        <Keyboard size={15} />
      </button>

      <Modal open={shortcutsOpen} onClose={closeShortcuts} title="keyboard shortcuts">
        <ul className="shortcut-list">
          {TABS.map((tab, i) => (
            <li key={tab.key}>
              <span>{tab.label}</span>
              <kbd>Shift + {i + 1}</kbd>
            </li>
          ))}
          <li>
            <span>show these shortcuts</span>
            <kbd>?</kbd>
          </li>
          <li>
            <span>close a pop-up</span>
            <kbd>Esc</kbd>
          </li>
          <li>
            <span>pdf editor: next text</span>
            <kbd>Tab</kbd>
          </li>
          <li>
            <span>pdf editor: undo</span>
            <kbd>Ctrl + Z</kbd>
          </li>
          <li>
            <span>pdf editor: redo</span>
            <kbd>Ctrl + Shift + Z</kbd>
          </li>
          <li>
            <span>pdf editor: find and replace</span>
            <kbd>Ctrl + F</kbd>
          </li>
        </ul>
      </Modal>
    </ToastProvider>
  );
}
