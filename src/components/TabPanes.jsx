import React, { useLayoutEffect, useRef } from 'react';

// Ported from instagram-follower-checker's instructions steps: every pane
// sits in the same spot (stacked) and stays mounted, so switching never
// changes the layout and each tab keeps its state. The pane you leave
// slides away while the new one slides in; a tap mid-slide carries on from
// where each pane is drawn.
const DURATION = 450;
const EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';

export default function TabPanes({ tabs, active, children }) {
  const paneRefs = useRef({});
  const prev = useRef(active);
  const timer = useRef(null);

  useLayoutEffect(() => {
    const oldKey = prev.current;
    prev.current = active;
    const panes = paneRefs.current;
    const newPane = panes[active];
    const order = (key) => tabs.findIndex(t => t.key === key);

    const shown = Object.entries(panes).filter(([key, p]) =>
      key === oldKey || p.classList.contains('pane-out'));
    const at = new Map(shown.map(([, p]) => {
      const cs = getComputedStyle(p);
      return [p, { x: new DOMMatrixReadOnly(cs.transform).m41 || 0, o: +cs.opacity }];
    }));
    shown.forEach(([, p]) => p.getAnimations().forEach(a => a.cancel()));
    clearTimeout(timer.current);

    Object.entries(panes).forEach(([key, p]) => {
      p.classList.toggle('active', key === active);
      p.classList.toggle('pane-out', key !== active && shown.some(([k]) => k === key));
    });

    const settle = () => Object.entries(panes).forEach(([key, p]) => {
      if (key === prev.current) return;
      p.getAnimations().forEach(a => a.cancel());
      p.classList.remove('pane-out');
    });

    if (oldKey === active || typeof newPane.animate !== 'function') {
      settle();
      return;
    }

    const w = newPane.parentElement.clientWidth;
    const dir = order(active) > order(oldKey) ? 1 : -1;
    // Shorter trips (an interrupted slide) take proportionally less time
    const timing = (dist) => ({
      duration: Math.round(DURATION * Math.min(1, Math.max(0.35, Math.abs(dist) / w))),
      easing: EASING,
    });

    const from = at.get(newPane) || { x: dir * w, o: 0.35 };
    const tIn = timing(from.x);
    let longest = tIn.duration;
    newPane.animate([
      { transform: `translateX(${from.x}px)`, opacity: from.o },
      { transform: 'translateX(0)', opacity: 1 },
    ], tIn);

    shown.filter(([, p]) => p !== newPane).forEach(([key, p]) => {
      const f = at.get(p) || { x: 0, o: 1 };
      const to = order(key) < order(active) ? -w : w; // carousel order
      const t = timing(to - f.x);
      longest = Math.max(longest, t.duration);
      p.animate([
        { transform: `translateX(${f.x}px)`, opacity: f.o },
        { transform: `translateX(${to}px)`, opacity: 0.35 },
      ], { ...t, fill: 'forwards' });
    });

    timer.current = setTimeout(settle, longest + 30);
  }, [active, tabs]);

  return (
    <div className="tab-panes">
      {tabs.map((tab, i) => (
        <div
          key={tab.key}
          ref={el => { paneRefs.current[tab.key] = el; }}
          className="tab-pane"
          aria-hidden={tab.key !== active}
        >
          {children[i]}
        </div>
      ))}
    </div>
  );
}
