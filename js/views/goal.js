import { goalZone, GOAL_WIDTH_M as W, GOAL_HEIGHT_M as H, FRAME_TOLERANCE_M } from '../goal.js';
import { holdable } from '../hold.js';

const PIN_RADIUS_M = 0.12;

// SVG units are meters; the SVG y axis points down, so svgY = -y. The viewBox leaves 1 m around
// the goal; the SVG itself fills the whole screen, so the free area around the goal is all "vorbei".
// onTap({ target, result }) fires once per tap: inside the goal short = 'tor', long = 'gehalten';
// on the frame 'pfosten' and outside 'vorbei' at once (short or long makes no difference).
// Returns { setTarget(point | null, result) } to show or clear a pin (colored by result) without firing callbacks (for undo / editing).
export function mountGoal(el, { onTap }) {
  const grid = [1, 2].map((i) => `<line x1="${i}" y1="0" x2="${i}" y2="${-H}"/>
    <line x1="0" y1="${-i * H / 3}" x2="${W}" y2="${-i * H / 3}"/>`).join('');
  el.innerHTML = `<svg viewBox="-0.5 -2.5 ${W + 1} ${H + 1}">
      <rect x="0" y="${-H}" width="${W}" height="${H}" fill="#fff"/>
      <g stroke="#9aa5b8" stroke-width="0.02">${grid}</g>
      <path d="M0 0V${-H}H${W}V0" fill="none" stroke="#14213d" stroke-opacity="0.2" stroke-width="${FRAME_TOLERANCE_M * 2}"/>
      <path d="M0 0V${-H}H${W}V0" fill="none" stroke="#14213d" stroke-width="0.06"/>
      <line x1="-1" y1="0" x2="${W + 1}" y2="0" stroke="#14213d" stroke-width="0.03"/>
      <circle class="pin" r="${PIN_RADIUS_M}" stroke="#14213d" stroke-width="0.03" display="none"/>
    </svg>
    <p class="hint">kurz = Tor · lang = gehalten</p>`;

  const svg = el.querySelector('svg');
  const pin = el.querySelector('circle');

  function toMeters({ x, y }) {
    const pt = new DOMPoint(x, y).matrixTransform(svg.getScreenCTM().inverse());
    // Round to cm: more precision than a finger has.
    return { x: Math.round(pt.x * 100) / 100, y: Math.round(-pt.y * 100) / 100 };
  }

  const tap = (target, result) => onTap({ target, result });

  let down; // meters at touch-down: the screen may still be sliding in, so later pixels would map elsewhere
  holdable(svg, {
    // Frame and outside need no hold: decided on touch-down.
    onDown(point) {
      down = toMeters(point);
      const zone = goalZone(down.x, down.y);
      if (zone === 'innen') return true;
      tap(down, zone === 'rahmen' ? 'pfosten' : 'vorbei');
      return false;
    },
    onShort: () => tap(down, 'tor'),
    onLong: () => tap(down, 'gehalten'),
  });

  return {
    setTarget(p, result) {
      pin.dataset.result = result ?? '';
      pin.setAttribute('display', p ? 'inline' : 'none');
      if (p) {
        pin.setAttribute('cx', p.x);
        pin.setAttribute('cy', -p.y);
      }
    },
  };
}
