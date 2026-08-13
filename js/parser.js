/* ═══════════════════════════════════════════════════════════════════════════
   YAML parsing + slide validation (coaching)
═══════════════════════════════════════════════════════════════════════════ */

import { THEMES, PATTERNS } from './state.js';

/** Parse raw YAML text into { meta, slides } or { error } */
export function parseYAML(text) {
  try {
    // jsyaml is loaded globally via CDN <script> tag
    const doc = jsyaml.load(text);
    if (!doc || !doc.presentation)
      return { error: 'Root key "presentation:" not found' };
    const p = doc.presentation;
    return {
      meta: {
        title:    p.title    || 'Untitled',
        subtitle: p.subtitle || '',
        author:   p.author   || '',
        date:     p.date     || '',
        theme:    p.theme    || '',
        logo:     p.logo     || '',
        logo_all: !!p.logo_all,
        logo_pos: p.logo_pos || '',
        logo_size: p.logo_size || 0,
        logo_stamp_size: p.logo_stamp_size || 0,
        brand:    p.brand    || null,
        pattern:  p.pattern  || '',
      },
      slides: p.slides || [],
    };
  } catch (e) {
    return { error: e.message };
  }
}

/** WCAG relative luminance of a #rgb/#rrggbb color; null when not hex. */
function relLuminance(color) {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(color).trim());
  if (!m) return null;
  let hex = m[1];
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const chan = (i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * chan(0) + 0.7152 * chan(2) + 0.0722 * chan(4);
}

