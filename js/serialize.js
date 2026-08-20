/* ═══════════════════════════════════════════════════════════════════════════
   Serializers — pure deck → Marp Markdown and deck → PPTX.

   No DOM, no toasts, no downloads. The browser (js/export.js) and the CLI
   (render-deck.mjs) both import these, so an export produced on a build server
   is the same export the app hands you. Keeping them here is what stops the
   headless path from quietly drifting from the one people actually look at.
═══════════════════════════════════════════════════════════════════════════ */

import { resolveBg } from './state.js';


/* Page label, shared by the player and both serializers so the three cannot
   disagree about how long a deck is. Backup slides after an `appendix` marker
   get their own A-series and the main total stops at the marker: counting them
   in "7 / 20" misreports the talk's length. */
export function pageLabel(slides, index) {
  const total = slides.length;
  const at = slides.findIndex(s => (s.type || 'bullets') === 'appendix');
  if (at === -1) return `${index + 1} / ${total}`;
  if (index < at) return `${index + 1} / ${at}`;
  if (index === at) return 'Appendix';
  return `A${index - at} / A${total - at - 1}`;
}

/** Deck → Marp Markdown. `t` is a resolved theme (themeWithBrand output). */
export function deckToMarp(meta, slides, t) {
  const lines = [
    '---', 'marp: true', 'theme: default', 'paginate: true',
    `backgroundColor: "${t.bg}"`, `color: "${t.text}"`,
    `title: "${meta.title}"`, `author: "${meta.author}"`,
  ];
  /* Marp owns its own footer directive, so the rail becomes a real Marp footer
     rather than text baked into every slide. */
  const railBits = [meta.footer, meta.classification].filter(Boolean);
  if (railBits.length) lines.push(`footer: "${railBits.join('  \u00b7  ')}"`);

  /* Marp's default theme is built on `light-dark()`, which resolves against
     `color-scheme` and not against our `backgroundColor:` directive. On a dark
     deck that left table rows, code blocks and blockquotes on the light branch,
     so a table rendered as white text on white cells at 1.03:1. Declaring the
     scheme flips all of them at once. */
  const lum = (() => {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(t.bg).trim().replace('#', '#'));
    if (!m) return 0;
    const [r, g, b] = [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16) / 255);
    const f = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  })();
  lines.push(`style: |`);
  lines.push(`  section { color-scheme: ${lum < 0.5 ? 'dark' : 'light'}; }`);
  lines.push('---', '');

  const appendixAt = slides.findIndex(s2 => (s2.type || 'bullets') === 'appendix');
  slides.forEach((slide, i) => {
    if (i > 0) lines.push('---', '');
    // Backup slides are not part of the talk's length
    if (appendixAt !== -1 && i >= appendixAt) lines.push('<!-- _paginate: false -->', '');
    const bg = resolveBg(slide.background);
    if (bg) {
      if (bg.includes('gradient')) lines.push(`<!-- _backgroundImage: ${bg} -->`);
      else lines.push(`<!-- _backgroundColor: ${bg} -->`);
      lines.push('');
    }
    const type = slide.type || 'bullets';
    switch (type) {
      case 'title':
        lines.push(`# ${slide.heading || meta.title}`);
        if (slide.subtitle || meta.subtitle) lines.push(``, `**${slide.subtitle || meta.subtitle}**`);
        if (meta.author) lines.push('', meta.author);
        if (meta.date)   lines.push(meta.date);
        break;
      case 'bullets':
        lines.push(`## ${slide.heading || ''}`);
        (slide.bullets || []).forEach(b => lines.push(`- ${b}`));
        break;
      case 'split':
        lines.push(`## ${slide.heading || ''}`);
        lines.push('', `**${slide.left?.heading || 'Left'}**`);
        (slide.left?.bullets  || []).forEach(b => lines.push(`- ${b}`));
        lines.push('', `**${slide.right?.heading || 'Right'}**`);
        (slide.right?.bullets || []).forEach(b => lines.push(`- ${b}`));
        break;
      case 'code':
        lines.push(`## ${slide.heading || 'Code'}`, '',
          `\`\`\`${slide.language || ''}`, slide.code || '', '```');
        break;
      case 'quote':
        lines.push(`> ${slide.text || ''}`);
        if (slide.source) lines.push('', `\u2014 ${slide.source}`);
        break;
      case 'divider':
        lines.push(`# ${slide.heading || ''}`);
        if (slide.subtitle) lines.push('', slide.subtitle);
        break;
      case 'qa':
        lines.push(`# ${slide.heading || 'Questions?'}`);
        if (slide.subtext) lines.push('', slide.subtext);
        break;
      case 'cta':
        lines.push(`# ${slide.heading || 'Next Steps'}`);
        if (slide.action) lines.push('', `**\u2192 ${slide.action}**`);
        if (slide.subtext) lines.push('', slide.subtext);
        break;
      case 'image':
        if (slide.heading) lines.push(`## ${slide.heading}`);
        // No src is a deliberate placeholder in the player; an empty ![]() is
        // just a broken image in Marp, so the gap is written out in words.
        if (slide.src) lines.push(`![${slide.alt || ''}](${slide.src})`);
        else lines.push('', `*[${slide.alt || slide.caption || 'Media'}: no src yet]*`);
        if (slide.caption) lines.push('', `*${slide.caption}*`);
        break;
      case 'stats': {
        /* `### **31%**` rendered as a small heading in a vertical list, which
           loses the entire point of the type. A table row keeps the numbers on
           one line, side by side, and Marp sizes table text consistently. */
        if (slide.heading) lines.push(`## ${slide.heading}`, '');
        const st = slide.stats || [];
        if (st.length) {
          lines.push(`| ${st.map(x => `**${x.value ?? ''}**`).join(' | ')} |`);
          lines.push(`|${st.map(() => ' :---: ').join('|')}|`);
          lines.push(`| ${st.map(x => x.label || '').join(' | ')} |`);
        }
        break;
      }
      case 'timeline':
        if (slide.heading) lines.push(`## ${slide.heading}`);
        (slide.steps || []).forEach((s, si) =>
          lines.push(`${si + 1}. **${s.label || ''}** — ${s.text || ''}`));
        break;
      case 'agenda': {
        lines.push(`## ${slide.heading || 'Agenda'}`);
        const items = (slide.items && slide.items.length)
          ? slide.items
          : (slide.auto ? slides.filter(s2 => (s2.type || 'bullets') === 'divider').map(s2 => s2.heading || '') : []);
        items.forEach((it, ii) => {
          const label = typeof it === 'string' ? it : (it?.label || '');
          const text  = typeof it === 'string' ? '' : (it?.text || '');
          const now = ii + 1 === slide.current ? ' ←' : '';
          lines.push(`${ii + 1}. **${label}**${text ? `: ${text}` : ''}${now}`);
        });
        break;
      }
      case 'table': {
        if (slide.heading) lines.push(`## ${slide.heading}`, '');
        const cols = slide.columns || [];
        if (cols.length) {
          lines.push(`| ${cols.join(' | ')} |`);
          // Markdown carries alignment in the separator row; it was always ' --- '
          lines.push(`|${cols.map((_c, ci) => {
            const a = (slide.align || [])[ci];
            return a === 'right' ? ' ---: ' : a === 'center' ? ' :---: ' : ' --- ';
          }).join('|')}|`);
        }
        (slide.rows || []).forEach(r => {
          const cells = Array.isArray(r) ? r : [r];
          lines.push(`| ${cells.map(c => String(c ?? '')).join(' | ')} |`);
        });
        if (slide.caption) lines.push('', `*${slide.caption}*`);
        break;
      }
      case 'grid':
        if (slide.heading) lines.push(`## ${slide.heading}`);
        (slide.items || []).forEach(it => {
          lines.push('', `**${it?.heading || ''}**`);
          if (it?.text) lines.push('', it.text);
          (it?.bullets || []).forEach(b => lines.push(`- ${b}`));
        });
        break;
      case 'media':
        if (slide.heading) lines.push(`## ${slide.heading}`);
        if (slide.subtitle) lines.push('', `**${slide.subtitle}**`);
        if (slide.src) lines.push('', `![bg ${slide.side === 'left' ? 'left' : 'right'}](${slide.src})`);
        lines.push('');
        (slide.bullets || []).forEach(b => lines.push(`- ${b}`));
        if (slide.text) lines.push(slide.text);
        if (slide.caption) lines.push('', `*${slide.caption}*`);
        break;
      case 'matrix': {
        if (slide.heading) lines.push(`## ${slide.heading}`, '');
        const cols = slide.columns || [];
        const mark = (v) => v === true ? 'yes' : v === false ? 'no' : String(v ?? '');
        if (cols.length) {
          lines.push(`| | ${cols.join(' | ')} |`);
          lines.push(`|${['', ...cols].map(() => ' --- ').join('|')}|`);
        }
        (slide.rows || []).forEach(r => {
          lines.push(`| **${r.label || ''}** | ${(r.cells || []).map(mark).join(' | ')} |`);
        });
        if (slide.caption) lines.push('', `*${slide.caption}*`);
        break;
      }
      case 'people':
        if (slide.heading) lines.push(`## ${slide.heading}`);
        (slide.people || []).forEach(pn =>
          lines.push(`- **${pn?.name || ''}**${pn?.role ? ` \u2014 ${pn.role}` : ''}`));
        break;
      case 'checklist': {
        if (slide.heading) lines.push(`## ${slide.heading}`);
        const BOX = { done: '[x]', doing: '[~]', blocked: '[!]', todo: '[ ]' };
        (slide.items || []).forEach(it =>
          lines.push(`- ${BOX[it?.state] || BOX.todo} ${it?.label || ''}${it?.note ? ` (${it.note})` : ''}`));
        break;
      }
      case 'compare':
        if (slide.heading) lines.push(`## ${slide.heading}`);
        [['before', slide.before], ['after', slide.after]].forEach(([k, def]) => {
          lines.push('', `**${def?.label || k}**`);
          if (def?.src) lines.push('', `![${def.alt || ''}](${def.src})`);
          else lines.push('', `*[${def?.alt || k}: no src yet]*`);
        });
        if (slide.caption) lines.push('', `*${slide.caption}*`);
        break;
      case 'appendix':
        lines.push(`# ${slide.heading || 'Backup Slides'}`);
        if (slide.subtitle) lines.push('', slide.subtitle);
        break;
      case 'columns':
        if (slide.heading) lines.push(`## ${slide.heading}`);
        if (slide.left) {
          lines.push('', `**${slide.left.heading || 'Left'}**`, '', slide.left.text || '');
        }
        if (slide.right) {
          lines.push('', `**${slide.right.heading || 'Right'}**`, '', slide.right.text || '');
        }
        break;
    }
    lines.push('');
  });
  return lines.join('\n');
}

