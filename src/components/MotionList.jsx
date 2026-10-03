import React, { useLayoutEffect, useReducer, useRef } from 'react';
import { canAnimate } from '../motion';
import { animateTo, shift, stop } from '../engine';
import AutoHeight from './AutoHeight';

// Ported from instagram-follower-checker's list 3 row engine, on the same
// 450ms curve:
//  - 'rows': a row arriving slides down from under the row above it (moved
//    up by its height and clipped at its top edge, both easing to nothing);
//    a row leaving does the same in reverse.
//  - 'grid': laid out as a grid; items pop in/out like the app's pop-ups
//    (14px down, 95%), or with motion="slide" slide in/out like rows.
// Either way the items around it slide from where they were drawn to their
// new places (FLIP), and the list's height eases to its new size (AutoHeight). Changes
// mid-slide carry on from where everything is drawn right now.
export default function MotionList({ items, getKey, renderItem, variant = 'rows', motion, exitMotion, className = '', itemClassName = '' }) {
  const pops = (motion || (variant === 'grid' ? 'pop' : 'slide')) === 'pop';
  const containerRef = useRef(null);
  const nodes = useRef(new Map());     // key -> element (current items)
  const positions = useRef(new Map()); // key -> { top, left, width, height } (layout, last commit)
  const prevKeys = useRef(null);
  const prevItems = useRef(new Map()); // key -> item (last commit)
  const exiting = useRef(new Map());   // key -> { item, pos, index }
  const [, rerender] = useReducer(x => x + 1, 0);
  // The effect reads these through a ref: it should run when the items change, not on every render
  const opts = useRef({ getKey, pops });
  opts.current = { getKey, pops };

  const measure = (el) => ({ top: el.offsetTop, left: el.offsetLeft, width: el.offsetWidth, height: el.offsetHeight });


  useLayoutEffect(() => {
    const { getKey, pops } = opts.current;
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
        if (pops) {
          // Pops in like the app's pop-ups: from 14px down at 95%
          animateTo(el, 'opacity', 1, { from: 0 });
          animateTo(el, 'ty', 0, { from: 14 });
          animateTo(el, 'scale', 1, { from: 0.95 });
        } else {
          // Slides down from under the row above, revealed from its top edge
          animateTo(el, 'ty', 0, { from: -now.height });
          animateTo(el, 'clip', 0, { from: now.height });
        }
        return;
      }
      // Its layout moved: drawn where it was, easing to the new spot, on top
      // of anything already moving it
      shift(el, 'tx', before.left - now.left);
      shift(el, 'ty', before.top - now.top);
    });

    positions.current = new Map(keys.map(key => {
      const el = nodes.current.get(key);
      return [key, el ? measure(el) : null];
    }).filter(([, p]) => p));
    prevKeys.current = keys;
    prevItems.current = new Map(items.map(item => [getKey(item), item]));

    if (exiting.current.size) rerender();
  }, [items]);

  // Keep the remembered spots right when the page resizes
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (typeof ResizeObserver !== 'function') return;
    const ro = new ResizeObserver(() => {
      nodes.current.forEach((el, key) => positions.current.set(key, measure(el)));
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  const playExit = (key, el) => {
    if (!el || el._exitStarted) return;
    el._exitStarted = true;
    const h = el.offsetHeight;
    const done = () => {
      // Hidden first: dropping its slide styles makes it fully visible again,
      // and the page can draw a frame before React removes it (on iPhone the
      // deleted row flashed back into view)
      el.style.visibility = 'hidden';
      stop(el);
      exiting.current.delete(key);
      rerender();
    };
    if (!canAnimate(el)) {
      done();
      return;
    }
    // `exitMotion(key)` can pick how one item leaves ('pop' or 'slide')
    const popsOut = exitMotion?.(key) ? exitMotion(key) === 'pop' : pops;
    if (popsOut) {
      animateTo(el, 'opacity', 0, { from: 1 });
      animateTo(el, 'scale', 0.95, { from: 1 });
      animateTo(el, 'ty', 14, { from: 0, onSettle: done });
    } else {
      // Slides up under the row above, cut away from its top edge
      animateTo(el, 'clip', h, { from: 0 });
      animateTo(el, 'ty', -h, { from: 0, onSettle: done });
    }
  };

  // Current items in order, with leaving copies slotted back in where they
  // were. A leaving item keeps its own key, so it's the very same element
  // that leaves: under a new key React built a fresh copy, whose pictures
  // loaded and faded in again — the page flashed as it started to go.
  // Spotted here, while rendering, not after: by then React has already
  // taken the old element away.
  if (prevKeys.current && containerRef.current && canAnimate(containerRef.current)) {
    const keySet = new Set(items.map(getKey));
    prevKeys.current.forEach((key, index) => {
      if (keySet.has(key) || exiting.current.has(key)) return;
      const pos = positions.current.get(key);
      const item = prevItems.current.get(key);
      if (pos && item !== undefined) exiting.current.set(key, { item, pos, index });
    });
  }
  const rendered = items.map(item => ({ key: getKey(item), item, leaving: null }));
  [...exiting.current.entries()]
    .sort((a, b) => a[1].index - b[1].index)
    .forEach(([key, info]) => {
      rendered.splice(Math.min(info.index, rendered.length), 0, { key, item: info.item, leaving: { key, ...info } });
    });

  return (
    <AutoHeight className="motion-list-box">
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
                if (el._exitStarted) {
                  // Back before it finished leaving: it comes in afresh
                  el._exitStarted = false;
                  stop(el);
                  el.style.visibility = '';
                }
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
    </AutoHeight>
  );
}
