/* ═══════════════════════════════════════════════════════════════════════════
   Slide HTML: the player markup for the stateless slide types, everything
   renderSlide() can draw from the slide object alone. Split out of
   js/render.js when it outgrew the 500-line rule, the same way js/blocks.js
   took the round-10 types. The stateful cases (title, divider, agenda, the
   delegated block types) stay in render.js with the switch that calls this.
═══════════════════════════════════════════════════════════════════════════ */

import { esc, inlineMd } from './utils.js';

/* Media that is not there yet. A missing `src` renders a labelled frame rather
   than a browser's broken-image glyph, so a deck can be structured before the
   screenshots exist and the gap is legible in the filmstrip. */
function mediaFrame(slide) {
  if (slide.src)
    return `<img src="${esc(slide.src)}" alt="${esc(slide.alt || '')}" class="slide-image">`;
  return `<div class="media-placeholder">
      <div class="mp-label">${esc(slide.alt || slide.caption || 'Media')}</div>
      <div class="mp-sub">add a src</div>
    </div>`;
}

/** Player innerHTML for one slide, or null when render.js owns the type. */
export function slideHtml(type, slide) {
  switch (type) {
    case 'bullets': {
      const li = (slide.bullets || [])
        .map(b => `<li>${inlineMd(b)}</li>`).join('');
      return `
        <div class="s-heading">${esc(slide.heading)}</div>
        <ul class="s-bullets">${li}</ul>`;
    }
    case 'split': {
      const mkCol = (col) => {
        if (!col) return '';
        const li = (col.bullets || []).map(b => `<li>${inlineMd(b)}</li>`).join('');
        return `<div>
          <div class="split-col-head">${esc(col.heading || '')}</div>
          <ul class="s-bullets">${li}</ul>
        </div>`;
      };
      return `
        <div class="s-heading">${esc(slide.heading || '')}</div>
        <div class="split-cols">
          ${mkCol(slide.left)}
          ${mkCol(slide.right)}
        </div>`;
    }
    case 'code': {
      return `
        <div class="s-heading">${esc(slide.heading || 'Code')}</div>
        <div class="code-block">
          <div class="code-lang">${esc(slide.language || 'code')}</div>
          <pre>${esc(slide.code || '')}</pre>
        </div>`;
    }
    case 'quote': {
      return `
        <div class="quote-mark">"</div>
        <div class="quote-text">${esc(slide.text || '')}</div>
        ${slide.source ? `<div class="quote-source">\u2014 ${esc(slide.source)}</div>` : ''}`;
    }
    case 'qa': {
      return `
        <div class="qa-icon">\uD83D\uDCAC</div>
        <div class="s-heading">${esc(slide.heading || 'Questions?')}</div>
        ${slide.subtext ? `<div class="s-subtext">${esc(slide.subtext)}</div>` : ''}`;
    }
    case 'cta': {
      return `
        <div class="s-heading">${esc(slide.heading || 'Next Steps')}</div>
        ${slide.action ? `<div class="cta-pill">\u2192 ${esc(slide.action)}</div>` : ''}
        ${slide.subtext ? `<div class="s-subtext">${esc(slide.subtext)}</div>` : ''}`;
    }
    case 'image': {
      const caption = slide.caption ? `<div class="image-caption">${esc(slide.caption)}</div>` : '';
      if (slide.heading) {
        return `
          <div class="s-heading">${esc(slide.heading)}</div>
          <div class="image-container fit-${slide.fit || 'contain'}">
            ${mediaFrame(slide)}
          </div>
          ${caption}`;
      } else {
        return `
          <div class="image-container full fit-${slide.fit || 'contain'}">
            ${mediaFrame(slide)}
          </div>
          ${caption}`;
      }
    }
    case 'stats': {
      const items = (slide.stats || []).map(s => `
        <div class="stat-item">
          <div class="stat-value">${esc(s.value || '')}</div>
          <div class="stat-label">${esc(s.label || '')}</div>
        </div>`).join('');
      return `
        ${slide.heading ? `<div class="s-heading">${esc(slide.heading)}</div>` : ''}
        <div class="stats-grid count-${Math.min((slide.stats || []).length, 4)}">${items}</div>`;
    }
    case 'timeline': {
      /* `date:` gives a step a calendar label above the axis, and `mark: true`
         renders it as a milestone (an accent-ringed star) instead of the
         numbered dot, so a roadmap can show which node is the release. Every
         step gets the date row once any step has one, or the dots misalign. */
      const stepList = slide.steps || [];
      const hasDates = stepList.some(st => st?.date);
      const steps = stepList.map((st, si) => `
        <div class="timeline-step">
          ${hasDates ? `<div class="timeline-date">${esc(st?.date || '')}</div>` : ''}
          <div class="timeline-dot${st?.mark === true ? ' is-mark' : ''}">${st?.mark === true ? '★' : si + 1}</div>
          <div class="timeline-label">${esc(st?.label || '')}</div>
          <div class="timeline-text">${esc(st?.text || '')}</div>
        </div>`).join('');
      return `
        ${slide.heading ? `<div class="s-heading">${esc(slide.heading)}</div>` : ''}
        <div class="timeline-track${hasDates ? ' has-dates' : ''}">${steps}</div>`;
    }
    case 'columns': {
      const mkCol = (col) => {
        if (!col) return '';
        return `<div class="text-col">
          ${col.heading ? `<div class="split-col-head">${esc(col.heading)}</div>` : ''}
          <div class="col-text">${esc(col.text || '')}</div>
        </div>`;
      };
      return `
        ${slide.heading ? `<div class="s-heading">${esc(slide.heading)}</div>` : ''}
        <div class="split-cols">
          ${mkCol(slide.left)}
          ${mkCol(slide.right)}
        </div>`;
    }
    case 'table': {
      const cols = slide.columns || [];
      const rows = slide.rows || [];
      const align = slide.align || [];
      const al = (ci) => align[ci] === 'right' || align[ci] === 'center' ? ` class="al-${align[ci]}"` : '';
      const head = cols.map((c, ci) => `<th${al(ci)}>${inlineMd(String(c))}</th>`).join('');
      const body = rows.map((r, ri) => {
        const cells = (Array.isArray(r) ? r : [r])
          .map((c, ci) => `<td${al(ci)}>${inlineMd(String(c ?? ''))}</td>`).join('');
        return `<tr class="${ri + 1 === slide.highlight ? 'is-highlight' : ''}">${cells}</tr>`;
      }).join('');
      return `
        ${slide.heading ? `<div class="s-heading">${esc(slide.heading)}</div>` : ''}
        <div class="table-wrap">
          <table class="slide-table dens-${rows.length > 6 ? 'tight' : 'normal'}">
            ${cols.length ? `<thead><tr>${head}</tr></thead>` : ''}
            <tbody>${body}</tbody>
          </table>
        </div>
        ${slide.caption ? `<div class="table-caption">${esc(slide.caption)}</div>` : ''}`;
    }
    case 'grid': {
      const items = slide.items || [];
      const cols = [2, 3, 4].includes(slide.columns)
        ? slide.columns
        : Math.min(Math.max(items.length, 2), 4);
      const style = slide.style === 'plain' ? 'plain' : 'cards';
      const cells = items.map(it => `
        <div class="grid-item">
          ${it?.icon ? `<div class="grid-icon">${esc(it.icon)}</div>` : ''}
          ${it?.heading ? `<div class="grid-item-head">${inlineMd(it.heading)}</div>` : ''}
          ${it?.text ? `<div class="grid-item-text">${inlineMd(it.text)}</div>` : ''}
          ${(it?.bullets || []).length
            ? `<ul class="grid-item-bullets">${(it.bullets || []).map(b => `<li>${inlineMd(b)}</li>`).join('')}</ul>`
            : ''}
        </div>`).join('');
      return `
        ${slide.heading ? `<div class="s-heading">${esc(slide.heading)}</div>` : ''}
        ${slide.subtitle ? `<div class="s-subtitle">${esc(slide.subtitle)}</div>` : ''}
        <div class="grid-items cols-${cols} style-${style}">${cells}</div>`;
    }
    case 'media': {
      /* Copy in a padded column, media bleeding to the slide edge on the other
         side. The image is the evidence; the column is what to look at in it. */
      const side = slide.side === 'left' ? 'left' : 'right';
      const body = (slide.bullets || []).length
        ? `<ul class="s-bullets">${(slide.bullets || []).map(b => `<li>${inlineMd(b)}</li>`).join('')}</ul>`
        : (slide.text ? `<div class="col-text">${inlineMd(slide.text)}</div>` : '');
      return `
        <div class="media-layout side-${side}">
          <div class="media-copy">
            ${slide.heading ? `<div class="s-heading">${esc(slide.heading)}</div>` : ''}
            ${slide.subtitle ? `<div class="s-subtitle">${esc(slide.subtitle)}</div>` : ''}
            ${body}
            ${slide.caption ? `<div class="image-caption">${esc(slide.caption)}</div>` : ''}
          </div>
          <div class="media-figure fit-${slide.fit === 'contain' ? 'contain' : 'cover'}">
            ${mediaFrame(slide)}
          </div>
        </div>`;
    }
    case 'matrix': {
      /* Read down a column, not across a row: a matrix answers "which option"
         where a table answers "what are the numbers". */
      const cols = slide.columns || [];
      const rows = slide.rows || [];
      const MARK = {
        yes:     '<span class="mx-mark mx-yes">✓</span>',
        no:      '<span class="mx-mark mx-no">✕</span>',
        partial: '<span class="mx-mark mx-partial">–</span>',
      };
      const cell = (v) => {
        const key = String(v).trim().toLowerCase();
        if (v === true) return MARK.yes;
        if (v === false) return MARK.no;
        return MARK[key] || inlineMd(String(v ?? ''));
      };
      const hl = (ci) => ci + 1 === slide.highlight ? ' class="is-highlight"' : '';
      const head = cols.map((c, ci) => `<th${hl(ci)}>${inlineMd(String(c))}</th>`).join('');
      const body = rows.map(r => {
        const cells = (r.cells || []).map((c, ci) => `<td${hl(ci)}>${cell(c)}</td>`).join('');
        return `<tr><th class="mx-row-label">${inlineMd(String(r.label || ''))}</th>${cells}</tr>`;
      }).join('');
      return `
        ${slide.heading ? `<div class="s-heading">${esc(slide.heading)}</div>` : ''}
        <div class="table-wrap">
          <table class="slide-table slide-matrix">
            <thead><tr><th></th>${head}</tr></thead>
            <tbody>${body}</tbody>
          </table>
        </div>
        ${slide.caption ? `<div class="table-caption">${esc(slide.caption)}</div>` : ''}`;
    }
    case 'people': {
      const list = slide.people || [];
      const cols = [2, 3, 4, 5].includes(slide.columns)
        ? slide.columns
        : Math.min(Math.max(list.length, 2), 4);
      const initials = (name) => String(name || '?').trim().split(/\s+/)
        .slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
      const cells = list.map(pn => `
        <div class="person">
          ${pn?.src
            ? `<img class="person-face" src="${esc(pn.src)}" alt="${esc(pn.name || '')}">`
            : `<div class="person-face person-initials">${esc(initials(pn?.name))}</div>`}
          <div class="person-name">${esc(pn?.name || '')}</div>
          ${pn?.role ? `<div class="person-role">${esc(pn.role)}</div>` : ''}
        </div>`).join('');
      return `
        ${slide.heading ? `<div class="s-heading">${esc(slide.heading)}</div>` : ''}
        <div class="people-grid cols-${cols}">${cells}</div>`;
    }
    case 'checklist': {
      const STATE = { done: '✓', doing: '◐', blocked: '✕', todo: '○' };
      const items = (slide.items || []).map(it => {
        const st = STATE[it?.state] ? it.state : 'todo';
        return `<li class="check-item is-${st}">
          <span class="check-mark">${STATE[st]}</span>
          <span class="check-body">
            <span class="check-label">${inlineMd(it?.label || '')}</span>
            ${it?.note ? `<span class="check-note">${inlineMd(it.note)}</span>` : ''}
          </span>
          <span class="check-state">${st}</span>
        </li>`;
      }).join('');
      return `
        ${slide.heading ? `<div class="s-heading">${esc(slide.heading)}</div>` : ''}
        <ul class="check-list">${items}</ul>`;
    }
    case 'compare': {
      /* Two frames sharing one caption. Either side may be missing its src and
         still hold its place, which is how a before/after gets built. */
      const pane = (side, def) => `
        <figure class="cmp-pane">
          <figcaption class="cmp-label">${esc(def?.label || side)}</figcaption>
          <div class="cmp-frame fit-${slide.fit === 'contain' ? 'contain' : 'cover'}">
            ${mediaFrame(def || {})}
          </div>
        </figure>`;
      return `
        ${slide.heading ? `<div class="s-heading">${esc(slide.heading)}</div>` : ''}
        <div class="cmp-panes">
          ${pane('Before', slide.before)}
          ${pane('After', slide.after)}
        </div>
        ${slide.caption ? `<div class="table-caption">${esc(slide.caption)}</div>` : ''}`;
    }
    case 'appendix': {
      return `
        <div class="appendix-tag">Appendix</div>
        <div class="s-heading">${esc(slide.heading || 'Backup Slides')}</div>
        <div class="accent-bar" style="margin:14px 0"></div>
        ${slide.subtitle ? `<div class="s-subtitle">${esc(slide.subtitle)}</div>` : ''}`;
    }
    default:
      return null;
  }
}
