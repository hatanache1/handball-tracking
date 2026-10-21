import { holdable } from '../hold.js';
import { describe, timeLabel, listedEvents } from '../eventlist.js';

export const END_HOLD_MS = 1500;
const SWIPE_PX = 60; // finger travel that counts as a swipe, not a tap
const TAP_PX = 10;

// Drawer with everything rare: keeper switch, half correction, list of shots and own goals, end of game.
// Callbacks: onPick(id) tap on a shot, onDelete(id), onKeeper(id), onHalfBack(), onEnd() after the long press.
// set({ events, keepers, keeperId, half }) redraws without firing callbacks.
export function mountSidebar(el, { onPick, onDelete, onKeeper, onHalfBack, onEnd }) {
  el.className = 'sidebar';
  el.innerHTML = `<div class="drawer-backdrop"></div>
    <aside class="drawer" inert>
      <div class="drawer-head"><h2>Menü</h2><button class="big" id="drawer-close" aria-label="Menü schließen">✕</button></div>
      <h3>Torwart im Tor</h3><div class="keepers"></div>
      <button class="big" id="half-back">Korrektur: zurück zur 1. HZ</button>
      <h3>Würfe und Tore</h3><p class="note">nach links wischen = löschen</p><ul class="event-list"></ul>
      <button class="big end-button" id="end-game">Spiel beenden · 1,5 s halten</button>
    </aside>`;
  const drawer = el.querySelector('.drawer');
  const keepersEl = el.querySelector('.keepers');
  const listEl = el.querySelector('.event-list');
  const halfBack = el.querySelector('#half-back');

  const api = {
    open() { el.dataset.open = 'true'; drawer.inert = false; },
    close() { el.dataset.open = 'false'; drawer.inert = true; },
    set({ events, keepers, keeperId, half }) {
      // Built with textContent/dataset so names and notes are never read as HTML.
      keepersEl.replaceChildren(...keepers.map((g) => {
        const b = document.createElement('button');
        b.className = 'big';
        b.textContent = g.name;
        b.setAttribute('aria-pressed', g.id === keeperId);
        b.onclick = () => onKeeper(g.id);
        return b;
      }));
      halfBack.hidden = half !== 2;
      listEl.replaceChildren(...listedEvents(events).map(row));
    },
  };
  api.close();
  el.querySelector('.drawer-backdrop').onclick = api.close;
  el.querySelector('#drawer-close').onclick = api.close;
  halfBack.onclick = onHalfBack;
  holdable(el.querySelector('#end-game'), { holdMs: END_HOLD_MS, onShort() {}, onLong: onEnd }); // a short tap does nothing on purpose

  // Swipe left shows "Löschen", the tap on it deletes. A tap on a shot opens it for editing.
  function row(event) {
    const li = document.createElement('li');
    const item = document.createElement('button');
    const del = document.createElement('button');
    const open = event.type === 'shot' && event.result === undefined;
    item.className = open ? 'item open' : 'item';
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.dataset.result = event.result ?? '';
    item.append(dot, `${timeLabel(event)} · ${event.type === 'shot' ? describe(event) : 'Tor für uns'}`);
    del.className = 'del';
    del.textContent = 'Löschen';
    del.onclick = () => onDelete(event.id);
    li.append(del, item);

    let startX = null;
    item.addEventListener('pointerdown', (e) => { startX = e.clientX; item.setPointerCapture(e.pointerId); });
    item.addEventListener('pointercancel', () => { startX = null; });
    item.addEventListener('pointerup', (e) => {
      if (startX === null) return;
      const dx = e.clientX - startX;
      startX = null;
      if (dx < -SWIPE_PX) {
        listEl.querySelectorAll('.swiped').forEach((other) => other.classList.remove('swiped'));
        li.classList.add('swiped');
      } else if (dx > SWIPE_PX || (Math.abs(dx) < TAP_PX && li.classList.contains('swiped'))) li.classList.remove('swiped');
      else if (Math.abs(dx) < TAP_PX && event.type === 'shot') onPick(event.id);
    });
    return li;
  }
  return api;
}
