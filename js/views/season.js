import { listGames } from '../storage.js';
import { loadSettings } from '../settings.js';
import {
  collectShots, forGoalkeeper, ratio, bySituation, byLocationZone, locationZone, byGoalCell, goalCell, special,
  byScoreState, SCORE_STATES, CLOSE_GAME_MARGIN, LOCATION_ZONE_DISTANCE_EDGES_M, LOCATION_ZONE_SIDE_EDGE_M,
} from '../stats.js';
import { SITUATIONS } from '../schema.js';
import { withFolder, esc, ratioText, ratioTile } from './game.js';
import { keeperComparison, seasonDeviation } from './compare.js';
import { barChart } from '../charts/bars.js';
import { lineChart } from '../charts/line.js';
import { goalHeatmap } from '../charts/heatmap.js';

// Same names as js/eventlist.js (kept private there).
const SITUATION_LABELS = { rueckraum: 'Rückraum', aussen: 'Außen', durchbruch: 'Durchbruch', kreis: 'Kreis', einlaeufer: 'Einläufer', siebenmeter: '7m' };
const SCORE_STATE_LABELS = { fuehrung: 'Führung', knapp: `Knapp (±${CLOSE_GAME_MARGIN})`, rueckstand: 'Rückstand' };
const shortDate = (iso) => new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });

// Rates at or below the first value are fully red, at or above the second fully green: real keeper quotes
// sit close together, so the full 0-100 % range would make every zone look the same. Tune after the first games.
const COLOR_SCALE = [0.4, 0.9];
// Mixed in the browser so the colors follow the CSS variables.
const rateColor = (rate) => {
  const green = Math.min(1, Math.max(0, (rate - COLOR_SCALE[0]) / (COLOR_SCALE[1] - COLOR_SCALE[0])));
  return `color-mix(in srgb, var(--result-saved) ${Math.round(green * 100)}%, var(--result-goal))`;
};

// --- Pitch zones (meters, goal line on top, same coordinates as js/views/pitch.js) ---

const [NEAR_M, FAR_M] = LOCATION_ZONE_DISTANCE_EDGES_M;
const SIDE_M = LOCATION_ZONE_SIDE_EDGE_M;
const SIDES = { links: [-10, -SIDE_M], mitte: [-SIDE_M, SIDE_M], rechts: [SIDE_M, 10] };
const BANDS = { nah: [0, NEAR_M], mittel: [NEAR_M, FAR_M], fern: [FAR_M, 30] }; // 30 = beyond the court, clipped by the strip

// Label at the middle of each zone, found by sampling, so the labels follow the tunable zone edges.
const LABEL_AT = (() => {
  const sums = {};
  for (let x = -9.875; x < 10; x += 0.25) {
    for (let y = 0.125; y < 20; y += 0.25) {
      const s = (sums[locationZone({ x, y })] ??= { x: 0, y: 0, n: 0 });
      s.x += x; s.y += y; s.n += 1;
    }
  }
  return Object.fromEntries(Object.entries(sums).map(([zone, s]) => [zone, { x: s.x / s.n, y: s.y / s.n }]));
})();

const halfDisc = (r) => `M ${-r} 0 A ${r} ${r} 0 0 0 ${r} 0 Z`;
// Ring between two radii as one path (even-odd fill leaves the inner disc empty).
const ring = ([inner, outer]) => halfDisc(outer) + (inner ? halfDisc(inner) : '');

