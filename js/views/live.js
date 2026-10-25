import { restoreFolder, saveGame, saveDraft, loadDraft, clearDraft } from '../storage.js';
import { newEvent } from '../schema.js';
import { loadSettings, activeGoalkeepers } from '../settings.js';
import { idbGet, idbSet } from '../idb.js';
import { newClock, clockSec, isRunning, adjust, firstHalfOver, tap, switchHalf } from '../clock.js';
import { score } from '../score.js';
import { emptyFlow, addStep, undo, cancel, shotFields, isComplete, parkable, withFlow, flowFromShot } from '../shotflow.js';
import { holdable } from '../hold.js';
import { mountPitch } from './pitch.js';
import { mountGoal } from './goal.js';
import { mountNumpad } from './numpad.js';
import { mountChips } from './chips.js';
import { mountSidebar } from './sidebar.js';
import { describe, timeLabel, removeEvent } from '../eventlist.js';

const TOAST_MS = 1500;
const ALERT_MS = 800; // how long the clock glows red after a tap on a stopped clock
const DRAG_STEP_PX = 24; // finger travel on the clock for one minute or one second

export async function renderLive(root) {
  const dir = await restoreFolder().catch(() => null);
  const game = await loadDraft().catch(() => null);
  if (!game) {
    root.innerHTML = `<h1>Spiel</h1><p>Kein laufendes Spiel. Bitte unter Start ein Spiel beginnen.</p>`;
    return;
  }

  const clockKey = 'clock'; // separate from the game, so the game schema stays unchanged
  let clock = await idbGet(clockKey).catch(() => null);
  if (!clock || clock.gameId !== game.id) clock = newClock(game.id);

  root.innerHTML = `<div class="liveview">
  <div class="topbar">
    <button class="big" id="menu" aria-label="Menü">☰</button>
    <span class="score">Wir <b id="own"></b> <button class="big" id="ownGoal" aria-label="Tor für uns">+1</button> : <b id="against"></b> Gegner</span>
    <div class="clock" id="clock" role="button" tabindex="0">
      <span id="digits"><small id="half"></small> <span data-unit="min"></span>:<span data-unit="sec"></span></span>
      <span id="nextHalf" hidden>2. HZ ▶</span>
    </div>
    <span class="stepper"><span>① Ort</span><span>② Tor</span><span>③ Details</span></span>
    <button class="big" id="undo">↶ Zurück</button>
    <button class="big" id="rebound">Nachwurf</button>
  </div>
  <div class="stage" data-view="pitch" data-panel="closed">
    <div class="pane pane-pitch"></div>
    <div class="pane pane-goal"></div>
    <div class="prev-card" hidden></div>
    <span class="badge" hidden>Nachwurf</span>
    <div class="edit-badge" hidden><span></span><button class="big" id="edit-close" aria-label="Bearbeiten beenden">✕</button></div>
    <div class="sidebar-mount"></div>
    <div class="toast" role="status"></div>
    <p id="msg" class="error overlay"></p>
    <aside class="detail-panel" inert>
      <div class="numpad-box"></div>
      <div class="chips-box"></div>
    </aside>
  </div>
  </div>`;
  const msg = root.querySelector('#msg');
  const undoButton = root.querySelector('#undo');
  const stage = root.querySelector('.stage');
  const pitchPane = root.querySelector('.pane-pitch');
  const goalPane = root.querySelector('.pane-goal');
  const panel = root.querySelector('.detail-panel');
  const prevCard = root.querySelector('.prev-card');
  const badge = root.querySelector('.badge');
  const toastEl = root.querySelector('.toast');
  const editBadge = root.querySelector('.edit-badge');
  const stepperSteps = [...root.querySelectorAll('.stepper span')];
  const reboundButton = root.querySelector('#rebound');
  let flow = emptyFlow();
  // Id of the saved shot that the flow belongs to: once a shot has a result (or was undone from it) it stays saved and every change is written to it.
  let editingId = null;
  let previousId = null; // the shot before a rebound, shown as "Vorwurf"
  let editMode = false; // true while a saved shot is opened from the side list; undo then stops at the saved state
  let toastTimer;
  const settings = await loadSettings(dir); // falls back to empty settings (no chips) if the folder is unavailable

  const pitch = mountPitch(pitchPane, { onStep: step });
  const goal = mountGoal(goalPane, { onTap: step });
  const numpad = mountNumpad(root.querySelector('.numpad-box'), { onDigit });
  const chips = mountChips(root.querySelector('.chips-box'), settings.chips, { onTags, onNote });
  // Short = one tap back (also the result, the shot stays saved without it); long = discard the half-captured shot.
  holdable(undoButton, { onShort: onUndo, onLong: onCancel });
  reboundButton.onclick = () => {
    park();
    editMode = false;
    lastGoalId = null;
    editingId = null;
    previousId = game.events.findLast((e) => e.type === 'shot')?.id;
    flow = addStep(emptyFlow(), { rebound: true });
    show();
  };
  const sidebar = mountSidebar(root.querySelector('.sidebar-mount'), { onPick, onDelete, onKeeper, onHalfBack, onEnd });
  root.querySelector('#menu').onclick = () => { refreshSidebar(); sidebar.open(); };
  editBadge.querySelector('button').onclick = () => { exitEdit(); show(); };
  const ownEl = root.querySelector('#own');
  const againstEl = root.querySelector('#against');
  const clockEl = root.querySelector('#clock');
  const digitsEl = root.querySelector('#digits');
  const halfEl = root.querySelector('#half');
  const minEl = root.querySelector('[data-unit="min"]');
  const secEl = root.querySelector('[data-unit="sec"]');
  const nextHalfEl = root.querySelector('#nextHalf');
  // Id of a "Tor für uns" that Zurück may still take back: only while no shot is half-captured, gone with the next action.
  let lastGoalId = null;
  root.querySelector('#ownGoal').onclick = () => {
    addEvent('ownGoal');
    const half = flow.steps.length > 0 && !isComplete(flow);
    lastGoalId = half ? null : game.events.at(-1).id;
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) ownEl.animate({ transform: ['scale(1)', 'scale(1.6)', 'scale(1)'] }, 300);
    save();
    show();
  };
  // Tap = start/stop, drag up/down on the minutes or seconds = forward/back. Only the first finger counts.
  let drag = null; // { id, y, unit, steps }
  clockEl.addEventListener('pointerdown', (e) => {
    if (drag) return;
    clockEl.setPointerCapture(e.pointerId);
    drag = { id: e.pointerId, y: e.clientY, unit: e.target.closest('[data-unit]')?.dataset.unit, steps: 0, moved: false };
  });
  clockEl.addEventListener('pointermove', (e) => {
    if (!drag?.unit || e.pointerId !== drag.id) return;
    const steps = Math.trunc((drag.y - e.clientY) / DRAG_STEP_PX); // up = forward
    if (steps === drag.steps) return;
    setClock(adjust(clock, (steps - drag.steps) * (drag.unit === 'min' ? 60 : 1)));
    drag.steps = steps;
    drag.moved = true;
  });
  clockEl.addEventListener('pointerup', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.moved) setClock(tap(clock));
    drag = null;
  });
  clockEl.addEventListener('pointercancel', () => { drag = null; });
  clockEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setClock(tap(clock)); }
  });
  // The interval stops itself once the view has been replaced.
  const timer = setInterval(() => (clockEl.isConnected ? showTime() : clearInterval(timer)), 250);

  const currentKeeper = () => game.events.findLast((e) => e.type === 'goalkeeperSwitch')?.goalkeeperId ?? game.startGoalkeeperId;

  function showTime() {
    const sec = clockSec(clock);
    const next = firstHalfOver(clock);
    halfEl.textContent = `${clock.half}. HZ`;
    minEl.textContent = String(Math.floor(sec / 60)).padStart(2, '0');
    secEl.textContent = String(sec % 60).padStart(2, '0');
    digitsEl.hidden = next;
    nextHalfEl.hidden = !next;
    clockEl.classList.toggle('stopped', !isRunning(clock)); // orange and pulsing, so a stopped clock is hard to miss
  }

  function showTop() {
    const { own, against } = score(game.events);
    ownEl.textContent = own;
    againstEl.textContent = against;
    showTime();
  }

  function setClock(next) {
    clock = next;
    idbSet(clockKey, clock).catch((err) => { msg.textContent = `Uhr konnte nicht gespeichert werden: ${err.message}`; });
    showTop();
  }

  function addEvent(type, fields) {
    game.events.push(newEvent(type, clock.half, clockSec(clock), fields));
  }

  show();

  // Redraws both views from the flow, so undo and cancel need no special cases.
  function show() {
    const { location, situation, target, result, fastBreak, rebound, shooterNumber, tags, note } = shotFields(flow);
    const done = isComplete(flow); // a result means the shot is finished: back to the pitch, detail panel open
    pitch.setLocation(location ?? null, Boolean(location) && !situation && !fastBreak, result);
    goal.setTarget(target ?? null, result);
    // The goal screen takes over as soon as the location is complete (situation known, or a fast break, which has none).
    const onGoal = !done && Boolean(location) && Boolean(situation || fastBreak);
    stage.dataset.view = onGoal ? 'goal' : 'pitch';
    stage.dataset.panel = done ? 'open' : 'closed';
    pitchPane.inert = onGoal;
    goalPane.inert = !onGoal;
    panel.inert = !done;
    const now = done ? 3 : onGoal ? 2 : 1;
    // Editing a saved shot: a tick marks every step that already has data.
    const has = [placed(flow), done, Boolean(shooterNumber || tags?.length || note)];
    stepperSteps.forEach((s, i) => {
      s.dataset.state = i + 1 === now ? 'now' : (editMode ? has[i] : i + 1 < now) ? 'done' : '';
    });
    reboundButton.setAttribute('aria-pressed', Boolean(rebound));
    // Previous shot only while the rebound has no result yet.
    const waiting = Boolean(rebound) && !done && !editMode;
    const previous = waiting ? game.events.find((e) => e.id === previousId) : undefined;
    badge.hidden = !waiting;
    prevCard.hidden = !previous;
    prevCard.textContent = previous ? `Vorwurf: ${describe(previous)}` : '';
    prevCard.classList.toggle('open', previous?.result === undefined);
    pitch.setPrevious(previous?.location ?? null);
    numpad.set(shooterNumber ?? null);
    chips.set(tags, note);
    editBadge.hidden = !editMode;
    const edited = game.events.find((e) => e.id === editingId);
    if (editMode && edited) editBadge.firstChild.textContent = `Bearbeite Wurf ${timeLabel(edited)}`;
    undoButton.disabled = flow.steps.length <= (editMode ? 1 : 0) && !lastGoalId;
    showTop(); // a shot result can change the score
  }

  // Pitch and goal taps. A tap on the pitch while the detail panel is open closes it and starts the next shot.
  // A saved shot opened for its missing location is the exception: the tap sets the location.
  function step(fields) {
    // A new shot needs a running clock, otherwise its time stamp would be wrong; completing or editing a shot is always allowed.
    const startsShot = isComplete(flow) ? !(editMode && !placed(flow)) : !editMode && !shotFields(flow).location;
    if (startsShot && !isRunning(clock)) {
      clockEl.classList.add('alert');
      setTimeout(() => clockEl.classList.remove('alert'), ALERT_MS);
      return;
    }
    if (isComplete(flow) && !(editMode && !placed(flow))) exitEdit();
    push(fields);
  }

  // The location is complete once the situation is known, or it is a fast break (which has none).
  function placed(f) {
    const { location, situation, fastBreak } = shotFields(f);
    return Boolean(location && (situation || fastBreak));
  }

  // Back to the normal pitch with nothing pending; the saved shot stays as it is.
  function exitEdit() {
    editMode = false;
    editingId = null;
    flow = emptyFlow();
  }

  // One undo step; saved at once. The first result saves the shot, later changes (including detail input) go to the saved shot.
  function push(fields) {
    lastGoalId = null;
    const hadResult = isComplete(flow);
    const wasFull = hadResult && placed(flow);
    flow = addStep(flow, fields);
    if (editingId) saveEdit();
    else if (isComplete(flow)) finish();
    if (!hadResult && isComplete(flow)) toast(`✓ ${describe(shotFields(flow))}`, shotFields(flow).result);
    if (editMode && !wasFull && isComplete(flow) && placed(flow)) exitEdit(); // the missing piece is in: shot is complete
    show();
  }

  function toast(text, result) {
    toastEl.textContent = text;
    toastEl.dataset.result = result ?? '';
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), TOAST_MS);
  }

  function onUndo() {
    if (lastGoalId) {
      game.events.splice(game.events.findIndex((e) => e.id === lastGoalId), 1);
      lastGoalId = null;
      save();
      show();
      return;
    }
    if (editMode && flow.steps.length <= 1) return; // the saved state is the floor, deleting is done in the list
    flow = undo(flow);
    if (editingId) (parkable(flow) ? saveEdit() : dropSaved()); // nothing left to keep of this shot
    show();
  }

  // Long press on Zurück. A finished shot is not "half-captured", so it stays (deleting is done in the side list).
  function onCancel() {
    if (isComplete(flow) || editMode) return;
    if (editingId) dropSaved();
    flow = cancel(flow);
    show();
  }

  function dropSaved() {
    game.events.splice(game.events.findIndex((e) => e.id === editingId), 1);
    editingId = null;
    save();
  }

  // Saves the half-captured new shot as an open shot, so the rebound loses nothing.
  function park() {
    const fields = editingId ? null : parkable(flow);
    if (!fields) return;
    addShot(fields);
    save();
  }

  // Jersey numbers are 1-99: a third digit or a leading 0 is ignored.
  function onDigit(digit) {
    const next = (shotFields(flow).shooterNumber ?? 0) * 10 + digit;
    if (next >= 1 && next <= 99) push({ shooterNumber: next });
  }

  function onTags(tags) {
    push({ tags });
  }

  // Typing a note is one undo step, not one per keystroke: consecutive note edits replace each other.
  function onNote(text) {
    const last = flow.steps.at(-1);
    if (last && Object.keys(last).join() === 'note') flow = undo(flow);
    push({ note: text || undefined });
  }

  // Edits are saved after every tap, like new shots.
  function saveEdit() {
    const i = game.events.findIndex((e) => e.id === editingId);
    game.events[i] = withFlow(game.events[i], flow);
    save();
  }

  function addShot(fields) {
    addEvent('shot', { ...fields, goalkeeperId: currentKeeper() });
  }

  // Saves are chained so an older snapshot can never overwrite a newer one.
  let saving = Promise.resolve();
  function finish() {
    addShot(shotFields(flow));
    editingId = game.events.at(-1).id; // the flow stays: the detail panel edits this saved shot
    save();
  }

  function save() {
    return (saving = saving.then(async () => {
      try {
        await saveDraft(game); // crash copy first: it is the one that must not fail
        if (!dir) throw new Error('Spielordner nicht verfügbar. Die Kopie im Browser bleibt erhalten.');
        await saveGame(dir, game);
        msg.textContent = '';
      } catch (err) {
        msg.textContent = err.message;
      }
    }));
  }

  const refreshSidebar = () => sidebar.set({ events: game.events, keepers: activeGoalkeepers(settings), keeperId: currentKeeper(), half: clock.half });

  // Tap on a shot in the list: it opens at the first missing step. A half-captured shot of our own is parked as open first.
  function onPick(id) {
    const shot = game.events.find((e) => e.id === id);
    if (!shot) return;
    park();
    sidebar.close();
    lastGoalId = null;
    previousId = null;
    editingId = id;
    editMode = true;
    flow = flowFromShot(shot);
    show();
  }

  function onDelete(id) {
    game.events = removeEvent(game.events, id);
    if (id === editingId) exitEdit();
    if (id === lastGoalId) lastGoalId = null;
    save();
    refreshSidebar();
    show();
  }

  function onKeeper(id) {
    if (id === currentKeeper()) return;
    addEvent('goalkeeperSwitch', { goalkeeperId: id });
    lastGoalId = null;
    save();
    refreshSidebar();
    show();
  }

  // Correction for a mis-tap on "2. HZ ▶": the clock goes back to 30:00 of the 1st half.
  function onHalfBack() {
    setClock(switchHalf(clock));
    refreshSidebar();
  }

  // Only ends the game when the file is written; otherwise the error stays visible and the crash copy stays.
  async function onEnd() {
    park();
    await save();
    if (msg.textContent) return;
    await clearDraft();
    location.hash = `#/auswertung/${game.id}`; // straight to the evaluation of the game just ended
  }
}
