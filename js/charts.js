/* ═══════════════════════════════════════════════════════════════════════════
   Charts: YAML series data drawn as inline SVG.

   No library, no <canvas>, no DOM. The SVG is a string built from the deck's
   own numbers and the resolved theme, so a chart themes with the deck the way
   every other slide element does, and the same function serves the player,
   the standalone HTML export and the Reveal export. PPTX does not use this:
   pptxgenjs has native chart types, which stay editable (see js/blocks.js).

   The audit (js/parser.js) enforces the contract this module assumes: at most
   6 series, a stated unit, values matching the labels. This module still
   guards every input, because a deck mid-edit reaches it before the author
   reads a single warning.
═══════════════════════════════════════════════════════════════════════════ */

import { esc } from './utils.js';

/** One normalized shape for every consumer: kind, unit, labels, series. */
export function normalizeChart(slide) {
  const kind = ['bar', 'pie', 'line'].includes(slide.chart) ? slide.chart : 'bar';
  const series = (Array.isArray(slide.series) ? slide.series : [])
    .filter(sr => sr && typeof sr === 'object')
    .slice(0, 6)
    .map(sr => ({
      name: String(sr.name ?? ''),
      values: (Array.isArray(sr.values) ? sr.values : []).map(v => Number(v) || 0),
    }));
  const labels = (Array.isArray(slide.labels) && slide.labels.length)
    ? slide.labels.map(l => String(l ?? ''))
    : (series[0]?.values || []).map((_, i) => String(i + 1));
  return { kind, unit: String(slide.unit || ''), labels, series };
}

/* Series colors derived from the accent by rotating its hue, so a brand or
   theme change recolors every chart with it. Lightness and saturation stay
   put, which is what keeps the rotated colors legible on the same background
   the accent was chosen for. */
export function seriesColors(accent) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(accent || '').trim().replace(/^#/, ''));
  const hex = m ? m[1] : '0063e5';
  const [r, g, b] = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  const toHex = (hue) => {
    const c = (1 - Math.abs(2 * l - 1)) * (s || 0.55);
    const hp = ((hue % 360) + 360) / 60 % 6;
    const x = c * (1 - Math.abs(hp % 2 - 1));
    const [r1, g1, b1] =
      hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x] :
      hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x];
    const mAdd = l - c / 2;
    return '#' + [r1, g1, b1]
      .map(v => Math.round(Math.min(1, Math.max(0, v + mAdd)) * 255).toString(16).padStart(2, '0'))
      .join('');
  };
  return [0, 40, -40, 85, -85, 150].map(off => toHex(h + off));
}

