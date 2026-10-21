import { restoreFolder, chooseFolder, saveGame, saveDraft, loadDraft, clearDraft } from '../storage.js';
import { loadSettings, saveSettings, activeGoalkeepers, addItem, addGoalkeeper } from '../settings.js';
import { newGame } from '../schema.js';

const esc = (t) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const LINKS = `<div class="links"><a href="#/einstellungen">Einstellungen</a><a href="#/auswertung">Auswertung</a></div>`;

// First-run setup: folder, then goalkeepers, then opponents. Each step shows what was added so far.
const STEPS = {
  folder: 1,
  keepers: 2,
  opponents: 3,
};

function stepHeader(step, title) {
  return `<p class="steps">Einrichtung · Schritt ${STEPS[step]} von 3</p><h1>${title}</h1>`;
}

function setupNames(root, dir, settings, step) {
  const keepers = step === 'keepers';
  const names = keepers ? activeGoalkeepers(settings).map((g) => g.name) : settings.opponents;
  root.innerHTML = `<div class="screen">${stepHeader(step, keepers ? 'Torhüter' : 'Gegner')}
    ${names.map((n) => `<p>${esc(n)}</p>`).join('')}
    <div class="row"><input id="name" placeholder="Name" aria-label="Name"><button id="add" class="big">Hinzufügen</button></div>
    <button id="next" class="big start-button" ${names.length ? '' : 'disabled'}>Weiter</button><p id="msg" class="error"></p></div>`;
  root.onclick = async (e) => {
    if (e.target.id === 'add') {
      const name = root.querySelector('#name').value;
      const next = keepers ? addGoalkeeper(settings, name) : addItem(settings, 'opponents', name);
      if (next === settings) return;
      try {
        await saveSettings(dir, next);
      } catch {
        root.querySelector('#msg').textContent = 'Speichern fehlgeschlagen (Ordner weg oder keine Berechtigung).';
        return;
      }
      setupNames(root, dir, next, step);
    } else if (e.target.id === 'next') {
      if (keepers && !settings.opponents.length) setupNames(root, dir, settings, 'opponents');
      else renderStart(root);
    }
  };
}

export async function renderStart(root) {
  const dir = await restoreFolder().catch(() => null);
  if (!dir) {
    root.innerHTML = `<div class="screen">${stepHeader('folder', 'Spielordner')}<p>Hier werden alle Spiele gespeichert.</p>
      <button id="pick" class="big start-button">Ordner wählen</button><p id="msg" class="error"></p></div>`;
    root.querySelector('#pick').onclick = async () => {
      try {
        if (await chooseFolder()) renderStart(root);
      } catch (err) {
        root.querySelector('#msg').textContent = err.message;
      }
    };
    return;
  }

  const draft = await loadDraft().catch(() => null);
  if (draft) {
    // Offer the crash copy first so a new game can never silently overwrite it.
    root.innerHTML = `<div class="screen"><h1>Spielstart</h1>
      <p>Ein unfertiges Spiel gegen ${esc(draft.opponent || '?')} liegt vor.</p>
      <button id="resume" class="big start-button">Weiterführen</button>
      <button id="discard" class="big">Verwerfen</button></div>`;
    root.querySelector('#resume').onclick = () => { location.hash = '#/spiel'; };
    root.querySelector('#discard').onclick = async () => {
      await clearDraft();
      renderStart(root);
    };
    return;
  }

  const settings = await loadSettings(dir);
  const keepers = activeGoalkeepers(settings);
  if (!keepers.length || !settings.opponents.length) {
    setupNames(root, dir, settings, keepers.length ? 'opponents' : 'keepers');
    return;
  }

  let venue = 'heim';
  const options = (items) => items.map(([value, label]) => `<option value="${esc(value)}">${esc(label)}</option>`).join('');
  root.innerHTML = `<div class="screen"><h1>Spielstart</h1>
    <label>Gegner<select id="opponent">${options(settings.opponents.map((o) => [o, o]))}</select></label>
    <div class="row">
      <button class="big" data-venue="heim" aria-pressed="true">Heim</button>
      <button class="big" data-venue="auswaerts" aria-pressed="false">Auswärts</button>
    </div>
    <label>Torwart im Tor<select id="keeper">${options(keepers.map((g) => [g.id, g.name]))}</select></label>
    <button id="start" class="start-button">Anpfiff</button><p id="msg" class="error"></p>${LINKS}</div>`;

  root.onclick = async (e) => {
    if (e.target.dataset.venue) {
      venue = e.target.dataset.venue;
      for (const b of root.querySelectorAll('[data-venue]')) b.setAttribute('aria-pressed', String(b === e.target));
    } else if (e.target.id === 'start') {
      const game = newGame({
        opponent: root.querySelector('#opponent').value,
        venue,
        startGoalkeeperId: root.querySelector('#keeper').value,
      });
      try {
        await saveDraft(game); // crash copy first: it is the one that must not fail
        await saveGame(dir, game);
      } catch (err) {
        root.querySelector('#msg').textContent = err.message;
        return;
      }
      location.hash = '#/spiel';
    }
  };
}
