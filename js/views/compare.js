// Season comparisons (no DOM access, returns markup): keepers side by side, and each game against the season average.
import { forGoalkeeper, ratio, bySituation } from '../stats.js';
import { SITUATIONS } from '../schema.js';
import { esc, ratioText, ratioTile } from './game.js';

// Keepers with at least one counted shot, from ALL shots (the keeper filter would leave only one column).
export function keeperComparison(allShots, keepers, kind, situationLabels) {
  const rows = keepers.map((k) => ({ name: k.name, shots: forGoalkeeper(allShots, k.id) })).filter((k) => k.shots.some((s) => s.result));
  if (!rows.length) return '<p>Keine Torhüter mit gezählten Würfen.</p>';

  const bySit = rows.map((k) => bySituation(k.shots, kind));
  const cell = (r) => `<td${r.lowSample ? ' class="low"' : ''}>${ratioText(r)}</td>`;
  const body = SITUATIONS.map((s) => `<tr><th>${situationLabels[s]}</th>${bySit.map((b) => cell(b[s])).join('')}</tr>`);
  return `<div class="stats">${rows.map((k) => ratioTile(k.name, ratio(k.shots, kind))).join('')}</div>
    <table class="compare-table"><tr><th></th>${rows.map((k) => `<th>${esc(k.name)}</th>`).join('')}</tr>${body.join('')}</table>`;
}

const W = 720;
const ROW_H = 44;
const BAR_H = 26;
const PAD = { left: 220, right: 180, top: 8, bottom: 8 };
const MIN_SCALE_PP = 10; // so a few percentage points do not fill the whole chart

// Percentage points of each game's quote minus the season quote of the same shots, oldest game first.
// Bars go right (better) in --diff-up and left (worse) in --diff-down; not the result colors, which belong to the shots.
export function seasonDeviation(games, shots, kind) {
  const season = ratio(shots, kind);
  const rows = [...games].sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .map((g) => ({ game: g, r: ratio(shots.filter((s) => s.gameId === g.id), kind) }))
    .filter(({ r }) => r.total > 0);
  if (!rows.length) return '<p>Keine Spiele mit gezählten Würfen.</p>';

  const deltas = rows.map(({ r }) => (r.rate - season.rate) * 100);
  const scale = Math.max(MIN_SCALE_PP, ...deltas.map(Math.abs));
  const plotW = W - PAD.left - PAD.right;
  const mid = PAD.left + plotW / 2;
  const H = PAD.top + rows.length * ROW_H + PAD.bottom;

  const bars = rows.map(({ game, r }, i) => {
    const d = Math.round(deltas[i]);
    const y = PAD.top + i * ROW_H + (ROW_H - BAR_H) / 2;
    const w = Math.abs(deltas[i]) / scale * (plotW / 2);
    const x = deltas[i] >= 0 ? mid : mid - w;
    const text = `${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(d)} Pkt, ${ratioText(r)}`;
    return `<text x="${PAD.left - 10}" y="${y + 19}" text-anchor="end">${esc(`${new Date(game.startedAt).toLocaleDateString('de-DE')} · ${game.opponent}`)}</text>
      <g${r.lowSample ? ' class="low"' : ''}><rect x="${x}" y="${y}" width="${w}" height="${BAR_H}" rx="4" style="fill:var(--diff-${deltas[i] >= 0 ? 'up' : 'down'})"/>
      <text x="${W - PAD.right + 12}" y="${y + 19}">${esc(text)}</text></g>`;
  });
  const summary = `Saisonschnitt ${ratioText(season)}`;
  return `<p class="note">${summary}. Rechts: besser als der Saisonschnitt, links: schlechter (Prozentpunkte). Ausgegraut: unter 10 Würfe.</p>
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(summary)}">
    <line class="grid" x1="${mid}" x2="${mid}" y1="${PAD.top}" y2="${H - PAD.bottom}"/>${bars.join('')}</svg>`;
}
