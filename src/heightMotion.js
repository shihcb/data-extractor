// Height easing for boxes that hold other boxes (AutoHeight, Collapse).
//
// One ResizeObserver watches every box's content, so all the sizes that
// changed in a frame arrive together, after layout and before paint. Of the
// boxes that changed, only the outermost animates: one 450ms ease from where
// it's drawn to its new height, with the boxes inside it settling straight
// to their new sizes underneath. (Each animating on its own, the outer one
// chased the inner one's moving height and lagged behind it.)
//
// A box registers { box, content, measure(), last, animatesNow(), update(to, animate) }.

const boxes = new Map(); // content element -> controller
let observer = null;

function controllerOf(el) {
  return el?._heightMotion || null;
}

// The registered boxes around this one, nearest first
function ancestors(c) {
  const out = [];
  let el = c.box.parentElement;
  while (el) {
    const a = controllerOf(el);
    if (a) out.push(a);
    el = el.parentElement;
  }
  return out;
}

function onResize(entries) {
  const changed = [];
  for (const entry of entries) {
    const c = boxes.get(entry.target);
    if (!c) continue;
    const to = c.measure();
    if (Math.abs(to - c.last) >= 0.5) changed.push([c, to]);
  }
  if (!changed.length) return;
  const changedSet = new Set(changed.map(([c]) => c));
  for (const [c, to] of changed) {
    // An outer box that's moving (or about to, this frame) carries this one
    const carried = ancestors(c).some(a => a.running() || (changedSet.has(a) && a.animatesChanges()));
    c.update(to, !carried);
  }
}

export function registerHeightBox(c) {
  if (typeof ResizeObserver !== 'function') return () => {};
  observer = observer || new ResizeObserver(onResize);
  c.box._heightMotion = c;
  boxes.set(c.content, c);
  observer.observe(c.content);
  return () => {
    observer.unobserve(c.content);
    boxes.delete(c.content);
    if (c.box._heightMotion === c) c.box._heightMotion = null;
  };
}

// How much taller (negative: shorter) the page is still going to get from
// the boxes easing right now: each outermost moving box, from the height
// it's drawn at to the one it's heading for. Lets the page move with a box
// from its first frame instead of chasing it once it has moved.
export function heightStillToCome() {
  let d = 0;
  boxes.forEach(c => {
    if (!c.running() || ancestors(c).some(a => a.running())) return;
    d += c.last - c.box.offsetHeight;
  });
  return d;
}
