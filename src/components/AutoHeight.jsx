import React, { useLayoutEffect, useRef } from 'react';
import { easeBoxHeight, isRunning, registerHeightBox } from '../heightMotion';

// A box whose height eases to fit its content whenever the content changes
// size — something added, removed, swapped or reflowed — on the app's one
// motion (instagram-follower-checker's 450ms cubic-bezier(0.4, 0, 0.2, 1)).
// A change mid-resize carries on from the height drawn right now. Inside
// another easing box, only the outer one moves (see heightMotion.js).
//
// `className`/`style` go on the box (borders, padding, background);
// `innerClassName` on the content inside it (its layout).
export default function AutoHeight({ className = '', innerClassName = '', style, children, boxRef, ...rest }) {
  const outer = useRef(null);
  const inner = useRef(null);

  useLayoutEffect(() => {
    const box = outer.current;
    const content = inner.current;
    if (boxRef) boxRef.current = box;
    // Layout sizes (offsetHeight): a scale on something around it mid-fade must not count
    const chrome = () => {
      const cs = getComputedStyle(box);
      return ['paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth']
        .reduce((sum, k) => sum + (parseFloat(cs[k]) || 0), 0);
    };
    const c = {
      box,
      content,
      measure: () => content.offsetHeight + chrome(),
      last: 0,
      running: () => isRunning(box._heightAnim),
      animatesChanges: () => true,
      update(to, animate) {
        // Where it's drawn: partway if it's mid-ease, else its old height (by
        // now the box has already laid out at the new one)
        const from = c.running() ? box.offsetHeight : c.last;
        c.last = to;
        if (animate) {
          easeBoxHeight(box, to, { from, prev: box._heightAnim });
        } else {
          box._heightAnim?.cancel();
          box._heightAnim = null;
          box.style.overflow = '';
        }
      },
    };
    c.last = c.measure();
    const unregister = registerHeightBox(c);
    return () => {
      unregister();
      box._heightAnim?.cancel();
    };
  }, [boxRef]);

  return (
    <div ref={outer} className={className} style={style} {...rest}>
      <div ref={inner} className={`auto-height-inner ${innerClassName}`}>
        {children}
      </div>
    </div>
  );
}
