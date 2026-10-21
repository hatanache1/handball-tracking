import { restoreFolder, chooseFolder } from '../storage.js';
import {
  loadSettings, saveSettings, activeGoalkeepers,
  addItem, renameItem, removeItem, addGoalkeeper, renameGoalkeeper, removeGoalkeeper,
} from '../settings.js';

const esc = (t) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const BACK = '<a class="back" href="#/start">← Spielstart</a>';

export async function renderSettings(root) {
  const dir = await restoreFolder().catch(() => null);
  if (!dir) {
    root.innerHTML = `${BACK}<h1>Einstellungen</h1><p>Bitte zuerst den Spielordner wählen.</p>
      <button id="pick" class="big">Ordner wählen</button><p id="msg" class="error"></p>`;
    root.querySelector('#pick').onclick = async () => {
      try {
        if (await chooseFolder()) renderSettings(root);
      } catch (err) {
        root.querySelector('#msg').textContent = err.message;
      }
    };
    return;
  }

  let settings = await loadSettings(dir);
  let error = '';

  // Saves right after every change so nothing is lost on a crash.
  async function change(next) {
    settings = next;
    try {
      await saveSettings(dir, settings);
      error = '';
    } catch {
      error = 'Speichern fehlgeschlagen (Ordner weg oder keine Berechtigung).';
    }
    draw();
  }

  // Rows are { key, name }; key is the index for string lists and the id for goalkeepers.
  function listHtml(title, listId, rows) {
    return `<section data-list="${listId}"><h2>${title}</h2>
      ${rows.map((r) => `<div class="row" data-key="${esc(String(r.key))}">
        <input value="${esc(r.name)}" aria-label="Name">
        <button class="big" data-act="remove">Entfernen</button></div>`).join('')}
      <div class="row"><input data-new placeholder="Neu hinzufügen" aria-label="Neu">
        <button class="big" data-act="add">Hinzufügen</button></div></section>`;
  }

  function draw() {
    root.innerHTML = `${BACK}<h1>Einstellungen</h1><p class="error">${esc(error)}</p>
      ${listHtml('Gegner', 'opponents', settings.opponents.map((name, key) => ({ key, name })))}
      ${listHtml('Torwarte', 'goalkeepers', activeGoalkeepers(settings).map((g) => ({ key: g.id, name: g.name })))}
      ${listHtml('Kommentar-Chips', 'chips', settings.chips.map((name, key) => ({ key, name })))}`;
  }

  root.onclick = (e) => {
    const act = e.target.dataset.act;
    if (!act) return;
    const row = e.target.closest('.row');
    const list = row.closest('section').dataset.list;
    if (act === 'add') {
      const name = row.querySelector('[data-new]').value;
      change(list === 'goalkeepers' ? addGoalkeeper(settings, name) : addItem(settings, list, name));
    } else if (list === 'goalkeepers') {
      change(removeGoalkeeper(settings, row.dataset.key));
    } else {
      change(removeItem(settings, list, Number(row.dataset.key)));
    }
  };

  // Rename on commit (blur/Enter), not per keystroke.
  root.onchange = (e) => {
    const row = e.target.closest('.row');
    if (!row || e.target.hasAttribute('data-new')) return;
    const list = row.closest('section').dataset.list;
    change(list === 'goalkeepers'
      ? renameGoalkeeper(settings, row.dataset.key, e.target.value)
      : renameItem(settings, list, Number(row.dataset.key), e.target.value));
  };

  draw();
}
