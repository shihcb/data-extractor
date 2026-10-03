import React, { useLayoutEffect, useReducer, useRef } from 'react';
import { MOTION, POP_HIDDEN, POP_SHOWN, animateHeightFrom, canAnimate } from '../motion';

// Ported from instagram-follower-checker's list 3 row engine, on the same
// 450ms curve:
//  - 'rows': a row arriving slides down from under the row above it (moved
//    up by its height and clipped at its top edge, both easing to nothing);
//    a row leaving does the same in reverse.
//  - 'grid': items pop in/out like the app's pop-ups (14px down, 95%).
// Either way the items around it slide from where they were drawn to their
// new places (FLIP), and the list's height eases to its new size. Changes
// mid-slide carry on from where everything is drawn right now.
export default function MotionList({ items, getKey, renderItem, variant = 'rows', className = '', itemClassName = '' }) {
  const containerRef = useRef(null);
  const nodes = useRef(new Map());     // key -> element (current items)
  const positions = useRef(new Map()); // key -> { top, left, width, height } (layout, last commit)
  const prevKeys = useRef(null);
  const prevItems = useRef(new Map()); // key -> item (last commit)
  const prevHeight = useRef(0);
  const exiting = useRef(new Map());   // key -> { item, pos, index }
  const [, rerender] = useReducer(x => x + 1, 0);
  // The effect reads these through a ref: it should run when the items change, not on every render
  const opts = useRef({ getKey, variant });
  opts.current = { getKey, variant };

  const measure = (el) => ({ top: el.offsetTop, left: el.offsetLeft, width: el.offsetWidth, height: el.offsetHeight });

  // Where the element is drawn right now = its layout spot + any slide in flight
  const drawnOffset = (el) => {
    const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
    return { x: m.m41 || 0, y: m.m42 || 0 };
  };

  useLayoutEffect(() => {
    const { getKey, variant } = opts.current;
    const container = containerRef.current;
    const keys = items.map(getKey);
    const first = prevKeys.current === null;
    const animate = !first && canAnimate(container);

    // Rows that left: keep a copy pinned where it was, and play it out
    if (!first) {
      const keySet = new Set(keys);
      prevKeys.current.forEach((key, index) => {
        if (keySet.has(key) || exiting.current.has(key)) return;
        const pos = positions.current.get(key);
        const item = prevItems.current.get(key);
        if (pos && item !== undefined && animate) exiting.current.set(key, { item, pos, index });
      });
    }
    // A key that came back while its copy was still leaving
    keys.forEach(key => exiting.current.delete(key));

    // Everyone else: from where they were drawn to where they are now
    keys.forEach(key => {
      const el = nodes.current.get(key);
      if (!el) return;
      const now = measure(el);
      const before = positions.current.get(key);
      if (!animate) return;
      if (!before) {
        const enter = variant === 'grid'
          ? [POP_HIDDEN, POP_SHOWN]
          : [
              { transform: `translateY(${-now.height}px)`, clipPath: `inset(${now.height}px 0px 0px 0px)` },
              { transform: 'translateY(0px)', clipPath: 'inset(0px 0px 0px 0px)' },
            ];
        el.getAnimations().forEach(a => a.cancel());
        el.animate(enter, MOTION);
        return;
      }
      const drawn = drawnOffset(el);
      const dx = before.left + drawn.x - now.left;
      const dy = before.top + drawn.y - now.top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
      el.getAnimations().forEach(a => a.cancel());
      el.animate([
        { transform: `translate(${dx}px, ${dy}px)` },
        { transform: 'translate(0px, 0px)' },
      ], MOTION);
    });

    // The list's own height eases to its new size
    if (animate) animateHeightFrom(container, prevHeight.current);

    positions.current = new Map(keys.map(key => {
      const el = nodes.current.get(key);
      return [key, el ? measure(el) : null];
    }).filter(([, p]) => p));
    prevKeys.current = keys;
    prevItems.current = new Map(items.map(item => [getKey(item), item]));
    prevHeight.current = container.offsetHeight;

    if (exiting.current.size) rerender();
  }, [items]);

  // Keep the remembered spots right when the page resizes
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (typeof ResizeObserver !== 'function') return;
    const ro = new ResizeObserver(() => {
      if (container._heightAnim) return; // mid-resize: the next commit measures
      nodes.current.forEach((el, key) => positions.current.set(key, measure(el)));
      prevHeight.current = container.offsetHeight;
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  const playExit = (key, el) => {
    if (!el || el._exitStarted) return;
    el._exitStarted = true;
    const h = el.offsetHeight;
    const frames = variant === 'grid'
      ? [POP_SHOWN, POP_HIDDEN]
      : [
          { transform: 'translateY(0px)', clipPath: 'inset(0px 0px 0px 0px)' },
          { transform: `translateY(${-h}px)`, clipPath: `inset(${h}px 0px 0px 0px)` },
        ];
    const anim = el.animate(frames, { ...MOTION, fill: 'forwards' });
    const done = () => {
      exiting.current.delete(key);
      rerender();
    };
    anim.finished.then(done, done);
  };

  // Current items in order, with leaving copies slotted back in where they were
  const rendered = items.map(item => ({ key: getKey(item), item, leaving: null }));
  [...exiting.current.entries()]
    .sort((a, b) => a[1].index - b[1].index)
    .forEach(([key, info]) => {
      rendered.splice(Math.min(info.index, rendered.length), 0, { key: `__exit_${key}`, item: info.item, leaving: { key, ...info } });
    });

  return (
    <div ref={containerRef} className={`motion-list motion-list-${variant} ${className}`}>
      {rendered.map(({ key, item, leaving }) => (
        <div
          key={key}
          className={`motion-item ${itemClassName} ${leaving ? 'motion-item-leaving' : ''}`}
          aria-hidden={leaving ? true : undefined}
          style={leaving ? {
            position: 'absolute',
            top: `${leaving.pos.top}px`,
            left: `${leaving.pos.left}px`,
            width: `${leaving.pos.width}px`,
            height: `${leaving.pos.height}px`,
            margin: 0,
            pointerEvents: 'none',
            zIndex: 0,
          } : undefined}
          ref={el => {
            if (leaving) {
              playExit(leaving.key, el);
            } else if (el) {
              nodes.current.set(key, el);
            } else {
              nodes.current.delete(key);
            }
          }}
        >
          {renderItem(item, { leaving: !!leaving })}
        </div>
      ))}
    </div>
  );
}