/** Run coaching / density checks on a parsed deck. Returns array of { level, slide, msg } */
export function validate(slides, meta) {
  const W = [];
  const add = (level, slide, msg) => W.push({ level, slide, msg });

  let hasQA  = false;
  let hasCTA = false;

  slides.forEach((slide, i) => {
    const n    = i + 1;
    const type = slide.type || 'bullets';

    if (type === 'qa')  hasQA  = true;
    if (type === 'cta') hasCTA = true;

    if (!slide.heading && !['quote', 'qa', 'cta'].includes(type))
      add('warn', n, 'Missing heading. Every slide needs a clear label.');

    if (type === 'bullets') {
      const bullets = slide.bullets || [];
      if (bullets.length > 5)
        add('warn', n, `${bullets.length} bullets. Aim for 5 or fewer.`);

      bullets.forEach((b, bi) => {
        const words = String(b).trim().split(/\s+/).filter(Boolean);
        if (words.length > 10)
          add('warn', n, `Bullet ${bi + 1}: ${words.length} words. Aim for 10 or fewer.`);
        if (words.length > 5 && String(b).trim().endsWith('.'))
          add('info', n, `Bullet ${bi + 1}: full sentence. Fragments land harder.`);
      });
    }

    if (type === 'code') {
      const lines = (slide.code || '').split('\n').length;
      if (lines > 15)
        add('warn', n, `Code block: ${lines} lines. Trim to 15 or fewer, or show only the key part.`);
    }

    if (type === 'split') {
      const max = Math.max(
        (slide.left?.bullets  || []).length,
        (slide.right?.bullets || []).length
      );
      if (max > 4)
        add('warn', n, `Split slide: ${max} items per column. Keep each column to 4 or fewer.`);
    }

    if (slide.pattern !== undefined && slide.pattern !== 'none' && !PATTERNS[slide.pattern])
      add('warn', n, `Unknown pattern "${slide.pattern}" — ignored. Available: ${Object.keys(PATTERNS).join(', ')}, none.`);
  });

  // Deck-level checks
  if (meta?.theme && !THEMES[meta.theme])
    add('warn', null, `Unknown theme "${meta.theme}" — falling back to the current one. Available: ${Object.keys(THEMES).join(', ')}.`);

  if (meta?.pattern && meta.pattern !== 'none' && !PATTERNS[meta.pattern])
    add('warn', null, `Unknown pattern "${meta.pattern}" — ignored. Available: ${Object.keys(PATTERNS).join(', ')}, none.`);

  if (meta?.brand) {
    const allowed = ['accent', 'bg', 'text', 'on_accent'];
    if (typeof meta.brand !== 'object' || Array.isArray(meta.brand)) {
      add('warn', null, `brand: must be a map of color overrides (${allowed.join(', ')}).`);
    } else {
      for (const k of Object.keys(meta.brand)) {
        if (!allowed.includes(k))
          add('warn', null, `brand.${k} is not a brand key — ignored. Allowed: ${allowed.join(', ')}.`);
        else if (typeof meta.brand[k] !== 'string' || !meta.brand[k])
          add('warn', null, `brand.${k} must be a CSS color string.`);
      }

      // Contrast: brand colors override curated themes, so nothing else vouches
      // for their readability. Pairs are resolved the way the player resolves
      // them (deck theme if valid, else the site default), and a pair is only
      // checked when at least one member comes from brand — fully theme-derived
      // pairs are the theme author's problem, not the deck's.
      const themeName = (meta.theme && THEMES[meta.theme]) ? meta.theme : 'neorgon';
      const base = THEMES[themeName];
      const b = meta.brand;
      const pairs = [
        ['text', b.text || base.text, !!b.text, 'bg', b.bg || base.bg, !!b.bg, 4.5, 'warn'],
        ['on_accent', b.on_accent || '#ffffff', !!b.on_accent, 'accent', b.accent || base.accent, !!b.accent, 3, 'warn'],
        ['accent', b.accent || base.accent, !!b.accent, 'bg', b.bg || base.bg, !!b.bg, 3, 'info'],
      ];
      const unhexed = new Set();
      for (const [an, a, aBrand, bn, bv, bBrand, min, level] of pairs) {
        if (!aBrand && !bBrand) continue;
        const la = relLuminance(a);
        const lb = relLuminance(bv);
        if (la === null || lb === null) {
          const [cn, cv, cBrand] = la === null ? [an, a, aBrand] : [bn, bv, bBrand];
          if (cBrand && !unhexed.has(cn)) {
            unhexed.add(cn);
            add('info', null, `brand ${cn} "${cv}" is not a hex color — contrast unchecked. Use #rrggbb to get the check.`);
          }
          continue;
        }
        const ratio = (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
        if (ratio < min) {
          const from = (name, isBrand) =>
            isBrand ? '' : (name === 'on_accent' ? ` (${name} is the default #ffffff)` : ` (${name} from the ${themeName} theme)`);
          add(level, null,
            `brand contrast: ${an} on ${bn} is ${ratio.toFixed(1)}:1 — below ${min}:1${from(an, aBrand)}${from(bn, bBrand)}.`);
        }
      }
    }
  }

  if (meta?.logo_pos && !['top-left', 'top-right', 'bottom-left', 'bottom-right'].includes(meta.logo_pos))
    add('warn', null, `Unknown logo_pos "${meta.logo_pos}" — using the default (top-right). Corners: top-left, top-right, bottom-left, bottom-right.`);

  if (meta?.logo_size && (typeof meta.logo_size !== 'number' || meta.logo_size < 16 || meta.logo_size > 240))
    add('warn', null, `logo_size ${JSON.stringify(meta.logo_size)} — expected a pixel height between 16 and 240; using the default. Sizes the title-slide logo only; the stamp is logo_stamp_size.`);

  if (meta?.logo_stamp_size && (typeof meta.logo_stamp_size !== 'number' || meta.logo_stamp_size < 12 || meta.logo_stamp_size > 120))
    add('warn', null, `logo_stamp_size ${JSON.stringify(meta.logo_stamp_size)} — expected a pixel height between 12 and 120; using the default (30).`);

  if (meta?.logo && meta.logo !== 'placeholder' && !/^(data:|https?:\/\/|\.?\/)/.test(meta.logo))
    add('info', null,
      `logo "${meta.logo}" is a bare relative path — it resolves against wherever the player is served, ` +
      'not against the YAML file. Use a full URL, a data: URI (the player’s Logo button embeds a local file), ' +
      'or self-host the deck beside the image.');

  if (slides.length > 0 && slides[0].type !== 'title')
    add('info', 1, 'First slide is not a title. Consider adding one for context.');

  if (slides.length > 5 && !hasQA)
    add('info', null, 'No Q&A or pause slide. Add one every 4 to 5 slides.');

  if (slides.length > 3 && !hasCTA)
    add('info', null, 'No CTA slide. What is the one thing your audience should do?');

  const last = slides[slides.length - 1];
  if (last && last.type !== 'cta' && last.type !== 'qa' && slides.length > 2)
    add('info', slides.length, 'Last slide is not a CTA or Q&A. Does it end with a clear action?');

  return W;
}
