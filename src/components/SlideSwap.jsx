import React, { useLayoutEffect, useRef } from 'react';
import { MOTION, canAnimate, fadeIn } from '../motion';
import { animateTo, drawnValue } from '../engine';

// The word swap (the word slide's swap form): one word changing to another
// inside a line ("%" ↔ "px wide"). Both share one spot — the old word fades
// out exactly where it was while the new one fades in — and the space they
// take eases from one word's width to the other's, so whatever is beside
// them slides over. Side by side, the two crowded each other mid-slide.
export default function SlideSwap({ text, className = '' }) {
  const wrapRef = useRef(null);
  const wordRef = useRef(null);
  const prev = useRef({ text, width: null });

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const word = wordRef.current;
    const width = word.offsetWidth;
    const p = prev.current;
    if (p.text === text) {
      if (width) p.width = width;
      return;
    }
    const oldText = p.text;
    const oldWidth = p.width ?? width;
    prev.current = { text, width };
    if (!canAnimate(wrap)) return;
    // How strong the old word is drawn now (it may still be fading in)
    const shown = +getComputedStyle(word).opacity;
    // The space eases between the two words' widths (from where it's drawn,
    // if it's still easing from the last swap)
    animateTo(wrap, 'width', width, { from: drawnValue(wrap, 'width', oldWidth) });
    fadeIn(word);
    // The old word fades out where it was, over the new one fading in
    // (from how strong it was: changed back mid-fade, it flashed to full)
    if (!(shown > 0.05)) return;
    const ghost = document.createElement('span');
    ghost.className = 'slide-swap-ghost';
    ghost.textContent = oldText;
    ghost.setAttribute('aria-hidden', 'true');
    wrap.appendChild(ghost);
    const drop = () => ghost.remove();
    ghost.animate([{ opacity: shown }, { opacity: 0 }], { ...MOTION, fill: 'forwards' }).finished.then(drop, drop);
    setTimeout(drop, 800);
  }, [text]);

  // Its word's width, kept current: measured only on a change of word, it
  // was 0 when first drawn inside a closed panel, and the swap eased from 0
  useLayoutEffect(() => {
    const word = wordRef.current;
    if (typeof ResizeObserver !== 'function') return undefined;
    const ro = new ResizeObserver(() => {
      if (word.offsetWidth) prev.current.width = word.offsetWidth;
    });
    ro.observe(word);
    return () => ro.disconnect();
  }, []);

  return (
    <span ref={wrapRef} className={`slide-swap ${className}`}>
      <span ref={wordRef} className="slide-swap-word">{text}</span>
    </span>
  );
}