function zoneMap(zones) {
  // Each side is its own nested <svg>, which clips the rings to the strip without clip-path ids.
  const strips = Object.entries(SIDES).map(([side, [x1, x2]]) =>
    `<svg x="${x1}" y="0" width="${x2 - x1}" height="20" viewBox="${x1} 0 ${x2 - x1} 20">${Object.entries(BANDS).map(([band, range]) => {
      const r = zones[`${band}-${side}`];
      // Greyed out when too few shots (also when empty): a color would suggest more than the data says.
      return r.lowSample
        ? `<path class="zone low" fill-rule="evenodd" d="${ring(range)}"/>`
        : `<path class="zone" fill-rule="evenodd" d="${ring(range)}" style="fill:${rateColor(r.rate)}"/>`;
    }).join('')}</svg>`);
  const labels = Object.entries(zones).map(([zone, r]) => {
    const { x, y } = LABEL_AT[zone];
    const [rate, count] = r.rate === null ? ['–', '0/0'] : [`${Math.round(r.rate * 100)} %`, `${r.hits}/${r.total}`];
    return `<text class="zone-label${r.lowSample ? ' low' : ''}" x="${x}" y="${y}" text-anchor="middle"><title>${esc(ratioText(r))}</title>
      <tspan x="${x}">${rate}</tspan><tspan x="${x}" dy="1" class="zone-count">${count}</tspan></text>`;
  });
  return `<svg class="pitch-zones" viewBox="-10 -0.5 20 20.5" role="img" aria-label="Quote nach Wurfort">
    ${strips.join('')}<rect x="-1.5" y="-0.3" width="3" height="0.3" fill="currentColor"/>${labels.join('')}</svg>`;
}

// --- Loading ---

export function renderSeason(root) {
  const back = '<a class="back" href="#/auswertung">← Alle Spiele</a>';
  return withFolder(root, back, 'Saison', async (dir) => {
    root.onclick = null;
    let result;
    try {
      result = await listGames(dir);
    } catch (err) {
      root.innerHTML = `${back}<h1>Saison</h1><p class="error">${esc(err.message)}</p>`;
      return;
    }
    const settings = await loadSettings(dir);
    const shots = collectShots(result.games);

    // Keepers from the settings (removed ones only if they have shots) plus ids found in shots that the settings do not know.
    const shotIds = [...new Set(shots.map((s) => s.goalkeeperId).filter(Boolean))];
    const known = new Set(settings.goalkeepers.map((g) => g.id));
    const keepers = [
      ...settings.goalkeepers.filter((g) => !g.removed || shotIds.includes(g.id)),
      ...shotIds.filter((id) => !known.has(id)).map((id) => ({ id, name: `Unbekannter Torwart (${id.slice(0, 4)})` })),
    ];
    drawSeason(root, { back, games: result.games, skipped: result.skipped, shots, keepers }, { goalkeeperId: null, kind: 'standard' });
  });
}

// --- Drawing ---

