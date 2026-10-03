import React, { useLayoutEffect, useRef } from 'react';

// Ported from instagram-follower-checker's instructions tab bar: the
// highlight is drawn in three pieces (two rounded caps and a middle that
// scales) so the slide is transform-only — animating width alongside
// transform runs on the main thread and stutters.
const CAP = 9;        // cap width (a little over the corner radius)
const MID_BASE = 100; // the middle's unscaled width
const DURATION = 450;
const EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';

function frames(x, w) {
  const mid = Math.max(0, w - CAP * 2) / MID_BASE;
  return {
    l: `translateX(${x}px)`,
    m: `translateX(${x + CAP}px) scaleX(${mid})`,
    r: `translateX(${x + w - CAP}px)`,
  };
}

export default function TabSwitcher({ tabs, active, onChange }) {
  const tabRefs = useRef({});
  const partRefs = { l: useRef(null), m: useRef(null), r: useRef(null) };
  const pos = useRef(null);
  const anims = useRef(null);

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
    if (!animate || !moved || typeof parts.l.animate !== 'function') return;
    const f = frames(from.x, from.w);
    anims.current = Object.keys(parts).map(k =>
      parts[k].animate([{ transform: f[k] }, { transform: to[k] }], { duration: DURATION, easing: EASING })
    );
  };

  // Effects call the latest place() through a ref
  const placeRef = useRef(place);
  placeRef.current = place;

  // First placement is instant; every change after that slides.
  const placed = useRef(false);
  useLayoutEffect(() => {
    placeRef.current(placed.current);
    placed.current = true;
  }, [active]);

  // Re-place without animating once fonts load or the bar resizes.
  useLayoutEffect(() => {
    const replace = () => placeRef.current(false);
    document.fonts?.ready.then(replace);
    window.addEventListener('resize', replace);
    return () => window.removeEventListener('resize', replace);
  }, []);

  return (
    <div className="tab-switcher" role="tablist">
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
          onClick={(e) => { e.currentTarget.blur(); onChange(tab.key); }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
