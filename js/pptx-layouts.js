/* ═══════════════════════════════════════════════════════════════════════════
   PPTX layouts: the content-layout slide types (agenda, table, grid, media,
   matrix, people, checklist, compare), split out of deckToPptx when
   js/serialize.js outgrew the 500-line rule. Same move js/blocks.js made for
   the round-10 types; the switch in serialize.js delegates here.

   ctx: { pptx, s, slide, slides, C, img } from deckToPptx. Coordinates follow
   the same 10 x 5.625in canvas as every case there: content in x 0.4..9.6,
   the rail band owns y 5.05 and below. DOM-free, like everything the CLI
   imports.
═══════════════════════════════════════════════════════════════════════════ */

/** One content-layout slide type onto pptx slide `s`. Returns true when the
    type was handled here, false when serialize.js still owns it. */
export function pptxLayout(type, ctx) {
  const { pptx, s, slide, slides, C, img } = ctx;

  if (type === 'agenda') {
    s.addText(slide.heading || 'Agenda', { x: 0.4, y: 0.25, w: 9.2, h: 0.72, fontSize: 19, bold: true, color: C.white });
    s.addShape(pptx.ShapeType.line, { x: 0.4, y: 1.05, w: 9.2, h: 0, line: { color: C.line, width: 1, transparency: 85 } });
    const items = (slide.items && slide.items.length)
      ? slide.items
      : (slide.auto ? slides.filter(s2 => (s2.type || 'bullets') === 'divider').map(s2 => s2.heading || '') : []);
    const half = Math.ceil(items.length / 2);
    const twoCol = items.length > 5;
    items.forEach((it, ii) => {
      const label = typeof it === 'string' ? it : (it?.label || '');
      const col = twoCol && ii >= half ? 1 : 0;
      const row = twoCol && ii >= half ? ii - half : ii;
      const x = 0.45 + col * 4.6;
      const y = 1.35 + row * 0.52;
      const isNow = ii + 1 === slide.current;
      s.addText(String(ii + 1).padStart(2, '0'), { x, y, w: 0.45, h: 0.42, fontSize: 12, bold: true, color: C.accent, valign: 'middle' });
      s.addText(label, {
        x: x + 0.5, y, w: twoCol ? 3.9 : 8.6, h: 0.42, fontSize: 13,
        color: isNow ? C.white : C.body, bold: isNow, valign: 'middle',
      });
    });
    return true;
  }

  if (type === 'table') {
    if (slide.heading) {
      s.addText(slide.heading, { x: 0.4, y: 0.25, w: 9.2, h: 0.72, fontSize: 19, bold: true, color: C.white });
    }
    const cols = slide.columns || [];
    const rows = slide.rows || [];
    const colAlign = (ci) => {
      const a = (slide.align || [])[ci];
      return a === 'right' || a === 'center' ? { align: a } : {};
    };
    const body = [];
    if (cols.length)
      body.push(cols.map((c, ci) => ({
        text: String(c),
        options: { bold: true, color: C.on_accent, fill: { color: C.accent }, ...colAlign(ci) },
      })));
    rows.forEach((r, ri) => {
      const cells = Array.isArray(r) ? r : [r];
      body.push(cells.map((c, ci) => ({
        text: String(c ?? ''),
        options: {
          ...colAlign(ci),
          ...(ri + 1 === slide.highlight ? { bold: true, color: C.white } : { color: C.body }),
        },
      })));
    });
    if (body.length)
      s.addTable(body, {
        x: 0.4, y: slide.heading ? 1.15 : 0.5, w: 9.2,
        fontSize: rows.length > 6 ? 9 : 11,
        border: { type: 'solid', color: C.line, pt: 0.5 },
        autoPage: false,
      });
    if (slide.caption)
      s.addText(slide.caption, { x: 0.4, y: 4.66, w: 9.2, h: 0.3, fontSize: 9, color: C.muted });
    return true;
  }

  if (type === 'grid') {
    if (slide.heading) {
      s.addText(slide.heading, { x: 0.4, y: 0.25, w: 9.2, h: 0.72, fontSize: 19, bold: true, color: C.white });
      s.addShape(pptx.ShapeType.line, { x: 0.4, y: 1.05, w: 9.2, h: 0, line: { color: C.line, width: 1, transparency: 85 } });
    }
    const items = slide.items || [];
    const n = [2, 3, 4].includes(slide.columns) ? slide.columns : Math.min(Math.max(items.length, 2), 4);
    const gap = 0.2;
    const cellW = (9.2 - gap * (n - 1)) / n;
    items.forEach((it, ii) => {
      const col = ii % n, row = Math.floor(ii / n);
      const x = 0.4 + col * (cellW + gap);
      const y = 1.3 + row * 1.85;
      if (slide.style !== 'plain')
        s.addShape(pptx.ShapeType.rect, {
          x, y, w: cellW, h: 1.65,
          fill: { color: C.bg2, transparency: 30 },
          line: { color: C.line, width: 0.75 },
        });
      s.addShape(pptx.ShapeType.rect, {
        x, y, w: slide.style === 'plain' ? 0.03 : cellW, h: slide.style === 'plain' ? 1.65 : 0.04,
        fill: { color: C.accent }, line: { type: 'none' },
      });
      const tx = x + (slide.style === 'plain' ? 0.16 : 0.16);
      const tw = cellW - 0.32;
      if (it?.icon)
        s.addText(String(it.icon), { x: tx, y: y + 0.12, w: 0.4, h: 0.3, fontSize: 14, color: C.accent, valign: 'top' });
      if (it?.heading)
        s.addText(String(it.heading), { x: tx + (it?.icon ? 0.42 : 0), y: y + 0.16, w: tw - (it?.icon ? 0.42 : 0), h: 0.4, fontSize: 12, bold: true, color: C.accent, valign: 'top' });
      const lines = [];
      if (it?.text) lines.push(String(it.text));
      (it?.bullets || []).forEach(b => lines.push(`• ${b}`));
      if (lines.length)
        s.addText(lines.join('\n'), { x: tx, y: y + 0.56, w: tw, h: 1.02, fontSize: 10, color: C.body, valign: 'top', wrap: true });
    });
    return true;
  }

  if (type === 'media') {
    const left = slide.side === 'left';
    const copyX = left ? 5.3 : 0.4;
    const imgX  = left ? 0.4 : 5.2;
    if (slide.heading)
      s.addText(slide.heading, { x: copyX, y: 0.4, w: 4.3, h: 0.7, fontSize: 17, bold: true, color: C.white, valign: 'top' });
    if (slide.subtitle)
      s.addText(slide.subtitle, { x: copyX, y: 1.05, w: 4.3, h: 0.35, fontSize: 11, color: C.accent });
    const body = (slide.bullets || []).length
      ? (slide.bullets || []).map(b => `• ${b}`).join('\n')
      : (slide.text || '');
    if (body)
      s.addText(body, { x: copyX, y: 1.5, w: 4.3, h: 3, fontSize: 11, color: C.body, valign: 'top', wrap: true });
    if (slide.src)
      img({ slide: s, path: slide.src, opts: { altText: slide.alt || slide.caption || '', x: imgX, y: 0.4, w: 4.4, h: 4.4, sizing: { type: slide.fit === 'contain' ? 'contain' : 'cover', w: 4.4, h: 4.4 } } });
    else {
      // The player labels its placeholder frame; an unlabelled dashed box
      // in the export tells the reader nothing about what belongs there.
      s.addShape(pptx.ShapeType.rect, { x: imgX, y: 0.4, w: 4.4, h: 4.4, fill: { color: C.bg2, transparency: 40 }, line: { color: C.line, width: 1, dashType: 'dash' } });
      s.addText(String(slide.alt || slide.caption || 'Media'), {
        x: imgX, y: 2.3, w: 4.4, h: 0.6, fontSize: 12, color: C.muted, align: 'center', valign: 'middle', wrap: true,
      });
    }
    if (slide.caption)
      s.addText(slide.caption, { x: copyX, y: 4.6, w: 4.3, h: 0.3, fontSize: 9, color: C.muted });
    return true;
  }

  if (type === 'matrix') {
    if (slide.heading)
      s.addText(slide.heading, { x: 0.4, y: 0.25, w: 9.2, h: 0.72, fontSize: 19, bold: true, color: C.white });
    const cols = slide.columns || [];
    const mark = (v) => v === true ? '✓' : v === false ? '✕'
      : ({ yes: '✓', no: '✕', partial: '–' })[String(v).toLowerCase()] ?? String(v ?? '');
    const hi = (ci) => ci + 1 === slide.highlight;
    const body = [[{ text: '', options: { fill: { color: C.bg2 } } },
      ...cols.map((c, ci) => ({
        text: String(c),
        options: {
          bold: true, align: 'center',
          color: C.on_accent,
          // The winning column is the point of a matrix; without this the
          // reader cannot tell which one the deck is recommending.
          fill: { color: hi(ci) ? C.white : C.accent },
        },
      }))]];
    (slide.rows || []).forEach(r => {
      body.push([{ text: String(r.label || ''), options: { bold: true, color: C.body } },
        ...(r.cells || []).map((c, ci) => ({
          text: mark(c),
          options: { color: hi(ci) ? C.white : C.body, bold: hi(ci), align: 'center' },
        }))]);
    });
    s.addTable(body, {
      x: 0.4, y: slide.heading ? 1.15 : 0.5, w: 9.2, fontSize: 11,
      border: { type: 'solid', color: C.line, pt: 0.5 }, autoPage: false,
    });
    if (slide.caption)
      s.addText(slide.caption, { x: 0.4, y: 4.66, w: 9.2, h: 0.3, fontSize: 9, color: C.muted });
    return true;
  }

  if (type === 'people') {
    if (slide.heading) {
      s.addText(slide.heading, { x: 0.4, y: 0.25, w: 9.2, h: 0.72, fontSize: 19, bold: true, color: C.white });
      s.addShape(pptx.ShapeType.line, { x: 0.4, y: 1.05, w: 9.2, h: 0, line: { color: C.line, width: 1, transparency: 85 } });
    }
    const list = slide.people || [];
    const n = [2, 3, 4, 5].includes(slide.columns) ? slide.columns : Math.min(Math.max(list.length, 2), 4);
    const colW = 9.2 / n;
    list.forEach((pn, pi) => {
      const col = pi % n, row = Math.floor(pi / n);
      const x = 0.4 + col * colW;
      const y = 1.35 + row * 1.85;
      const cx = x + colW / 2 - 0.45;
      if (pn?.src) img({ slide: s, path: pn.src, opts: { altText: pn.name || '', x: cx, y, w: 0.9, h: 0.9, rounding: true } });
      else {
        s.addShape(pptx.ShapeType.ellipse, { x: cx, y, w: 0.9, h: 0.9, fill: { color: C.accent }, line: { type: 'none' } });
        const initials = String(pn?.name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
        s.addText(initials, { x: cx, y, w: 0.9, h: 0.9, fontSize: 18, bold: true, color: C.on_accent, align: 'center', valign: 'middle' });
      }
      s.addText(String(pn?.name || ''), { x, y: y + 1.0, w: colW, h: 0.3, fontSize: 12, bold: true, color: C.white, align: 'center' });
      if (pn?.role)
        s.addText(String(pn.role), { x, y: y + 1.3, w: colW, h: 0.3, fontSize: 10, color: C.muted, align: 'center' });
    });
    return true;
  }

  if (type === 'checklist') {
    if (slide.heading) {
      s.addText(slide.heading, { x: 0.4, y: 0.25, w: 9.2, h: 0.72, fontSize: 19, bold: true, color: C.white });
      s.addShape(pptx.ShapeType.line, { x: 0.4, y: 1.05, w: 9.2, h: 0, line: { color: C.line, width: 1, transparency: 85 } });
    }
    const MARK = { done: '✓', doing: '◐', blocked: '✕', todo: '○' };
    (slide.items || []).forEach((it, ii) => {
      const st = MARK[it?.state] ? it.state : 'todo';
      const y = 1.35 + ii * 0.52;
      s.addText(MARK[st], {
        x: 0.45, y, w: 0.4, h: 0.42, fontSize: 14, bold: true,
        color: st === 'blocked' ? 'EF6A6A' : st === 'done' ? C.accent : C.body,
        align: 'center', valign: 'middle',
      });
      /* The item note carries the owner and the date in real decks
         ("platform, this sprint"), so dropping it lost the accountability
         two slides before a CTA that asks who owns what. */
      s.addText(String(it?.label || ''), {
        x: 0.9, y, w: 7.2, h: it?.note ? 0.26 : 0.42, fontSize: 13, color: C.body, valign: 'middle',
      });
      if (it?.note) {
        s.addText(String(it.note), { x: 0.9, y: y + 0.24, w: 7.2, h: 0.2, fontSize: 9, color: C.muted, valign: 'middle' });
      }
      s.addText(st.toUpperCase(), { x: 8.2, y, w: 1.4, h: 0.42, fontSize: 9, color: C.dim, align: 'right', valign: 'middle' });
    });
    return true;
  }

  if (type === 'compare') {
    if (slide.heading)
      s.addText(slide.heading, { x: 0.4, y: 0.25, w: 9.2, h: 0.72, fontSize: 19, bold: true, color: C.white });
    [['Before', slide.before, 0.4], ['After', slide.after, 5.1]].forEach(([label, def, x]) => {
      s.addText(String(def?.label || label), { x, y: 1.1, w: 4.5, h: 0.3, fontSize: 11, bold: true, color: C.accent });
      if (def?.src)
        img({ slide: s, path: def.src, opts: { altText: def.alt || def.label || '', x, y: 1.45, w: 4.5, h: 3.2, sizing: { type: slide.fit === 'contain' ? 'contain' : 'cover', w: 4.5, h: 3.2 } } });
      else {
        s.addShape(pptx.ShapeType.rect, { x, y: 1.45, w: 4.5, h: 3.2, fill: { color: C.bg2, transparency: 40 }, line: { color: C.line, width: 1, dashType: 'dash' } });
        s.addText(String(def?.alt || label), {
          x, y: 2.8, w: 4.5, h: 0.5, fontSize: 11, color: C.muted, align: 'center', valign: 'middle', wrap: true,
        });
      }
    });
    if (slide.caption)
      s.addText(slide.caption, { x: 0.4, y: 4.66, w: 9.2, h: 0.3, fontSize: 9, color: C.muted });
    return true;
  }

  return false;
}
