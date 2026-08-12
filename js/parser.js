/* ═══════════════════════════════════════════════════════════════════════════
   YAML parsing + slide validation (coaching)
═══════════════════════════════════════════════════════════════════════════ */

import { THEMES } from './state.js';

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
      },
      slides: p.slides || [],
    };
  } catch (e) {
    return { error: e.message };
  }
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
  });

  // Deck-level checks
  if (meta?.theme && !THEMES[meta.theme])
    add('warn', null, `Unknown theme "${meta.theme}" — falling back to the current one. Available: ${Object.keys(THEMES).join(', ')}.`);

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
