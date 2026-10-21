// Short tap vs. long press on one element, with a progress ring around the finger.
export const HOLD_MS = 400;

// Points passed to the callbacks are client pixels: { x, y }.
// onDown(point) may return false to skip the hold logic (the caller handled the tap itself).
// onShort(point): finger lifted before HOLD_MS. onLong(point): HOLD_MS reached, finger still down.
// onRelease(point): finger lifted after a long press (used to pick from a menu opened by onLong).
// holdMs defaults to HOLD_MS; destructive buttons ask for longer.
export function holdable(el, { onDown, onShort, onLong, onRelease, holdMs = HOLD_MS }) {
  let press = null; // { id, start, ring, timer, long }

  // Touch long-press would otherwise open the browser's context menu.
  el.addEventListener('contextmenu', (e) => e.preventDefault());

  el.addEventListener('pointerdown', (e) => {
    if (press) return; // only the first finger counts
    const start = { x: e.clientX, y: e.clientY };
    if (onDown?.(start) === false) return;
    el.setPointerCapture(e.pointerId);
    const ring = makeRing(start, holdMs);
    const timer = setTimeout(() => {
      press.long = true;
      ring.remove();
      onLong(start);
    }, holdMs);
    press = { id: e.pointerId, start, ring, timer, long: false };
  });

  el.addEventListener('pointerup', (e) => {
    if (!press || e.pointerId !== press.id) return;
    const { start, long } = press;
    end();
    if (long) onRelease?.({ x: e.clientX, y: e.clientY });
    else onShort(start); // the place of the first touch, not where the finger slid to
  });

  el.addEventListener('pointercancel', (e) => {
    if (press && e.pointerId === press.id) end();
  });

  function end() {
    clearTimeout(press.timer);
    press.ring.remove();
    press = null;
  }
}

function makeRing({ x, y }, holdMs) {
  const ring = document.createElement('div');
  ring.className = 'hold-ring';
  ring.style.cssText = `left:${x}px;top:${y}px;--hold-ms:${holdMs}ms`;
  ring.innerHTML = '<svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="34" pathLength="100"/></svg>';
  document.body.append(ring);
  return ring;
}
