import { restoreFolder, hasFolder, listGames, loadGame, deleteGame } from '../storage.js';
import { holdable } from '../hold.js';
import { END_HOLD_MS } from './sidebar.js';
import { loadSettings } from '../settings.js';
import { score, scoreSeries } from '../score.js';
import { collectShots, forGoalkeeper, ratio, byHalf, special } from '../stats.js';
import { describe, timeLabel } from '../eventlist.js';
import { lineChart } from '../charts/line.js';

export const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const VENUE = { heim: 'Heim', auswaerts: 'Auswärts' };
const date = (iso) => new Date(iso).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });

// "40 %, 2/5" (the count is always shown); values below the minimum sample are greyed out by the "low" class.
export const ratioText = (r) => (r.rate === null ? `– (${r.total} Würfe)` : `${Math.round(r.rate * 100)} %, ${r.hits}/${r.total}`);

export function ratioTile(label, r) {
  return `<div class="stat${r.lowSample ? ' low' : ''}"><span class="stat-label">${esc(label)}</span><span class="stat-value">${ratioText(r)}</span></div>`;
}

// Runs onReady(dir) once the folder is usable. After a browser restart the permission has to be
// granted again, and the browser only allows that prompt from a tap, hence the button.
export async function withFolder(root, back, title, onReady) {
  const dir = await restoreFolder().catch(() => null);
  if (dir) return onReady(dir);
  if (!(await hasFolder().catch(() => false))) {
    root.innerHTML = `${back}<h1>${title}</h1><p>Noch kein Spielordner gewählt. Bitte in den Einstellungen wählen.</p>
      <a class="big-link" href="#/einstellungen">Zu den Einstellungen</a>`;
    return;
  }
  root.innerHTML = `${back}<h1>${title}</h1><p>Der Browser braucht neu die Erlaubnis für den Spielordner.</p>
    <button id="grant" class="big start-button">Ordner freigeben</button><p id="msg" class="error"></p>`;
  root.onclick = async (e) => {
    if (e.target.id !== 'grant') return;
    const granted = await restoreFolder(true).catch(() => null);
    if (granted) onReady(granted);
    else root.querySelector('#msg').textContent = 'Zugriff nicht erteilt. Bitte erneut tippen und "Zulassen" wählen.';
  };
}

// --- List of all saved games ---

export function renderGameList(root) {
  const back = '<a class="back" href="#/start">← Spielstart</a>';
  return withFolder(root, back, 'Auswertung', async (dir) => {
    root.onclick = null;
    let result;
    try {
      result = await listGames(dir);
    } catch (err) {
      root.innerHTML = `${back}<h1>Auswertung</h1><p class="error">${esc(err.message)}</p>`;
      return;
    }
    const games = result.games.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    const rows = games.map((g) => {
      const { own, against } = score(g.events);
      return `<div class="game-item"><a class="game-row" href="#/auswertung/${esc(g.id)}"><span>${esc(date(g.startedAt))}</span>
        <b>${esc(g.opponent)}</b><span>${VENUE[g.venue]}</span><span class="game-score">${own}:${against}</span></a>
        <button class="big end-button" data-id="${esc(g.id)}">Löschen · 1,5 s halten</button></div>`;
    });
    // Unreadable files are named so a missing game is never silently hidden.
    const skipped = result.skipped.length
      ? `<p class="error">Diese Dateien konnten nicht gelesen werden: ${result.skipped.map(esc).join(', ')}</p>` : '';
    root.innerHTML = `${back}<h1>Auswertung</h1><a class="big-link" href="#/saison">Saison</a>${skipped}<p id="msg" class="error"></p>${rows.join('') || '<p>Keine Spiele gefunden.</p>'}`;
    // Holding is the only safeguard (as for "Spiel beenden"); a short tap does nothing on purpose.
    for (const button of root.querySelectorAll('[data-id]')) {
      holdable(button, {
        holdMs: END_HOLD_MS,
        onShort() {},
        async onLong() {
          try {
            await deleteGame(dir, button.dataset.id);
            renderGameList(root);
          } catch (err) {
            root.querySelector('#msg').textContent = err.message;
          }
        },
      });
    }
  });
}

// --- One game ---