function drawSeason(root, data, state) {
  const { back, games, skipped, shots: allShots, keepers } = data;
  const shots = state.goalkeeperId === null ? allShots : forGoalkeeper(allShots, state.goalkeeperId);
  const counted = shots.filter((s) => s.result);

  root.onclick = (e) => {
    const button = e.target.closest('button');
    if (!button) return;
    if ('goalkeeper' in button.dataset) drawSeason(root, data, { ...state, goalkeeperId: button.dataset.goalkeeper || null });
    else if (button.dataset.kind) drawSeason(root, data, { ...state, kind: button.dataset.kind });
  };

  const keeperButtons = [{ id: '', name: 'Alle' }, ...keepers].map((k) =>
    `<button class="big" data-goalkeeper="${esc(k.id)}" aria-pressed="${(state.goalkeeperId ?? '') === k.id}">${esc(k.name)}</button>`);
  // Unreadable files are named so a missing game is never silently hidden.
  const skippedNote = skipped.length ? `<p class="error">Diese Dateien konnten nicht gelesen werden: ${skipped.map(esc).join(', ')}</p>` : '';
  const missing = (field) => counted.filter((s) => !s[field]).length;
  const outside = counted.filter((s) => s.target && !goalCell(s.target)).length;
  const sp = special(shots, state.kind);

  root.innerHTML = `<div class="game-view">${back}<h1>Saison <small>${games.length} ${games.length === 1 ? 'Spiel' : 'Spiele'}</small></h1>
    ${skippedNote}
    <div class="row">${keeperButtons.join('')}</div>
    <div class="row">
      <button class="big" data-kind="standard" aria-pressed="${state.kind === 'standard'}">Standardquote</button>
      <button class="big" data-kind="hard" aria-pressed="${state.kind === 'hard'}">Harte Quote</button>
    </div>
    <div class="stats">${ratioTile('Gesamt', ratio(shots, state.kind))}</div>
    <h2>Quote nach Wurfort</h2>${zoneMap(byLocationZone(shots, state.kind))}
    ${missing('location') ? `<p class="note">${missing('location')} Würfe ohne Wurfort zählen hier nicht.</p>` : ''}
    <h2>Quote nach Situation</h2>${rateBars(SITUATIONS, SITUATION_LABELS, bySituation(shots, state.kind))}
    ${missing('situation') ? `<p class="note">${missing('situation')} Würfe ohne Situation zählen hier nicht.</p>` : ''}
    <h2>Quote nach Zielpunkt im Tor</h2>${goalHeatmap(byGoalCell(shots, state.kind), rateColor)}
    ${missing('target') ? `<p class="note">${missing('target')} Würfe ohne Zielpunkt zählen hier nicht.</p>` : ''}
    ${outside ? `<p class="note">${outside} Würfe gingen auf den Rahmen oder daneben und haben keine Zelle.</p>` : ''}
    <h2>7m, Gegenstoß, Nachwurf</h2>
    <div class="stats">${ratioTile('7m', sp.siebenmeter)}${ratioTile('Gegenstoß', sp.gegenstoss)}${ratioTile('Nachwurf', sp.nachwurf)}</div>
    <h2>Quote pro Spiel</h2>${trendSection(games, shots, state.kind)}
    <h2>Quote nach Spielstand</h2>${rateBars(SCORE_STATES, SCORE_STATE_LABELS, byScoreState(shots, state.kind))}
    <h2>Abweichung vom Saisonschnitt</h2>${seasonDeviation(games, shots, state.kind)}
    <h2>Torhüter im Vergleich</h2>${keeperComparison(allShots, keepers, state.kind, SITUATION_LABELS)}</div>`;
}

function rateBars(keys, labels, byKey) {
  return barChart(keys.map((k) => {
    const r = byKey[k];
    return { label: labels[k], value: r.rate, text: ratioText(r), color: r.rate === null ? '' : rateColor(r.rate), muted: r.lowSample };
  }));
}

// One point per game, oldest first. Games without a counted shot (for this keeper) are left out and named in a note.
function trendSection(games, shots, kind) {
  const rows = [...games].sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .map((g) => ({ game: g, r: ratio(shots.filter((s) => s.gameId === g.id), kind) }))
    .filter(({ r }) => r.total > 0);
  const skipped = games.length - rows.length;
  const note = skipped ? `<p class="note">${skipped} ${skipped === 1 ? 'Spiel' : 'Spiele'} ohne gezählte Würfe fehlen hier.</p>` : '';
  if (!rows.length) return `<p>Keine Spiele mit gezählten Würfen.</p>${note}`;

  const step = Math.ceil(rows.length / 12); // fewer x labels on long seasons so they do not overlap
  // x = index + 0.5 keeps the dots off the chart edges and works for a single game.
  const points = rows.map(({ r }, i) => ({ x: i + 0.5, y: r.rate * 100, low: r.lowSample }));
  const chart = lineChart([{ label: kind === 'hard' ? 'Harte Quote' : 'Standardquote', color: 'var(--accent)', points }], {
    xMax: rows.length, xTicks: points.filter((_, i) => i % step === 0).map((p) => p.x), xLabel: (x) => shortDate(rows[x - 0.5].game.startedAt),
    yMax: 100, yLabel: (y) => `${y} %`, dots: true,
  });
  const tiles = rows.map(({ game, r }) => ratioTile(`${new Date(game.startedAt).toLocaleDateString('de-DE')} · ${game.opponent}`, r));
  return `${chart}<div class="stats">${tiles.join('')}</div>${note}`;
}
