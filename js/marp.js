/* ═══════════════════════════════════════════════════════════════════════════
   Marp serializer: pure deck → Marp Markdown, no DOM.

   Split out of js/serialize.js when that file outgrew the 500-line rule;
   serialize.js re-exports deckToMarp, so every importer (js/export.js, the
   CLI, the tests) keeps its one entry point for both serializers.
═══════════════════════════════════════════════════════════════════════════ */

import { resolveBg } from './state.js';
import { marpBlock } from './blocks.js';

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
        // A ★ marks the milestone step; the per-step date rides in parentheses.
        (slide.steps || []).forEach((s, si) =>
          lines.push(`${si + 1}. ${s.mark === true ? '★ ' : ''}**${s.label || ''}**${s.date ? ` (${s.date})` : ''}${s.text ? `: ${s.text}` : ''}`));
        break;
      case 'process':
      case 'chart':
      case 'orgchart':
        marpBlock(type, slide, lines);
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