const fmt = (v) => {
  const n = Number(v) || 0;
  if (Math.abs(n) >= 1e6) return `${+(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `${+(n / 1e3).toFixed(1)}k`;
  return String(+n.toFixed(2));
};

/* A round axis ceiling (1/2/5 times a power of ten) so gridline labels read
   as numbers a person would say, not as maxima with decimals. */
const niceCeil = (v) => {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  for (const step of [1, 2, 2.5, 5, 10]) if (v <= step * pow) return step * pow;
  return 10 * pow;
};

/* ── The drawing ────────────────────────────────────────────────────────── */

const W = 840, H = 360;
const PLOT = { x0: 62, x1: 828, y0: 48, y1: 300 };

function legendRow(series, colors, t) {
  let x = PLOT.x0;
  return series.map((sr, i) => {
    const label = sr.name || `series ${i + 1}`;
    const piece =
      `<rect x="${x}" y="12" width="12" height="12" rx="2" fill="${colors[i]}"/>` +
      `<text x="${x + 18}" y="22" font-size="13" fill="${esc(t.ts)}">${esc(label)}</text>`;
    x += 26 + label.length * 7.4;
    return piece;
  }).join('');
}

function axis(top, unit, t) {
  const parts = [];
  for (let i = 0; i <= 4; i++) {
    const v = (top / 4) * i;
    const y = PLOT.y1 - ((PLOT.y1 - PLOT.y0) / 4) * i;
    parts.push(`<line x1="${PLOT.x0}" y1="${y}" x2="${PLOT.x1}" y2="${y}" stroke="${esc(t.border)}" stroke-width="1"/>`);
    parts.push(`<text x="${PLOT.x0 - 8}" y="${y + 4}" font-size="12" text-anchor="end" fill="${esc(t.muted)}">${esc(fmt(v))}</text>`);
  }
  if (unit) parts.push(`<text x="${PLOT.x1}" y="22" font-size="13" text-anchor="end" fill="${esc(t.muted)}">${esc(unit)}</text>`);
  return parts.join('');
}

function catLabels(labels, t) {
  const span = (PLOT.x1 - PLOT.x0) / (labels.length || 1);
  return labels.map((l, i) =>
    `<text x="${PLOT.x0 + span * (i + 0.5)}" y="${PLOT.y1 + 22}" font-size="12" text-anchor="middle" fill="${esc(t.ts)}">${esc(String(l).slice(0, 16))}</text>`
  ).join('');
}

function barChart(labels, series, colors, t) {
  const top = niceCeil(Math.max(1, ...series.flatMap(sr => sr.values)) * 1.05);
  const span = (PLOT.x1 - PLOT.x0) / (labels.length || 1);
  const barW = Math.min(44, (span * 0.72) / (series.length || 1));
  const bars = labels.map((_, gi) => {
    const groupX = PLOT.x0 + span * gi + (span - (barW + 3) * series.length + 3) / 2;
    return series.map((sr, si) => {
      const v = sr.values[gi] ?? 0;
      const h = Math.max(0, (v / top) * (PLOT.y1 - PLOT.y0));
      return `<rect x="${(groupX + si * (barW + 3)).toFixed(1)}" y="${(PLOT.y1 - h).toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${colors[si]}"/>`;
    }).join('');
  }).join('');
  return axis(top, '', t) + bars + catLabels(labels, t);
}

function lineChart(labels, series, colors, t) {
  const top = niceCeil(Math.max(1, ...series.flatMap(sr => sr.values)) * 1.05);
  const span = (PLOT.x1 - PLOT.x0) / (labels.length || 1);
  const px = (gi) => PLOT.x0 + span * (gi + 0.5);
  const py = (v) => PLOT.y1 - (Math.max(0, v) / top) * (PLOT.y1 - PLOT.y0);
  const lines = series.map((sr, si) => {
    const pts = labels.map((_, gi) => `${px(gi).toFixed(1)},${py(sr.values[gi] ?? 0).toFixed(1)}`).join(' ');
    const dots = labels.map((_, gi) =>
      `<circle cx="${px(gi).toFixed(1)}" cy="${py(sr.values[gi] ?? 0).toFixed(1)}" r="4" fill="${colors[si]}"/>`).join('');
    return `<polyline points="${pts}" fill="none" stroke="${colors[si]}" stroke-width="3" stroke-linejoin="round"/>${dots}`;
  }).join('');
  return axis(top, '', t) + lines + catLabels(labels, t);
}

function pieChart(labels, series, colors, unit, t) {
  const values = series[0]?.values || [];
  const total = values.reduce((a, b) => a + Math.max(0, b), 0);
  if (total <= 0) return '';
  const cx = 210, cy = 190, r = 128;
  let angle = -Math.PI / 2;
  const slices = values.map((v, i) => {
    const frac = Math.max(0, v) / total;
    if (frac <= 0) return '';
    if (frac >= 0.9999) return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${colors[i]}"/>`;
    const a0 = angle, a1 = (angle += frac * Math.PI * 2);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p0 = `${(cx + r * Math.cos(a0)).toFixed(1)} ${(cy + r * Math.sin(a0)).toFixed(1)}`;
    const p1 = `${(cx + r * Math.cos(a1)).toFixed(1)} ${(cy + r * Math.sin(a1)).toFixed(1)}`;
    return `<path d="M ${cx} ${cy} L ${p0} A ${r} ${r} 0 ${large} 1 ${p1} Z" fill="${colors[i]}" stroke="${esc(t.bg)}" stroke-width="2"/>`;
  }).join('');
  const legend = labels.map((l, i) => {
    const y = 88 + i * 34;
    const pct = Math.round(((Math.max(0, values[i] ?? 0)) / total) * 100);
    return `<rect x="400" y="${y - 12}" width="14" height="14" rx="3" fill="${colors[i]}"/>` +
      `<text x="424" y="${y}" font-size="15" fill="${esc(t.ts)}">${esc(String(l).slice(0, 24))}</text>` +
      `<text x="828" y="${y}" font-size="15" text-anchor="end" fill="${esc(t.text)}">${esc(fmt(values[i] ?? 0))} · ${pct}%</text>`;
  }).join('');
  const unitText = unit
    ? `<text x="828" y="26" font-size="13" text-anchor="end" fill="${esc(t.muted)}">${esc(unit)}</text>` : '';
  return slices + legend + unitText;
}

/**
 * The whole chart as an SVG string, themed by `t` (a themeWithBrand result).
 * A slide with no usable data renders a labelled empty frame rather than
 * nothing: the gap has to be visible in the filmstrip, like a missing image.
 */
export function chartSVG(slide, t) {
  const { kind, unit, labels, series } = normalizeChart(slide);
  const open = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" ` +
    `aria-label="${esc(`${kind} chart${unit ? `, ${unit}` : ''}`)}" style="font-family:inherit">`;
  if (!series.length || !series.some(sr => sr.values.length)) {
    return `${open}<rect x="6" y="6" width="${W - 12}" height="${H - 12}" rx="8" fill="none" ` +
      `stroke="${esc(t.dim)}" stroke-dasharray="6 6"/>` +
      `<text x="${W / 2}" y="${H / 2}" font-size="18" text-anchor="middle" fill="${esc(t.muted)}">` +
      `${kind} chart: add a series: list with values</text></svg>`;
  }
  const colors = seriesColors(t.accent);
  let body;
  if (kind === 'pie') {
    body = pieChart(labels, series, colors, unit, t);
  } else {
    const legend = legendRow(series, colors, t);
    const unitTag = unit && kind !== 'pie'
      ? `<text x="${PLOT.x1}" y="22" font-size="13" text-anchor="end" fill="${esc(t.muted)}">${esc(unit)}</text>` : '';
    body = legend + unitTag +
      (kind === 'line' ? lineChart(labels, series, colors, t) : barChart(labels, series, colors, t));
  }
  return `${open}${body}</svg>`;
}
