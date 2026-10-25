// Goal heatmap as SVG markup (no DOM access). Units are meters like js/goal.js, svg y axis points down.
// cells: { 'col-row': { rate, hits, total, lowSample } } as from byGoalCell (row 0 = bottom); color(rate) -> CSS color.
import { GOAL_WIDTH_M as W, GOAL_HEIGHT_M as H } from '../goal.js';
import { GOAL_CELLS } from '../stats.js';

const COLS = 3;
const ROWS = 3;

export function goalHeatmap(cells, color) {
  const cw = W / COLS;
  const ch = H / ROWS;
  const rects = GOAL_CELLS.map((key) => {
    const [col, row] = key.split('-').map(Number);
    const r = cells[key];
    const x = col * cw;
    const y = -(row + 1) * ch;
    // Greyed out when too few shots (also when empty): a color would suggest more than the data says.
    const fill = r.lowSample ? '<rect class="cell low"' : `<rect class="cell" style="fill:${color(r.rate)}"`;
    const [rate, count] = r.rate === null ? ['–', '0/0'] : [`${Math.round(r.rate * 100)} %`, `${r.hits}/${r.total}`];
    return `${fill} x="${x}" y="${y}" width="${cw}" height="${ch}"/>
      <text class="cell-label${r.lowSample ? ' low' : ''}" x="${x + cw / 2}" y="${y + ch / 2}" text-anchor="middle">
        <tspan x="${x + cw / 2}">${rate}</tspan><tspan x="${x + cw / 2}" dy="0.2" class="cell-count">${count}</tspan></text>`;
  });
  return `<svg class="goal-heatmap" viewBox="-0.2 ${-H - 0.2} ${W + 0.4} ${H + 0.4}" role="img" aria-label="Quote nach Zielpunkt im Tor">
    ${rects.join('')}<path d="M0 0V${-H}H${W}V0" fill="none" stroke="currentColor" stroke-width="0.08"/></svg>`;
}
