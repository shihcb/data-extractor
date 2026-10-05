import React, { useLayoutEffect, useRef } from 'react';
import { MOTION, MOTION_MS, canAnimate, motionEase, prefersReducedMotion } from '../motion';

// Ported from instagram-follower-checker's instructions tab bar: the
// highlight is drawn in three pieces (two rounded caps and a middle that
// scales) so the slide is transform-only — animating width alongside
// transform runs on the main thread and stutters.
const CAP = 9;        // cap width (a little over the corner radius)
const MID_BASE = 100; // the middle's unscaled width

function frames(x, w) {
  const mid = Math.max(0, w - CAP * 2) / MID_BASE;
  return {
    l: `translateX(${x}px)`,
    m: `translateX(${x + CAP}px) scaleX(${mid})`,
    r: `translateX(${x + w - CAP}px)`,
  };
}

export default function TabSwitcher({ tabs, active, onChange, className = '' }) {
  const barRef = useRef(null);
  const tabRefs = useRef({});
  const partRefs = { l: useRef(null), m: useRef(null), r: useRef(null) };
  const pos = useRef(null);
  const anims = useRef(null);
  const placed = useRef(false);
  const scrollRaf = useRef(null);
  const scrolledOnce = useRef(false);

  const place = (animate) => {
    const tab = tabRefs.current[active];
    const parts = { l: partRefs.l.current, m: partRefs.m.current, r: partRefs.r.current };
    if (!tab || !parts.l) return;
    const x = tab.offsetLeft;
    const w = tab.offsetWidth;
    if (!w) return;

    let from = pos.current;
    // Mid-slide: start from where the pieces are right now.
    if (anims.current && anims.current.some(a => a.playState === 'running') && from) {
      const tx = (el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41;
      const lx = tx(parts.l);
      from = { x: lx, w: tx(parts.r) - lx + CAP };
    }
    if (anims.current) anims.current.forEach(a => a.cancel());
    anims.current = null;

    const to = frames(x, w);
    Object.keys(parts).forEach(k => { parts[k].style.transform = to[k]; });
    pos.current = { x, w };

    const moved = from && (Math.abs(from.x - x) > 0.5 || Math.abs(from.w - w) > 0.5);
    if (!animate || !moved || !canAnimate(parts.l)) return;
    const f = frames(from.x, from.w);
    anims.current = Object.keys(parts).map(k =>
      parts[k].animate([{ transform: f[k] }, { transform: to[k] }], MOTION)
    );
  };

  // A bar with more tabs past an edge fades that edge out (the source
  // repo's setupNavOverflow).
  const updateFades = () => {
    const bar = barRef.current;
    if (!bar) return;
    const max = bar.scrollWidth - bar.clientWidth;
    bar.classList.toggle('fade-left', max > 1 && bar.scrollLeft > 1);
    bar.classList.toggle('fade-right', max > 1 && bar.scrollLeft < max - 1);
  };

  // The active tab is scrolled toward the middle, gliding on the app's curve
  const scrollToActive = (glide) => {
    const bar = barRef.current;
    const tab = tabRefs.current[active];
    if (!bar || !tab) return;
    const max = bar.scrollWidth - bar.clientWidth;
    cancelAnimationFrame(scrollRaf.current);
    if (max > 1) {
      const target = Math.max(0, Math.min(max, tab.offsetLeft - (bar.clientWidth - tab.offsetWidth) / 2));
      if (!glide || prefersReducedMotion()) {
        bar.scrollLeft = target;
      } else {
        const from = bar.scrollLeft;
        const t0 = performance.now();
        const step = (now) => {
          const t = Math.min(1, (now - t0) / MOTION_MS);
          bar.scrollLeft = from + (target - from) * motionEase(t);
          updateFades();
          if (t < 1) scrollRaf.current = requestAnimationFrame(step);
        };
        scrollRaf.current = requestAnimationFrame(step);
      }
    }
    updateFades();
  };

  // Effects call the latest functions through a ref
  const latest = useRef({});
  latest.current = { place, updateFades, scrollToActive };

  // First placement is instant; every change after that slides.
  useLayoutEffect(() => {
    latest.current.place(placed.current);
    placed.current = true;
    latest.current.scrollToActive(scrolledOnce.current);
    scrolledOnce.current = true;
  }, [active]);

  // Re-place without animating once fonts load or the bar resizes.
  useLayoutEffect(() => {
    const replace = () => {
      latest.current.place(false);
      latest.current.updateFades();
    };
    document.fonts?.ready.then(replace);
    window.addEventListener('resize', replace);
    let ro = null;
    if (typeof ResizeObserver === 'function' && barRef.current) {
      ro = new ResizeObserver(replace);
      ro.observe(barRef.current);
    }
    return () => {
      window.removeEventListener('resize', replace);
      ro?.disconnect();
      cancelAnimationFrame(scrollRaf.current);
    };
  }, []);

  // A mouse wheel scrolls the bar sideways
  useLayoutEffect(() => {
    const bar = barRef.current;
    const onWheel = (e) => {
      if (e.ctrlKey || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
      const max = bar.scrollWidth - bar.clientWidth;
      if (max <= 1) return;
      e.preventDefault();
      cancelAnimationFrame(scrollRaf.current);
      bar.scrollLeft = Math.max(0, Math.min(max, bar.scrollLeft + e.deltaY));
    };
    // A finger on the bar takes over from the glide too (it pulled a swipe back)
    const onTouch = () => cancelAnimationFrame(scrollRaf.current);
    bar.addEventListener('wheel', onWheel, { passive: false });
    bar.addEventListener('touchstart', onTouch, { passive: true });
    return () => {
      bar.removeEventListener('wheel', onWheel);
      bar.removeEventListener('touchstart', onTouch);
    };
  }, []);

  return (
    <div ref={barRef} className={`tab-switcher ${className}`} role="tablist" onScroll={updateFades}>
      <div className="tab-indicator" aria-hidden="true">
        <span ref={partRefs.l} className="tab-ind-l" />
        <span ref={partRefs.m} className="tab-ind-m" />
        <span ref={partRefs.r} className="tab-ind-r" />
      </div>
      {tabs.map(tab => (
        <button
          key={tab.key}
          ref={el => { tabRefs.current[tab.key] = el; }}
          role="tab"
          aria-selected={active === tab.key}
          className={`tab-switcher-btn ${active === tab.key ? 'active' : ''}`}
          tabIndex={active === tab.key ? 0 : -1}
          onClick={(e) => { if (e.detail) e.currentTarget.blur(); onChange(tab.key); }}
          // Arrow keys move between tabs (Home / End to the ends), focus following
          onKeyDown={(e) => {
            const i = tabs.findIndex(t => t.key === tab.key);
            const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
            if (to === undefined) return;
            e.preventDefault();
            const next = tabs[(to + tabs.length) % tabs.length];
            onChange(next.key);
            tabRefs.current[next.key]?.focus();
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
