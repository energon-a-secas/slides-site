/* ═══════════════════════════════════════════════════════════════════════════
   Serializers — pure deck → Marp Markdown and deck → PPTX.

   No DOM, no toasts, no downloads. The browser (js/export.js) and the CLI
   (render-deck.mjs) both import these, so an export produced on a build server
   is the same export the app hands you. Keeping them here is what stops the
   headless path from quietly drifting from the one people actually look at.
═══════════════════════════════════════════════════════════════════════════ */

import { pptxBlock } from './blocks.js';
import { pptxLayout } from './pptx-layouts.js';

/* deckToMarp moved to js/marp.js in the 500-line split; re-exported here so
   js/export.js, render-deck.mjs and the tests keep one import path. */
export { deckToMarp } from './marp.js';


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

      case 'timeline': {
        if (slide.heading) {
          s.addText(slide.heading, { x: 0.4, y: 0.25, w: 9.2, h: 0.72, fontSize: 19, bold: true, color: C.white });
          s.addShape(pptx.ShapeType.line, { x: 0.4, y: 1.05, w: 9.2, h: 0, line: { color: C.line, width: 1, transparency: 85 } });
        }
        /* Dates ride above the axis, so a dated track shifts the whole row
           down; an undated deck keeps the exact layout it always had. A
           marked step draws an accent-ringed star instead of a numbered dot. */
        const stepList = slide.steps || [];
        const hasDates = stepList.some(st => st?.date);
        const dotY = hasDates ? 1.62 : 1.3;
        stepList.forEach((st, si) => {
          const count = stepList.length;
          const colW = 9.2 / count;
          const x = 0.4 + si * colW;
          if (st?.date)
            s.addText(String(st.date), { x, y: 1.22, w: colW, h: 0.3, fontSize: 8, color: C.muted, align: 'center', valign: 'middle' });
          if (st?.mark === true) {
            s.addShape(pptx.ShapeType.ellipse, { x: x + colW / 2 - 0.2, y: dotY, w: 0.4, h: 0.4, fill: { color: C.bg2 }, line: { color: C.accent, width: 1.5 } });
            s.addText('★', { x: x + colW / 2 - 0.2, y: dotY, w: 0.4, h: 0.4, fontSize: 12, bold: true, color: C.accent, align: 'center', valign: 'middle' });
          } else {
            s.addShape(pptx.ShapeType.ellipse, { x: x + colW / 2 - 0.2, y: dotY, w: 0.4, h: 0.4, fill: { color: C.accent }, line: { type: 'none' } });
            s.addText(String(si + 1), { x: x + colW / 2 - 0.2, y: dotY, w: 0.4, h: 0.4, fontSize: 11, bold: true, color: C.on_accent, align: 'center', valign: 'middle' });
          }
          s.addText(String(st.label || ''), { x, y: dotY + 0.55, w: colW, h: 0.35, fontSize: 9, bold: true, color: C.accent, align: 'center' });
          s.addText(String(st.text || ''), { x, y: dotY + 0.9, w: colW, h: 0.7, fontSize: 10, color: C.body, align: 'center', wrap: true });
        });
        break;
      }

      case 'process':
      case 'chart':
      case 'orgchart':
        pptxBlock(type, { pptx, s, slide, C, t });
        break;

      case 'agenda':
      case 'table':
      case 'grid':
      case 'media':
      case 'matrix':
      case 'people':
      case 'checklist':
      case 'compare':
        pptxLayout(type, { pptx, s, slide, slides, C, img });
        break;

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