/** Fill a PptxGenJS instance from a deck. The instance is passed in so the
    caller owns the library import: a CDN global in the browser, an npm import
    in Node. */
export function deckToPptx(pptx, meta, slides, t, opts = {}) {
  /* pptxgenjs reserves two relationship ids for an SVG, a raster preview plus
     the vector, but in Node it fills the preview slot with the SVG's own bytes
     under a .png name. Its source says as much: "SVG is not supported in Node".
     Only PowerPoint 2016+ reads the svgBlip that points at the real vector, so
     everywhere else, Keynote, LibreOffice, Google Slides, older PowerPoint, the
     image is a broken icon.

     `resolveImage` lets the caller hand back a raster instead. The browser
     rasterises through a canvas; the CLI shells out to whatever is installed.
     With no resolver, an SVG is reported and skipped rather than embedded
     broken: a missing picture is obvious, a corrupt one is not. */
  const resolveImage = opts.resolveImage || ((src) => src);
  const skipped = [];
  const img = (o) => {
    const out = resolveImage(o.path);
    if (out) { s2AddImage(o, out); return; }
    skipped.push(o.path);
  };
  /* pptxgenjs takes a filesystem path or URL as `path`, and a data URI as
     `data`. Passing a data URI as `path` writes a file it cannot read. */
  const s2AddImage = (o, resolved) => o.slide.addImage(
    String(resolved).startsWith('data:')
      ? { ...o.opts, data: resolved }
      : { ...o.opts, path: resolved });
  /* Every coordinate below was authored against a 10 x 5.625in canvas, which
     is LAYOUT_16x9. LAYOUT_WIDE is 13.33 x 7.5in, so it left the content in
     the top-left 73% of each slide and pushed the "centred" title block 1.67in
     off centre. Same 16:9 shape, right inch count. */
  pptx.layout = 'LAYOUT_16x9';
  // PPTX shapes have no alpha channel in fills' hex — recover the rgba alpha
  // so translucent theme tokens become a transparency percentage instead.
  const alphaOf = (css) => {
    const m = String(css || '').match(/rgba\([^)]*,\s*([\d.]+)\s*\)/);
    return m ? parseFloat(m[1]) : 1;
  };

  /* Text has no transparency in PPTX, so a translucent token has to be flattened
     against the background it will sit on. Discarding the alpha instead turned
     `muted` (45%) and `dim` (22%) into pure white, which made the footer rail and
     the page number brighter than the body text and the heading: the hierarchy
     did not flatten, it inverted. */
  const rgbOf = (css) => {
    const s = String(css || '');
    if (s.startsWith('#')) {
      const h = s.slice(1);
      const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h.slice(0, 6);
      return [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16));
    }
    const m = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    return m ? [+m[1], +m[2], +m[3]] : null;
  };
  const toHex = (rgb) => rgb.map(n => Math.round(n).toString(16).padStart(2, '0')).join('');
  const hex = (css, over) => {
    const rgb = rgbOf(css);
    if (!rgb) return 'FFFFFF';
    const a = alphaOf(css);
    if (a >= 1) return toHex(rgb);
    const base = rgbOf(over ?? t.bg) || [0, 0, 0];
    return toHex(rgb.map((c, i) => c * a + base[i] * (1 - a)));
  };
  const C = {
    bg:      hex(t.bg),
    bg2:     hex(t.bg),
    accent:  hex(t.accent),
    on_accent: hex(t.onAccent || '#ffffff'),
    white:   hex(t.text),
    body:    hex(t.ts),
    line:    hex(t.text),
    muted:   hex(t.muted) || '8899bb',
    dim:     hex(t.dim) || '445566',
    bullet:  hex(t.codeText),
    code_bg: hex(t.codeBg),
    code_tr: Math.round((1 - alphaOf(t.codeBg)) * 100),
  };

  /* The rail band owns y 5.05 and below. Captions used to end at 5.20 and
     printed straight through it, which read as one smudged two-line clump. */
  slides.forEach((slide, slideIdx) => {
    const s    = pptx.addSlide();
    const type = slide.type || 'bullets';
    s.background = { color: C.bg2 };

    // Top accent stripe
    s.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: '100%', h: 0.04,
      fill: { color: C.accent }, line: { type: 'none' },
    });

    switch (type) {
      case 'title':
        s.addText(slide.heading || meta.title || '', {
          x: 0.8, y: 1.3, w: 8.4, h: 1.4,
          fontSize: 34, bold: true, color: C.white,
          align: 'center', valign: 'middle',
        });
        s.addShape(pptx.ShapeType.rect, {
          x: 4.25, y: 2.9, w: 1.5, h: 0.055,
          fill: { color: C.accent }, line: { type: 'none' },
        });
        if (slide.subtitle || meta.subtitle) {
          s.addText(slide.subtitle || meta.subtitle, {
            x: 0.8, y: 3.1, w: 8.4, h: 0.7,
            fontSize: 15, color: C.muted, align: 'center',
          });
        }
        if (meta.author)
          s.addText(meta.author, { x: 0.5, y: 4.58, w: 3.9, h: 0.34, fontSize: 10, color: C.dim });
        if (meta.date || slide.date)
          /* Clear of the rail band (y 5.05) and of the page number (x 8.60):
             these two ran into each other on every title slide. */
          s.addText(slide.date || meta.date, {
            x: 4.6, y: 4.58, w: 3.9, h: 0.34, fontSize: 10, color: C.dim, align: 'right',
          });
        break;

      case 'bullets':
        s.addText(slide.heading || '', {
          x: 0.4, y: 0.25, w: 9.2, h: 0.72,
          fontSize: 19, bold: true, color: C.white, valign: 'middle',
        });
        s.addShape(pptx.ShapeType.line, {
          x: 0.4, y: 1.05, w: 9.2, h: 0, line: { color: C.line, width: 1, transparency: 85 },
        });
        (slide.bullets || []).forEach((b, i) => {
          s.addShape(pptx.ShapeType.ellipse, {
            x: 0.45, y: 1.35 + i * 0.62 + 0.15, w: 0.1, h: 0.1,
            fill: { color: C.accent }, line: { type: 'none' },
          });
          s.addText(String(b), {
            x: 0.68, y: 1.3 + i * 0.62, w: 8.9, h: 0.56,
            fontSize: 13, color: C.body, valign: 'middle',
          });
        });
        break;

      case 'split': {
        s.addText(slide.heading || '', {
          x: 0.4, y: 0.25, w: 9.2, h: 0.72,
          fontSize: 19, bold: true, color: C.white,
        });
        s.addShape(pptx.ShapeType.line, {
          x: 0.4, y: 1.05, w: 9.2, h: 0, line: { color: C.line, width: 1, transparency: 85 },
        });
        s.addShape(pptx.ShapeType.line, {
          x: 5, y: 1.15, w: 0, h: 3.5, line: { color: C.line, width: 1, transparency: 85 },
        });
        if (slide.left?.heading)
          s.addText(slide.left.heading, {
            x: 0.4, y: 1.15, w: 4.3, h: 0.42, fontSize: 11, bold: true, color: C.accent,
          });
        (slide.left?.bullets || []).forEach((b, i) =>
          s.addText(`\u2022 ${b}`, { x: 0.4, y: 1.65 + i * 0.56, w: 4.3, h: 0.5, fontSize: 12, color: C.body }));
        if (slide.right?.heading)
          s.addText(slide.right.heading, {
            x: 5.3, y: 1.15, w: 4.3, h: 0.42, fontSize: 11, bold: true, color: C.accent,
          });
        (slide.right?.bullets || []).forEach((b, i) =>
          s.addText(`\u2022 ${b}`, { x: 5.3, y: 1.65 + i * 0.56, w: 4.3, h: 0.5, fontSize: 12, color: C.body }));
        break;
      }

      case 'code':
        s.addText(slide.heading || 'Code', {
          x: 0.4, y: 0.25, w: 9.2, h: 0.72, fontSize: 19, bold: true, color: C.white,
        });
        s.addShape(pptx.ShapeType.rect, {
          x: 0.4, y: 1.05, w: 9.2, h: 3.6,
          fill: { color: C.code_bg, transparency: C.code_tr }, line: { color: C.line, width: 1, transparency: 85 },
        });
        s.addText(slide.code || '', {
          x: 0.6, y: 1.15, w: 8.8, h: 3.4,
          fontSize: 10, fontFace: 'Courier New', color: C.bullet,
          valign: 'top', wrap: true,
        });
        break;

      case 'quote':
        /* The mark sits above the quote rather than behind its first line: the
           box used to run 0.60in into the text box below it. */
        s.addText('"', { x: 0.4, y: 0.25, w: 1.2, h: 0.7, fontSize: 54, color: C.accent, bold: true });
        s.addText(slide.text || '', {
          x: 0.8, y: 1.0, w: 8.4, h: 2.6,
          fontSize: 17, color: C.white, italic: true,
          align: 'center', valign: 'middle',
        });
        if (slide.source)
          s.addText(`\u2014 ${slide.source}`, {
            x: 0.8, y: 3.8, w: 8.4, h: 0.5,
            fontSize: 13, color: C.accent, bold: true, align: 'center',
          });
        break;

      case 'divider':
        s.background = { color: C.bg2 };
        s.addText(slide.heading || '', {
          x: 0.8, y: 1.4, w: 8.4, h: 1.4,
          fontSize: 34, bold: true, color: C.white, align: 'center',
        });
        s.addShape(pptx.ShapeType.rect, {
          x: 4.25, y: 3.0, w: 1.5, h: 0.055,
          fill: { color: C.accent }, line: { type: 'none' },
        });
        if (slide.subtitle)
          s.addText(slide.subtitle, {
            x: 0.8, y: 3.2, w: 8.4, h: 0.6, fontSize: 14, color: C.muted, align: 'center',
          });
        break;

      case 'qa':
        s.addText('\uD83D\uDCAC', { x: 4, y: 0.7, w: 2, h: 1.2, fontSize: 40, align: 'center' });
        s.addText(slide.heading || 'Questions?', {
          x: 0.8, y: 2.0, w: 8.4, h: 1.4,
          fontSize: 34, bold: true, color: C.white, align: 'center',
        });
        if (slide.subtext)
          s.addText(slide.subtext, {
            x: 0.8, y: 3.6, w: 8.4, h: 0.5, fontSize: 13, color: C.muted, align: 'center',
          });
        break;

      case 'cta':
        s.addText(slide.heading || 'Next Steps', {
          x: 0.8, y: 0.8, w: 8.4, h: 1.4,
          fontSize: 28, bold: true, color: C.white, align: 'center',
        });
        if (slide.action) {
          s.addShape(pptx.ShapeType.roundRect, {
            x: 2.5, y: 2.5, w: 5, h: 0.95,
            fill: { color: C.accent }, line: { type: 'none' }, rectRadius: 0.1,
          });
          s.addText(`\u2192 ${slide.action}`, {
            x: 2.5, y: 2.5, w: 5, h: 0.95,
            fontSize: 15, bold: true, color: C.on_accent, align: 'center', valign: 'middle',
          });
        }
        if (slide.subtext)
          s.addText(slide.subtext, {
            x: 0.8, y: 3.65, w: 8.4, h: 0.5, fontSize: 12, color: C.muted, align: 'center',
          });
        break;

      case 'image':
        if (slide.heading)
          s.addText(slide.heading, { x: 0.4, y: 0.25, w: 9.2, h: 0.72, fontSize: 19, bold: true, color: C.white });
        if (slide.src)
          img({ slide: s, path: slide.src, opts: { altText: slide.alt || slide.caption || '', x: 1.5, y: slide.heading ? 1.2 : 0.4, w: 7, h: 4, sizing: { type: slide.fit === 'cover' ? 'cover' : 'contain', w: 7, h: 4 } } });
        if (slide.caption)
          s.addText(slide.caption, { x: 0.4, y: 4.62, w: 9.2, h: 0.34, fontSize: 10, color: C.muted, align: 'center' });
        break;

      case 'stats':
        if (slide.heading) {
          s.addText(slide.heading, { x: 0.4, y: 0.25, w: 9.2, h: 0.72, fontSize: 19, bold: true, color: C.white });
          s.addShape(pptx.ShapeType.line, { x: 0.4, y: 1.05, w: 9.2, h: 0, line: { color: C.line, width: 1, transparency: 85 } });
        }
        (slide.stats || []).forEach((st, si) => {
          const count = (slide.stats || []).length;
          const colW = 9.2 / count;
          const x = 0.4 + si * colW;
          s.addText(String(st.value || ''), { x, y: 1.5, w: colW, h: 1.2, fontSize: 36, bold: true, color: C.accent, align: 'center' });
          s.addText(String(st.label || ''), { x, y: 2.7, w: colW, h: 0.5, fontSize: 11, color: C.muted, align: 'center' });
        });
        break;

      case 'timeline':
        if (slide.heading) {
          s.addText(slide.heading, { x: 0.4, y: 0.25, w: 9.2, h: 0.72, fontSize: 19, bold: true, color: C.white });
          s.addShape(pptx.ShapeType.line, { x: 0.4, y: 1.05, w: 9.2, h: 0, line: { color: C.line, width: 1, transparency: 85 } });
        }
        (slide.steps || []).forEach((st, si) => {
          const count = (slide.steps || []).length;
          const colW = 9.2 / count;
          const x = 0.4 + si * colW;
          s.addShape(pptx.ShapeType.ellipse, { x: x + colW / 2 - 0.2, y: 1.3, w: 0.4, h: 0.4, fill: { color: C.accent }, line: { type: 'none' } });
          s.addText(String(si + 1), { x: x + colW / 2 - 0.2, y: 1.3, w: 0.4, h: 0.4, fontSize: 11, bold: true, color: C.on_accent, align: 'center', valign: 'middle' });
          s.addText(String(st.label || ''), { x, y: 1.85, w: colW, h: 0.35, fontSize: 9, bold: true, color: C.accent, align: 'center' });
          s.addText(String(st.text || ''), { x, y: 2.2, w: colW, h: 0.7, fontSize: 10, color: C.body, align: 'center', wrap: true });
        });
        break;

      case 'agenda': {
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
        break;
      }

      case 'table': {
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
        break;
      }

      case 'grid': {
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
        break;
      }

      case 'media': {
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
        break;
      }

      case 'matrix': {
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
        break;
      }

      case 'people': {
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
        break;
      }

      case 'checklist': {
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
        break;
      }

      case 'compare': {
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
        break;
      }

      case 'appendix':
        s.addText('APPENDIX', { x: 0.8, y: 1.9, w: 8.4, h: 0.35, fontSize: 11, bold: true, color: C.accent, charSpacing: 2 });
        s.addText(slide.heading || 'Backup Slides', { x: 0.8, y: 2.3, w: 8.4, h: 0.9, fontSize: 30, bold: true, color: C.white });
        if (slide.subtitle)
          s.addText(slide.subtitle, { x: 0.8, y: 3.2, w: 8.4, h: 0.5, fontSize: 13, color: C.muted });
        break;

      case 'columns':
        if (slide.heading) {
          s.addText(slide.heading, { x: 0.4, y: 0.25, w: 9.2, h: 0.72, fontSize: 19, bold: true, color: C.white });
          s.addShape(pptx.ShapeType.line, { x: 0.4, y: 1.05, w: 9.2, h: 0, line: { color: C.line, width: 1, transparency: 85 } });
          s.addShape(pptx.ShapeType.line, { x: 5, y: 1.15, w: 0, h: 3.5, line: { color: C.line, width: 1, transparency: 85 } });
        }
        if (slide.left?.heading)
          s.addText(slide.left.heading, { x: 0.4, y: 1.15, w: 4.3, h: 0.42, fontSize: 11, bold: true, color: C.accent });
        if (slide.left?.text)
          s.addText(slide.left.text, { x: 0.4, y: 1.65, w: 4.3, h: 3, fontSize: 11, color: C.body, wrap: true, valign: 'top' });
        if (slide.right?.heading)
          s.addText(slide.right.heading, { x: 5.3, y: 1.15, w: 4.3, h: 0.42, fontSize: 11, bold: true, color: C.accent });
        if (slide.right?.text)
          s.addText(slide.right.text, { x: 5.3, y: 1.65, w: 4.3, h: 3, fontSize: 11, color: C.body, wrap: true, valign: 'top' });
        break;
    }

    /* The deck's logo: on the title slide at `logo_size`, and stamped in a
       corner of every other slide when `logo_all` is set. Both exports dropped
       it entirely, so a branded deck arrived unbranded. `placeholder` is a
       player-only convenience (it generates a monogram) and has no file to
       embed, so it is skipped here rather than faked. */
    if (meta.logo && meta.logo !== 'placeholder') {
      const inches = (px, fallback) =>
        (typeof px === 'number' && px > 0 ? px : fallback) / 96;
      if (type === 'title') {
        const h = inches(meta.logo_size, 52);
        img({ slide: s, path: meta.logo, opts: { x: 0.8, y: 0.55, h, w: h * 2.7, sizing: { type: 'contain', w: h * 2.7, h } } });
      } else if (meta.logo_all) {
        const h = inches(meta.logo_stamp_size, 30);
        const w = h * 2.7;
        const pos = {
          'top-left':     { x: 0.4,        y: 0.28 },
          'bottom-left':  { x: 0.4,        y: 5.625 - 0.28 - h },
          'bottom-right': { x: 10 - 0.4 - w, y: 5.625 - 0.62 - h },
          'top-right':    { x: 10 - 0.4 - w, y: 0.28 },
        }[meta.logo_pos] || { x: 10 - 0.4 - w, y: 0.28 };
        img({ slide: s, ...pos, path: meta.logo, opts: { ...pos, h, w, sizing: { type: 'contain', w, h } } });
      }
    }

    /* Speaker notes. The schema has carried `note:` since the beginning and the
       player shows it, but no export did, so anyone presenting from a file had
       no script. */
    if (slide.note) s.addNotes(String(slide.note));

    // Slide number, and the deck rail beside it when the deck declares one
    const railOn = (meta.footer || meta.classification) && type !== 'title' && slide.rail !== false;
    if (railOn) {
      if (meta.footer)
        s.addText(meta.footer, { x: 0.4, y: 5.05, w: 5.9, h: 0.3, fontSize: 8, color: C.dim });
      if (meta.classification)
        s.addText(String(meta.classification).toUpperCase(), {
          x: 6.4, y: 5.05, w: 2.0, h: 0.3, fontSize: 8, bold: true, color: C.muted, align: 'right',
        });
    }
    /* indexOf() matched by object identity, so a deck using YAML anchors gave
       every alias the first slide's number. The loop index cannot do that. */
    s.addText(pageLabel(slides, slideIdx), {
      x: 8.6, y: 5.05, w: 1.1, h: 0.3,
      fontSize: 8, color: C.dim, align: 'right',
    });
  });
  if (skipped.length) {
    console.warn(
      `deckToPptx: ${skipped.length} image(s) skipped because no rasteriser was ` +
      `supplied and PPTX cannot embed SVG portably:\n  ` + skipped.join('\n  ') +
      `\nSupply opts.resolveImage, or use a PNG/JPEG source.`);
  }
  return pptx;
}
