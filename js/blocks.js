/* ═══════════════════════════════════════════════════════════════════════════
   Blocks: the round-10 slide types (process, chart, orgchart), every
   format in one place.

   Four dispatchers, one per consumer: htmlBlock (the player and everything
   derived from its DOM: standalone HTML, grid, filmstrip, geometry),
   revealBlock (the Reveal.js export, inline styles because the player CSS is
   not shipped there), marpBlock (Marp Markdown), pptxBlock (pptxgenjs).

   Why a separate module: render.js, serialize.js and publish.js each hold a
   switch that has grown with every round. Three new types across four formats
   is ~400 lines; landing them here keeps each switch to a three-line
   delegation, and keeps the four mappings of one type on one screen, which is
   how a type that renders in the player but drops content in an export gets
   noticed. DOM-free throughout, so the CLI and the tests import it directly.
═══════════════════════════════════════════════════════════════════════════ */

import { esc, inlineMd } from './utils.js';
import { chartSVG, normalizeChart, seriesColors } from './charts.js';

export const BLOCK_TYPES = ['process', 'chart', 'orgchart'];

const initialsOf = (name) => String(name || '?').trim().split(/\s+/)
  .slice(0, 2).map(w => w[0] || '').join('').toUpperCase();

/* Everyone below a level-2 node, flattened in order. Level 3 is the deepest
   the layout draws; anything deeper lands in the same list and the audit says
   so, which beats silently dropping a person from their own org chart. */
const descend = (pn, out = []) => {
  (pn?.reports || []).forEach(c => { if (c) { out.push(c); descend(c, out); } });
  return out;
};

/* ── Player / standalone HTML ──────────────────────────────────────────── */

export function htmlBlock(type, slide, t) {
  const heading = slide.heading ? `<div class="s-heading">${esc(slide.heading)}</div>` : '';
  const caption = slide.caption ? `<div class="table-caption">${esc(slide.caption)}</div>` : '';

  if (type === 'process') {
    const flow = slide.flow === 'rows' ? 'rows' : 'columns';
    const cards = (slide.steps || []).map((st, i) => `
      <div class="proc-card${st?.current === true ? ' is-current' : ''}">
        <div class="proc-band"><span class="proc-num">${i + 1}</span><span class="proc-label">${inlineMd(st?.label || '')}</span></div>
        <div class="proc-body">${inlineMd(st?.text || '')}</div>
        ${(st?.date || st?.owner)
          ? `<div class="proc-meta"><span>${esc(st?.date || '')}</span><span>${esc(st?.owner || '')}</span></div>`
          : ''}
      </div>`).join('');
    return `${heading}<div class="process-flow flow-${flow}">${cards}</div>`;
  }

  if (type === 'chart') {
    return `${heading}<div class="chart-figure">${chartSVG(slide, t)}</div>${caption}`;
  }

  if (type === 'orgchart') {
    const root = slide.root || {};
    const face = (pn, cls) => pn?.src
      ? `<img class="org-face ${cls}" src="${esc(pn.src)}" alt="${esc(pn?.name || '')}">`
      : `<span class="org-face org-initials ${cls}">${esc(initialsOf(pn?.name))}</span>`;
    const node = (pn, cls) => `
      <div class="org-node ${cls}">${face(pn, '')}
        <span class="org-who"><span class="org-name">${esc(pn?.name || '')}</span>${pn?.role ? `<span class="org-role">${esc(pn.role)}</span>` : ''}</span>
      </div>`;
    const branches = (root.reports || []).map(ch => `
      <div class="org-branch">
        ${node(ch, '')}
        ${descend(ch).length ? `<ul class="org-leaves">${descend(ch).map(lf => `
          <li class="org-leaf">${face(lf, 'org-face-sm')}<span class="org-who"><span class="org-name">${esc(lf?.name || '')}</span>${lf?.role ? `<span class="org-role">${esc(lf.role)}</span>` : ''}</span></li>`).join('')}
        </ul>` : ''}
      </div>`).join('');
    return `${heading}
      <div class="org-chart">
        ${node(root, 'org-root')}
        ${(root.reports || []).length ? `<div class="org-children">${branches}</div>` : ''}
      </div>`;
  }
  return '';
}

