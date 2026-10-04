import React from 'react';
import { MOTION, canAnimate, fadeIn } from '../motion';

// Text that changes the way instagram-follower-checker's empty-state texts
// do: when `k` changes, a copy of the old text is pinned exactly where it
// was drawn and fades out (captureGhost), while the new text fades in
// (fadeEmptyIn) — 450ms, cubic-bezier(0.4, 0, 0.2, 1), no rise. Same `k`:
// it stays as it is. Its box's height eases separately (AutoHeight).
// `quiet`: the old text just goes, no fading copy (when something else is
// coming in where it was drawn).
function captureGhost(el) {
  if (!el || !el.getClientRects().length || !el.textContent.trim() || !canAnimate(el)) return null;
  // Fades out from how strong it's drawn now: changed again while still
  // fading in, its copy jumped to full strength and flashed
  const shown = +getComputedStyle(el).opacity;
  if (!(shown > 0.05)) return null;
  const host = el.parentElement?.closest('.btn, .field-grid, .tool-meta, .tool-box, .tool') || document.body;
  const hr = host.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const ghost = el.cloneNode(true);
  const cs = getComputedStyle(el);
  // Where it sat, relative to its host (the host may move before the copy goes in)
  const dx = r.left - hr.left;
  const dy = r.top - hr.top;
  Object.assign(ghost.style, {
    position: 'absolute', margin: '0', transform: 'none', animation: 'none',
    top: '0px', left: '0px',
    width: `${r.width}px`, height: `${r.height}px`, boxSizing: 'border-box',
    display: cs.display === 'inline' ? 'inline-block' : cs.display,
    // A line that wrapped keeps wrapping the same way (forced onto one line
    // it slid sideways and ran off the edge)
    whiteSpace: cs.display === 'inline' ? 'nowrap' : cs.whiteSpace, textAlign: cs.textAlign, pointerEvents: 'none', zIndex: '3',
  });
  ghost.setAttribute('aria-hidden', 'true');
  return () => {
    host.appendChild(ghost);
    // Placed by measuring the copy itself, so it lands exactly on the old
    // text whatever its containing box is (it was 24px off before)
    const g = ghost.getBoundingClientRect();
    const h = host.getBoundingClientRect();
    ghost.style.left = `${h.left + dx - g.left}px`;
    ghost.style.top = `${h.top + dy - g.top}px`;
    const drop = () => ghost.remove();
    ghost.animate([{ opacity: shown }, { opacity: 0 }], { ...MOTION, fill: 'forwards' }).finished.then(drop, drop);
    setTimeout(drop, 800);
  };
}

export default class FadeText extends React.Component {
  ref = React.createRef();

  getSnapshotBeforeUpdate(prev) {
    return prev.k === this.props.k || this.props.quiet ? null : captureGhost(this.ref.current);
  }

  componentDidUpdate(prev, _state, playGhost) {
    if (prev.k === this.props.k) return;
    playGhost?.();
    const el = this.ref.current;
    if (el && el.textContent.trim()) fadeIn(el);
  }

  render() {
    const { as: Tag = 'span', className = '', children } = this.props;
    return <Tag ref={this.ref} className={`fade-text ${className}`}>{children}</Tag>;
  }
}
