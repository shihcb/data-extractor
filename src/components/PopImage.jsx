import React, { useLayoutEffect, useReducer, useRef } from 'react';
import { canAnimate } from '../motion';
import { animateTo, drawnValue, stop } from '../engine';

// One picture at a time, coming and going with the pop (the app's pop-ups:
// in from 14px down at 95%, out the same way). A new picture pops in while
// the old one pops out exactly where it was, laid over it. The picture that
// leaves is the very same element (same key), so it never reloads or
// flashes. Its box must be positioned (the leaving copy is pinned in it).
export default function PopImage({ id, src, alt, className = '' }) {
  const nodes = useRef(new Map());   // id -> element
  const leaving = useRef(new Map()); // id -> { src, alt, pos }
  const shown = useRef(null);        // { id, src, alt } drawn last
  const [, rerender] = useReducer(x => x + 1, 0);

  // Spotted while rendering, so React keeps the old element for its exit
  const was = shown.current;
  if (was && was.id !== id && !leaving.current.has(was.id)) {
    const el = nodes.current.get(was.id);
    if (el && el.getClientRects().length && canAnimate(el)) {
      const pos = { top: el.offsetTop, left: el.offsetLeft, width: el.offsetWidth, height: el.offsetHeight };
      leaving.current.set(was.id, { src: was.src, alt: was.alt, pos });
    }
  }
  if (id != null) leaving.current.delete(id);
  shown.current = id != null ? { id, src, alt } : null;

  useLayoutEffect(() => {
    if (id == null) return;
    const el = nodes.current.get(id);
    if (!el || !canAnimate(el)) return;
    // Back while it was still leaving: from where it's drawn
    const back = el._popOut;
    const o = back ? drawnValue(el, 'opacity', 1) : 0;
    const ty = back ? drawnValue(el, 'ty', 0) : 14;
    const sc = back ? drawnValue(el, 'scale', 1) : 0.95;
    if (back) {
      el._popOut = false;
      stop(el);
      el.style.visibility = '';
    }
    animateTo(el, 'opacity', 1, { from: o });
    animateTo(el, 'ty', 0, { from: ty });
    animateTo(el, 'scale', 1, { from: sc });
  }, [id]);

  const popOut = (key, el) => {
    if (!el || el._popOut) return;
    el._popOut = true;
    const done = () => {
      // Hidden before its motion styles go (they'd show it again for a frame)
      el.style.visibility = 'hidden';
      stop(el);
      leaving.current.delete(key);
      rerender();
    };
    animateTo(el, 'opacity', 0, { from: drawnValue(el, 'opacity', 1) });
    animateTo(el, 'scale', 0.95, { from: drawnValue(el, 'scale', 1) });
    animateTo(el, 'ty', 14, { from: drawnValue(el, 'ty', 0), onSettle: done });
  };

  return (
    <>
      {[...leaving.current.entries()].map(([key, l]) => (
        <img
          key={key}
          src={l.src}
          alt=""
          aria-hidden="true"
          className={className}
          style={{ position: 'absolute', top: `${l.pos.top}px`, left: `${l.pos.left}px`, width: `${l.pos.width}px`, height: `${l.pos.height}px`, maxWidth: 'none', maxHeight: 'none', margin: 0, pointerEvents: 'none' }}
          ref={el => popOut(key, el)}
        />
      ))}
      {id != null && (
        <img
          key={id}
          src={src}
          alt={alt}
          className={className}
          ref={el => { if (el) nodes.current.set(id, el); else nodes.current.delete(id); }}
        />
      )}
    </>
  );
}