/* ── Reveal.js ─────────────────────────────────────────────────────────── */

export function revealBlock(type, slide, t, note, bgAttr) {
  const h2 = slide.heading
    ? `<h2 style="font-size:1.5em;font-weight:700;color:${t.text};border-bottom:1px solid ${t.border};padding-bottom:14px">${esc(slide.heading)}</h2>` : '';
  const caption = slide.caption
    ? `<p style="font-size:0.5em;color:${t.muted};margin-top:10px">${esc(slide.caption)}</p>` : '';

  if (type === 'process') {
    const rows = slide.flow === 'rows';
    const cards = (slide.steps || []).map((st, i) => {
      const cur = st?.current === true;
      return `<div style="flex:1;text-align:left;border:1px solid ${cur ? t.accent : t.border};border-radius:8px;overflow:hidden">
      <div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:${cur ? t.accent : 'rgba(127,127,127,.12)'}">
        <span style="width:20px;height:20px;border-radius:50%;background:${cur ? (t.onAccent || '#fff') : t.accent};color:${cur ? t.accent : (t.onAccent || '#fff')};font-size:0.5em;font-weight:700;display:inline-flex;align-items:center;justify-content:center">${i + 1}</span>
        <span style="font-size:0.6em;font-weight:700;color:${cur ? (t.onAccent || '#fff') : t.text}">${esc(st?.label || '')}</span>
      </div>
      ${st?.text ? `<div style="padding:8px 10px;font-size:0.55em;color:${t.ts};line-height:1.45">${esc(st.text)}</div>` : ''}
      ${(st?.date || st?.owner) ? `<div style="display:flex;justify-content:space-between;gap:8px;padding:6px 10px;border-top:1px solid ${t.border};font-size:0.45em;color:${t.muted}"><span>${esc(st?.date || '')}</span><span>${esc(st?.owner || '')}</span></div>` : ''}
    </div>`;
    }).join('\n    ');
    return `<section ${bgAttr}>
  ${h2}
  <div style="display:flex;${rows ? 'flex-direction:column;' : ''}gap:14px;margin-top:22px">
    ${cards}
  </div>
  ${note}
</section>`;
  }

  if (type === 'chart') {
    return `<section ${bgAttr}>
  ${h2}
  <div style="width:90%;margin:18px auto 0">${chartSVG(slide, t)}</div>
  ${caption}
  ${note}
</section>`;
  }

  if (type === 'orgchart') {
    const root = slide.root || {};
    const stub = `<div style="width:2px;height:14px;background:${t.dim};margin:0 auto"></div>`;
    const face = (pn, size) => pn?.src
      ? `<img src="${esc(pn.src)}" alt="${esc(pn?.name || '')}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;flex:none">`
      : `<span style="width:${size}px;height:${size}px;border-radius:50%;background:${t.accent};color:${t.onAccent || '#fff'};font-size:${Math.round(size * 0.38)}px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;flex:none">${esc(initialsOf(pn?.name))}</span>`;
    const card = (pn, size) => `<div style="display:inline-flex;align-items:center;gap:8px;text-align:left;border:1px solid ${t.border};border-radius:8px;padding:6px 12px;background:rgba(127,127,127,.08)">
      ${face(pn, size)}
      <span style="display:inline-flex;flex-direction:column"><span style="font-size:0.55em;font-weight:700;color:${t.text}">${esc(pn?.name || '')}</span>${pn?.role ? `<span style="font-size:0.45em;color:${t.muted}">${esc(pn.role)}</span>` : ''}</span>
    </div>`;
    const branches = (root.reports || []).map(ch => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;min-width:0">
      ${stub}
      ${card(ch, 26)}
      ${descend(ch).length ? `<ul style="list-style:none;padding:0;margin:8px 0 0;display:flex;flex-direction:column;gap:5px;border-left:2px solid ${t.border};padding-left:10px">
        ${descend(ch).map(lf => `<li style="display:flex;align-items:center;gap:6px">${face(lf, 18)}<span style="font-size:0.45em;color:${t.ts}">${esc(lf?.name || '')}${lf?.role ? ` · ${esc(lf.role)}` : ''}</span></li>`).join('\n        ')}
      </ul>` : ''}
    </div>`).join('\n    ');
    return `<section ${bgAttr}>
  ${h2}
  <div style="margin-top:18px">${card(root, 30)}</div>
  ${(root.reports || []).length ? `${stub}
  <div style="display:flex;gap:14px;align-items:flex-start">
    ${branches}
  </div>` : ''}
  ${note}
</section>`;
  }
  return `<section ${bgAttr}><p>Unknown type: ${esc(type)}</p>${note}</section>`;
}

/* ── Marp Markdown ─────────────────────────────────────────────────────── */

export function marpBlock(type, slide, lines) {
  if (type === 'process') {
    if (slide.heading) lines.push(`## ${slide.heading}`);
    (slide.steps || []).forEach((st, i) => {
      const meta = [st?.date, st?.owner].filter(Boolean).join(' · ');
      lines.push(`${i + 1}. **${st?.label || ''}**${st?.text ? `: ${st.text}` : ''}${meta ? ` (${meta})` : ''}${st?.current === true ? ' ← current' : ''}`);
    });
    return;
  }

  if (type === 'chart') {
    /* Markdown cannot draw, so the chart degrades to the data behind it, and
       says so out loud rather than pretending the table was the design. */
    const { kind, unit, labels, series } = normalizeChart(slide);
    if (slide.heading) lines.push(`## ${slide.heading}`);
    lines.push('', `*${kind} chart${unit ? ` of ${unit}` : ''}: shown as its data table in Markdown*`, '');
    if (series.length) {
      lines.push(`| ${unit || 'Series'} | ${labels.join(' | ')} |`);
      lines.push(`|${[...Array(labels.length + 1)].map(() => ' --- ').join('|')}|`);
      series.forEach(sr => lines.push(`| **${sr.name || ''}** | ${sr.values.join(' | ')} |`));
    }
    if (slide.caption) lines.push('', `*${slide.caption}*`);
    return;
  }

  if (type === 'orgchart') {
    if (slide.heading) lines.push(`## ${slide.heading}`);
    (function walk(pn, depth) {
      if (!pn) return;
      lines.push(`${'  '.repeat(depth)}- **${pn.name || ''}**${pn.role ? ` · ${pn.role}` : ''}`);
      (pn.reports || []).forEach(c => walk(c, depth + 1));
    })(slide.root, 0);
  }
}

/* ── PPTX ──────────────────────────────────────────────────────────────── */

/* ctx: { pptx, s, slide, C, t } from deckToPptx. Coordinates follow the same
   10 x 5.625in canvas as every case in serialize.js: content in x 0.4..9.6,
   the rail band owns y 5.05 and below. */
export function pptxBlock(type, ctx) {
  const { pptx, s, slide, C, t } = ctx;
  const head = (w = 9.2) => {
    if (!slide.heading) return false;
    s.addText(slide.heading, { x: 0.4, y: 0.25, w, h: 0.72, fontSize: 19, bold: true, color: C.white });
    s.addShape(pptx.ShapeType.line, { x: 0.4, y: 1.05, w: 9.2, h: 0, line: { color: C.line, width: 1, transparency: 85 } });
    return true;
  };

  if (type === 'process') {
    const has = head();
    const steps = slide.steps || [];
    const y0 = has ? 1.25 : 0.6;
    if (slide.flow === 'rows') {
      const shown = steps.slice(0, 4);
      shown.forEach((st, i) => {
        const cur = st?.current === true;
        const y = y0 + i * 0.94;
        s.addShape(pptx.ShapeType.rect, { x: 0.4, y, w: 9.2, h: 0.82, fill: { color: C.bg2, transparency: 30 }, line: { color: cur ? C.accent : C.line, width: cur ? 1.5 : 0.75 } });
        s.addShape(pptx.ShapeType.ellipse, { x: 0.55, y: y + 0.26, w: 0.3, h: 0.3, fill: { color: C.accent }, line: { type: 'none' } });
        s.addText(String(i + 1), { x: 0.55, y: y + 0.26, w: 0.3, h: 0.3, fontSize: 10, bold: true, color: C.on_accent, align: 'center', valign: 'middle' });
        s.addText(String(st?.label || ''), { x: 1.0, y, w: 2.2, h: 0.82, fontSize: 12, bold: true, color: cur ? C.accent : C.white, valign: 'middle' });
        if (st?.text) s.addText(String(st.text), { x: 3.3, y, w: 3.9, h: 0.82, fontSize: 10, color: C.body, valign: 'middle', wrap: true });
        if (st?.date) s.addText(String(st.date), { x: 7.3, y, w: 0.95, h: 0.82, fontSize: 8, color: C.muted, valign: 'middle' });
        if (st?.owner) s.addText(String(st.owner), { x: 8.3, y, w: 1.15, h: 0.82, fontSize: 8, color: C.muted, align: 'right', valign: 'middle' });
      });
      if (steps.length > 4)
        s.addText(`+ ${steps.length - 4} more step(s): rows flow fits four`, { x: 0.4, y: y0 + 4 * 0.94, w: 9.2, h: 0.3, fontSize: 9, italic: true, color: C.muted });
      return true;
    }
    const n = steps.length || 1;
    const gap = 0.18;
    const colW = (9.2 - gap * (n - 1)) / n;
    const cardH = 3.55;
    steps.forEach((st, i) => {
      const x = 0.4 + i * (colW + gap);
      const cur = st?.current === true;
      s.addShape(pptx.ShapeType.rect, { x, y: y0, w: colW, h: cardH, fill: { color: C.bg2, transparency: 30 }, line: { color: cur ? C.accent : C.line, width: cur ? 1.5 : 0.75 } });
      s.addShape(pptx.ShapeType.line, { x, y: y0 + 0.52, w: colW, h: 0, line: { color: C.line, width: 0.75 } });
      s.addShape(pptx.ShapeType.ellipse, { x: x + 0.12, y: y0 + 0.11, w: 0.3, h: 0.3, fill: { color: C.accent }, line: { type: 'none' } });
      s.addText(String(i + 1), { x: x + 0.12, y: y0 + 0.11, w: 0.3, h: 0.3, fontSize: 10, bold: true, color: C.on_accent, align: 'center', valign: 'middle' });
      s.addText(String(st?.label || ''), { x: x + 0.48, y: y0 + 0.06, w: colW - 0.56, h: 0.4, fontSize: 11, bold: true, color: cur ? C.accent : C.white, valign: 'middle' });
      if (st?.text) s.addText(String(st.text), { x: x + 0.14, y: y0 + 0.62, w: colW - 0.28, h: cardH - 1.12, fontSize: 10, color: C.body, valign: 'top', wrap: true });
      if (st?.date || st?.owner) {
        s.addShape(pptx.ShapeType.line, { x, y: y0 + cardH - 0.4, w: colW, h: 0, line: { color: C.line, width: 0.75 } });
        const half = (colW - 0.28) / 2;
        if (st?.date) s.addText(String(st.date), { x: x + 0.14, y: y0 + cardH - 0.36, w: half, h: 0.3, fontSize: 8, color: C.muted, valign: 'middle' });
        if (st?.owner) s.addText(String(st.owner), { x: x + 0.14 + half, y: y0 + cardH - 0.36, w: half, h: 0.3, fontSize: 8, color: C.muted, align: 'right', valign: 'middle' });
      }
    });
    return true;
  }

  if (type === 'chart') {
    /* Native pptxgenjs charts, not a picture: the numbers stay editable in
       PowerPoint, which is the whole reason to prefer addChart over an SVG. */
    const { kind, unit, labels, series } = normalizeChart(slide);
    const has = slide.heading ? head(5.9) : false;
    if (unit) s.addText(unit, { x: 6.4, y: has ? 0.25 : 0.15, w: 3.2, h: has ? 0.72 : 0.3, fontSize: 10, color: C.muted, align: 'right', valign: 'middle' });
    if (!series.length || !series.some(sr => sr.values.length)) {
      s.addText(`${kind} chart: no series data`, { x: 0.4, y: 2.4, w: 9.2, h: 0.5, fontSize: 13, italic: true, color: C.muted, align: 'center' });
      return true;
    }
    const data = (kind === 'pie' ? series.slice(0, 1) : series)
      .map(sr => ({ name: sr.name || unit || 'value', labels, values: sr.values }));
    const common = {
      x: 0.5, y: has ? 1.2 : 0.55, w: 9.0, h: slide.caption ? 3.35 : 3.7,
      chartColors: seriesColors(t.accent).map(c => c.slice(1).toUpperCase()),
      showLegend: true, legendPos: 'b', legendColor: C.muted, legendFontSize: 10,
    };
    const axes = {
      catAxisLabelColor: C.muted, valAxisLabelColor: C.muted,
      valGridLine: { color: C.dim, style: 'solid', size: 0.5 },
      catGridLine: { style: 'none' },
    };
    if (kind === 'pie') s.addChart(pptx.ChartType.pie, data, common);
    else if (kind === 'line') s.addChart(pptx.ChartType.line, data, { ...common, ...axes, lineSize: 2.5, lineDataSymbol: 'circle', lineDataSymbolSize: 6 });
    else s.addChart(pptx.ChartType.bar, data, { ...common, ...axes, barDir: 'col', barGapWidthPct: 60 });
    if (slide.caption)
      s.addText(slide.caption, { x: 0.4, y: 4.62, w: 9.2, h: 0.3, fontSize: 9, color: C.muted, align: 'center' });
    return true;
  }

  if (type === 'orgchart') {
    const has = head();
    const root = slide.root || {};
    const y0 = has ? 1.15 : 0.6;
    const card = (pn, x, y, w, isRoot) => {
      s.addShape(pptx.ShapeType.rect, { x, y, w, h: 0.62, fill: { color: C.bg2, transparency: 30 }, line: { color: C.line, width: 0.75 } });
      s.addShape(pptx.ShapeType.rect, { x, y, w, h: 0.045, fill: { color: C.accent }, line: { type: 'none' } });
      s.addText(String(pn?.name || ''), { x, y: y + 0.06, w, h: 0.28, fontSize: isRoot ? 12 : 11, bold: true, color: C.white, align: 'center' });
      if (pn?.role) s.addText(String(pn.role), { x, y: y + 0.34, w, h: 0.24, fontSize: 8.5, color: C.muted, align: 'center' });
    };
    card(root, (10 - 2.8) / 2, y0, 2.8, true);
    const kids = root.reports || [];
    if (!kids.length) return true;
    const railY = y0 + 0.84;
    const childY = railY + 0.2;
    const colW = 9.2 / kids.length;
    const centers = kids.map((_, i) => 0.4 + i * colW + colW / 2);
    s.addShape(pptx.ShapeType.line, { x: 5, y: y0 + 0.62, w: 0, h: railY - (y0 + 0.62), line: { color: C.dim, width: 1 } });
    if (kids.length > 1)
      s.addShape(pptx.ShapeType.line, { x: centers[0], y: railY, w: centers[kids.length - 1] - centers[0], h: 0, line: { color: C.dim, width: 1 } });
    kids.forEach((ch, i) => {
      s.addShape(pptx.ShapeType.line, { x: centers[i], y: railY, w: 0, h: childY - railY, line: { color: C.dim, width: 1 } });
      const cw = Math.min(colW - 0.25, 2.6);
      const cx = centers[i] - cw / 2;
      card(ch, cx, childY, cw, false);
      const leaves = descend(ch);
      const shown = leaves.slice(0, 5);
      if (shown.length)
        s.addShape(pptx.ShapeType.line, { x: cx + 0.04, y: childY + 0.72, w: 0, h: shown.length * 0.34, line: { color: C.dim, width: 1 } });
      shown.forEach((lf, li) => {
        s.addText(`${lf?.name || ''}${lf?.role ? ` · ${lf.role}` : ''}`, { x: cx + 0.14, y: childY + 0.72 + li * 0.34, w: cw - 0.14, h: 0.3, fontSize: 8.5, color: C.body, valign: 'middle' });
      });
      if (leaves.length > 5)
        s.addText(`+ ${leaves.length - 5} more`, { x: cx + 0.14, y: childY + 0.72 + 5 * 0.34, w: cw - 0.14, h: 0.26, fontSize: 8, italic: true, color: C.muted, valign: 'middle' });
    });
    return true;
  }
  return false;
}
