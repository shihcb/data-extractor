import React from 'react';
import { MOTION, canAnimate, fadeIn } from '../motion';

// Text that changes the way instagram-follower-checker's empty-state texts
// do: when `k` changes, a copy of the old text is pinned exactly where it
// was drawn and fades out (captureGhost), while the new text fades in
// (fadeEmptyIn) — 450ms, cubic-bezier(0.4, 0, 0.2, 1), no rise. Same `k`:
// it stays as it is. Its box's height eases separately (AutoHeight).
function captureGhost(el) {
  if (!el || !el.getClientRects().length || !el.textContent.trim() || !canAnimate(el)) return null;
  const host = el.parentElement?.closest('.tool-meta, .tool-box, .tool') || document.body;
  const hr = host.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const ghost = el.cloneNode(true);
  const cs = getComputedStyle(el);
  Object.assign(ghost.style, {
    position: 'absolute', margin: '0', transform: 'none', animation: 'none',
    top: `${r.top - hr.top - host.clientTop + host.scrollTop}px`,
    left: `${r.left - hr.left - host.clientLeft}px`,
    width: `${r.width}px`, height: `${r.height}px`, boxSizing: 'border-box',
    textAlign: cs.textAlign, pointerEvents: 'none', zIndex: '3',
  });
  ghost.setAttribute('aria-hidden', 'true');
  return () => {
    host.appendChild(ghost);
    const drop = () => ghost.remove();
    ghost.animate([{ opacity: 1 }, { opacity: 0 }], { ...MOTION, fill: 'forwards' }).finished.then(drop, drop);
    setTimeout(drop, 800);
  };
}

export default class FadeText extends React.Component {
  ref = React.createRef();

  getSnapshotBeforeUpdate(prev) {
    return prev.k === this.props.k ? null : captureGhost(this.ref.current);
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
