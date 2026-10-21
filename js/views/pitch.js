import { deriveSituation, inSevenMeterZone, SEVEN_METER_LOCATION } from '../situation.js';
import { holdable } from '../hold.js';

const CLOSE_RANGE_CHOICES = [['durchbruch', 'Durchbruch'], ['kreis', 'Kreis'], ['einlaeufer', 'Einläufer']];
const MENU_RADIUS_PX = 130;
const MENU_BUTTON_PX = { w: 140, h: 64 }; // keeps the fan on screen near the edges

// Goal line on top, viewBox in meters (see situation.js), so tap coordinates need no extra scaling.
// Both lines are quarter circles around the goal posts (x = ±1.5) joined by a 3 m straight, as on a real court.
// The 9 m arc would end at x = ±10.5, so it is clipped at the sidelines.
const LINES = `
  <defs><clipPath id="court-clip"><rect x="-10" y="0" width="20" height="20"/></clipPath></defs>
  <image href="icons/logo.png" x="-4.5" y="10.2" width="9" height="9.42" opacity="0.25" pointer-events="none"/>
  <rect x="-10" y="0" width="20" height="20" fill="none" stroke="currentColor" stroke-opacity="0.45" stroke-width="0.12"/>
  <path d="M -7.5 0 A 6 6 0 0 0 -1.5 6 L 1.5 6 A 6 6 0 0 0 7.5 0 Z" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-width="0.16" stroke-linejoin="round"/>
  <path d="M -10.5 0 A 9 9 0 0 0 -1.5 9 L 1.5 9 A 9 9 0 0 0 10.5 0" clip-path="url(#court-clip)" fill="none" stroke="currentColor" stroke-width="0.12" stroke-dasharray="0.6 0.35"/>
  <line x1="-0.1" y1="4" x2="0.1" y2="4" stroke="currentColor" stroke-width="0.12"/>
  <line x1="-0.5" y1="${SEVEN_METER_LOCATION.y}" x2="0.5" y2="${SEVEN_METER_LOCATION.y}" stroke="currentColor" stroke-width="0.12"/>
  <rect x="-1.5" y="-0.3" width="3" height="0.3" fill="currentColor"/>`;

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const toCm = (v) => Math.round(v * 100) / 100;

// onStep(fields) fires once per tap with the shot fields of that tap (one undo step), e.g.
// { location, situation } for a short tap, { situation } for the close-range question,
// { location, situation: 'siebenmeter' } or { location, fastBreak: true } after a long press
// (next to the 7 m spot a menu offers both; anywhere else the long press is a fast break at once).
// Returns { setLocation(point | null, asking, result), setPrevious(point | null) } to show marker (colored by result), close-range choices and the previous shot's pin without firing callbacks.
export function mountPitch(el, { onStep }) {
  el.innerHTML = `<svg viewBox="-10 -0.5 20 21">${LINES}<circle class="pin" r="0.35" visibility="hidden"/><circle class="pin" r="0.35" opacity="0.35" visibility="hidden"/></svg>
    <div class="radial-menu"></div>
    <p class="hint">lang = Gegenstoß, am 7-m-Punkt auch 7m</p>`;
  const svg = el.querySelector('svg');
  const [marker, previous] = svg.querySelectorAll('circle');
  const menu = el.querySelector('.radial-menu');
  let shown = { p: null, asking: false, result: undefined }; // what the flow says, to restore after a long press without a pick

  // The screen CTM maps pixels to meters, whatever size the SVG is displayed at.
  // Taps next to the court (the pane is wider than the court) are clamped onto it.
  function toMeters({ x, y }) {
    const p = new DOMPoint(x, y).matrixTransform(svg.getScreenCTM().inverse());
    return { x: toCm(clamp(p.x, -10, 10)), y: toCm(clamp(p.y, 0, 20)) };
  }

  function toPixels(p) {
    return new DOMPoint(p.x, p.y).matrixTransform(svg.getScreenCTM());
  }

  // Buttons on a fan around a client-pixel point; angles in degrees, 90 = straight down (the goal is on top, so there is room below).
  function openMenu(items, center, angles) {
    const box = el.getBoundingClientRect();
    menu.replaceChildren(...items.map(([label, fields], i) => {
      const a = (angles[i] * Math.PI) / 180;
      const b = document.createElement('button');
      b.className = 'radial';
      b.textContent = label;
      b.style.left = `${clamp(center.x - box.left + Math.cos(a) * MENU_RADIUS_PX, MENU_BUTTON_PX.w / 2, box.width - MENU_BUTTON_PX.w / 2)}px`;
      b.style.top = `${clamp(center.y - box.top + Math.sin(a) * MENU_RADIUS_PX, MENU_BUTTON_PX.h / 2, box.height - MENU_BUTTON_PX.h / 2)}px`;
      b.onclick = () => onStep(fields);
      return b;
    }));
  }

  let down; // meters at touch-down: the screen may still be sliding in, so later pixels would map elsewhere
  holdable(svg, {
    onDown: (point) => { down = toMeters(point); },
    onShort() {
      onStep({ location: down, situation: deriveSituation(down) ?? undefined });
    },
    onLong(point) {
      const location = down;
      const fastBreak = { location, situation: undefined, fastBreak: true };
      if (!inSevenMeterZone(location)) return onStep(fastBreak); // a 7 m cannot be thrown from here
      openMenu([['7m', { location: SEVEN_METER_LOCATION, situation: 'siebenmeter' }], ['Gegenstoß', fastBreak]], point, [150, 30]);
    },
    // The finger is still down while the menu is open, so a pick is a release over a button.
    onRelease(point) {
      const button = document.elementFromPoint(point.x, point.y)?.closest('.radial');
      if (button) button.click();
      else api.setLocation(shown.p, shown.asking, shown.result);
    },
  });

  const api = {
    // Faded pin of the shot before a rebound.
    setPrevious(p) {
      previous.setAttribute('visibility', p ? 'visible' : 'hidden');
      if (p) {
        previous.setAttribute('cx', p.x);
        previous.setAttribute('cy', p.y);
      }
    },
    setLocation(p, asking, result) {
      shown = { p, asking, result };
      menu.replaceChildren();
      marker.dataset.result = result ?? '';
      marker.setAttribute('visibility', p ? 'visible' : 'hidden');
      if (!p) return;
      marker.setAttribute('cx', p.x);
      marker.setAttribute('cy', p.y);
      if (asking) openMenu(CLOSE_RANGE_CHOICES.map(([situation, label]) => [label, { situation }]), toPixels(p), [150, 90, 30]);
    },
  };
  return api;
}
