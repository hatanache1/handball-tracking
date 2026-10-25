// Generic SVG line chart (no DOM access, returns markup). Season view reuses it for trends.
// series: [{ label, color (any CSS color or var()), points: [{ x, y }] }]
// opts: xMax, xTicks (x values to label), xLabel(x), vLines (x values for dashed markers, e.g. halftime),
//   yMax (fixed y range 0..yMax with 4 steps instead of whole-number ticks), yLabel(y),
//   dots (one dot per point; a point with low: true is greyed out)
const W = 720;
const H = 300;
const PAD = { left: 44, right: 16, top: 40, bottom: 32 };
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function lineChart(series, { xMax, xTicks = [], xLabel = String, vLines = [], yMax: fixedYMax, yLabel = String, dots = false }) {
  // Whole-number y ticks, at most 5 of them, because counts and quotes are read off by eye.
  const top = Math.max(1, ...series.flatMap((s) => s.points.map((p) => p.y)));
  const yStep = fixedYMax ? fixedYMax / 4 : Math.ceil(top / 5);
  const yMax = fixedYMax ?? Math.ceil(top / yStep) * yStep;
  const sx = (x) => PAD.left + (x / xMax) * (W - PAD.left - PAD.right);
  const sy = (y) => H - PAD.bottom - (y / yMax) * (H - PAD.top - PAD.bottom);

  const yLines = Array.from({ length: yMax / yStep + 1 }, (_, i) => i * yStep).map((y) =>
    `<line class="grid" x1="${PAD.left}" x2="${W - PAD.right}" y1="${sy(y)}" y2="${sy(y)}"/><text x="${PAD.left - 8}" y="${sy(y) + 5}" text-anchor="end">${esc(yLabel(y))}</text>`);
  const xLabels = xTicks.map((x) => `<text x="${sx(x)}" y="${H - 8}" text-anchor="middle">${esc(xLabel(x))}</text>`);
  const markers = vLines.map((x) => `<line class="marker" x1="${sx(x)}" x2="${sx(x)}" y1="${PAD.top}" y2="${H - PAD.bottom}"/>`);
  const lines = series.map((s) =>
    `<polyline fill="none" stroke-width="4" stroke-linejoin="round" style="stroke:${esc(s.color)}" points="${s.points.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' ')}"/>`);
  const circles = !dots ? [] : series.flatMap((s) => s.points.map((p) =>
    `<circle${p.low ? ' class="low"' : ''} cx="${sx(p.x)}" cy="${sy(p.y)}" r="7" style="fill:${esc(s.color)}"/>`));
  const legend = series.map((s, i) =>
    `<rect x="${PAD.left + i * 140}" y="10" width="20" height="20" rx="4" style="fill:${esc(s.color)}"/><text x="${PAD.left + i * 140 + 28}" y="26">${esc(s.label)}</text>`);

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(series.map((s) => s.label).join(', '))}">${[...yLines, ...xLabels, ...markers, ...lines, ...circles, ...legend].join('')}</svg>`;
}