export function renderGame(root, id) {
  const back = '<a class="back" href="#/auswertung">← Alle Spiele</a>';
  return withFolder(root, back, 'Auswertung', async (dir) => {
    let game;
    try {
      game = await loadGame(dir, id);
    } catch (err) {
      root.innerHTML = `${back}<h1>Auswertung</h1><p class="error">${esc(err.message)}</p>`;
      return;
    }
    const names = new Map((await loadSettings(dir)).goalkeepers.map((g) => [g.id, g.name]));
    drawGame(root, game, names, 'standard');
  });
}

function drawGame(root, game, names, kind, goalkeeperId = null) {
  const allShots = collectShots(game);
  const shots = goalkeeperId === null ? allShots : forGoalkeeper(allShots, goalkeeperId);
  const { own, against } = score(game.events);
  const halves = byHalf(shots, kind);
  const sp = special(shots, kind);
  const open = shots.filter((s) => !s.result).length;

  root.onclick = (e) => {
    const button = e.target.closest('button');
    if (!button) return;
    if ('goalkeeper' in button.dataset) drawGame(root, game, names, kind, button.dataset.goalkeeper || null);
    else if (button.dataset.kind) drawGame(root, game, names, button.dataset.kind, goalkeeperId);
  };

  // Only keepers with shots in this game; with a single keeper the switch would add nothing.
  const keeperIds = [...new Set(allShots.map((s) => s.goalkeeperId).filter(Boolean))];
  const keeperRow = keeperIds.length < 2 ? '' : `<div class="row">${[{ id: '', name: 'Alle' }, ...keeperIds.map((id) => ({ id, name: names.get(id) ?? 'Unbekannter Torwart' }))].map((k) =>
    `<button class="big" data-goalkeeper="${esc(k.id)}" aria-pressed="${(goalkeeperId ?? '') === k.id}">${esc(k.name)}</button>`).join('')}</div>`;
  root.innerHTML = `<div class="game-view"><a class="back" href="#/auswertung">← Alle Spiele</a>
    <h1>${esc(game.opponent)} · ${VENUE[game.venue]} <small>${esc(date(game.startedAt))}</small></h1>
    <p class="final-score">Stand ${own}:${against}</p>
    ${keeperRow}
    <div class="row">
      <button class="big" data-kind="standard" aria-pressed="${kind === 'standard'}">Standardquote</button>
      <button class="big" data-kind="hard" aria-pressed="${kind === 'hard'}">Harte Quote</button>
    </div>
    <div class="stats">${ratioTile('Gesamt', ratio(shots, kind))}${ratioTile('1. Halbzeit', halves[1])}${ratioTile('2. Halbzeit', halves[2])}
      ${ratioTile('7m', sp.siebenmeter)}${ratioTile('Gegenstoß', sp.gegenstoss)}</div>
    ${open ? `<p class="note">${open} offene Würfe ohne Ergebnis zählen nicht.</p>` : ''}
    <h2>Spielstand-Verlauf</h2>${scoreChart(game.events)}
    <h2>Alle Würfe</h2>${shotList(shots, names)}</div>`;
}

function scoreChart(events) {
  const { own, against, lastX } = scoreSeries(events);
  if (own.length + against.length <= 4) return '<p>Keine Tore erfasst.</p>'; // each side has only start and end point
  const xMax = Math.max(30, Math.ceil(lastX / 30) * 30);
  return lineChart(
    [{ label: 'Wir', color: 'var(--result-saved)', points: own }, { label: 'Gegner', color: 'var(--result-goal)', points: against }],
    { xMax, xTicks: Array.from({ length: xMax / 10 + 1 }, (_, i) => i * 10), xLabel: (x) => `${x}'`, vLines: xMax > 30 ? [30] : [] },
  );
}

function shotList(shots, names) {
  if (!shots.length) return '<p>Keine Würfe erfasst.</p>';
  return `<ul class="shot-list">${shots.map((s) => `<li data-result="${s.result ?? ''}"${s.result ? '' : ' class="open"'}>
    <span class="dot"></span><span>${esc(timeLabel(s))}</span><span>${esc(names.get(s.goalkeeperId) ?? 'Unbekannter Torwart')}</span>
    <span>${esc(describe(s))}${s.rebound ? ' · Nachwurf' : ''}</span></li>`).join('')}</ul>`;
}
