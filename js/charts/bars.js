// Generic horizontal SVG bar chart (no DOM access, returns markup).
// bars: [{ label, value (0..1 or null = no bar), text (shown right of the bar), color (any CSS color or var()), muted (greyed out) }]
const W = 720;
const ROW_H = 48;
const BAR_H = 28;
const PAD = { left: 130, right: 170, top: 8, bottom: 28 };
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function barChart(bars) {
  const H = PAD.top + bars.length * ROW_H + PAD.bottom;
  const plotW = W - PAD.left - PAD.right;
  const sx = (v) => PAD.left + v * plotW;

  const grid = [0, 0.5, 1].map((v) =>
    `<line class="grid" x1="${sx(v)}" x2="${sx(v)}" y1="${PAD.top}" y2="${H - PAD.bottom}"/><text x="${sx(v)}" y="${H - 8}" text-anchor="middle">${v * 100} %</text>`);
  const rows = bars.map((b, i) => {
    const y = PAD.top + i * ROW_H + (ROW_H - BAR_H) / 2;
    const bar = b.value === null ? '' : `<rect x="${PAD.left}" y="${y}" width="${b.value * plotW}" height="${BAR_H}" rx="4" style="fill:${esc(b.color)}"/>`;
    return `<text x="${PAD.left - 10}" y="${y + 20}" text-anchor="end">${esc(b.label)}</text>
      <g${b.muted ? ' class="low"' : ''}>${bar}<text x="${W - PAD.right + 12}" y="${y + 20}">${esc(b.text)}</text></g>`;
  });

  const summary = bars.map((b) => `${b.label}: ${b.text}`).join('; ');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(summary)}">${[...grid, ...rows].join('')}</svg>`;
}
