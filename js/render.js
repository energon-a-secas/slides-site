/* ═══════════════════════════════════════════════════════════════════════════
   DOM rendering — editor panel, slide preview, filmstrip, warnings
═══════════════════════════════════════════════════════════════════════════ */

import { state, THEMES, applyTheme, applyPattern, themeWithBrand, resolveBg } from './state.js';
import { esc, inlineMd, scaleSlide } from './utils.js';
import { pageLabel } from './serialize.js';
import { parseYAML, validate } from './parser.js';

/* ── Logo helpers ─────────────────────────────────────────────────────── */

/* `logo: placeholder` renders a generated monogram — the deck title's first
   letter on the accent color — so a draft deck has something in the logo slot
   before brand assets exist. Swapping in the real file later is one line. */
function resolveLogo(meta) {
  if (meta.logo !== 'placeholder') return meta.logo;
  const t = themeWithBrand(state.currentTheme, meta.brand);
  const letter = (meta.title || 'N').trim().charAt(0).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96">` +
    `<circle cx="48" cy="48" r="44" fill="${t.accent}"/>` +
    `<text x="48" y="63" font-size="44" text-anchor="middle" fill="${t.onAccent || '#fff'}" ` +
    `font-family="Avenir Next, -apple-system, sans-serif" font-weight="600">${letter}</text></svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

/* Where the per-slide stamp sits. bottom-right lifts above the slide number,
   which owns that corner. Default (no logo_pos) keeps the CSS top-right. */
/* Kept inside the same graphics-safe band as .slide-num in the stylesheet:
   5% per edge, so 27px vertical and 48px horizontal on a 960x540 slide. */
const LOGO_POS = {
  'top-left':     { top: '24px',  left: '40px',  right: 'auto', bottom: 'auto' },
  'top-right':    { top: '24px',  right: '40px', left: 'auto',  bottom: 'auto' },
  'bottom-left':  { bottom: '24px', left: '40px', top: 'auto',  right: 'auto' },
  'bottom-right': { bottom: '42px', right: '40px', top: 'auto', left: 'auto' },
};


/* Which section a divider opens, and how many the deck has. Dividers are the
   deck's own table of contents, so both the "Section k of n" eyebrow and an
   `auto` agenda read from them rather than from a list the author maintains
   twice. */
function sectionOf(index) {
  let n = 0, k = 0;
  state.slides.forEach((s, i) => {
    if ((s.type || 'bullets') === 'divider') { n++; if (i === index) k = n; }
  });
  return { k, n };
}

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


/* ── Slide renderer → HTMLElement ─────────────────────────────────────── */

export function renderSlide(slide, index, total) {
  const el  = document.createElement('div');
  const num = document.createElement('div');
  num.className = 'slide-num';
  num.textContent = state.slides[index] === slide ? pageLabel(state.slides, index) : `${index + 1} / ${total}`;

  const type = slide.type || 'bullets';
  el.className = `slide slide-type-${type}`;
  applyTheme(el, state.currentTheme, state.meta.brand);

  switch (type) {
    case 'title': {
      const size = state.meta.logo_size;
      const sizeStyle = typeof size === 'number' && size >= 16 && size <= 240
        ? ` style="max-height:${size}px;max-width:${Math.round(size * 2.7)}px"`
        : '';
      const logoHtml = state.meta.logo
        ? `<img class="title-logo" src="${esc(resolveLogo(state.meta))}" alt="logo"${sizeStyle}>`
        : '';
      el.innerHTML = `
        ${logoHtml}
        <div class="s-heading">${esc(slide.heading || state.meta.title)}</div>
        <div class="accent-bar"></div>
        <div class="s-subtitle">${esc(slide.subtitle || state.meta.subtitle)}</div>
        <div class="s-meta">
          <span>${esc(state.meta.author)}</span>
          <span>${esc(slide.date || state.meta.date)}</span>
        </div>`;
      break;
    }
    case 'bullets': {
      const li = (slide.bullets || [])
        .map(b => `<li>${inlineMd(b)}</li>`).join('');
      el.innerHTML = `
        <div class="s-heading">${esc(slide.heading)}</div>
        <ul class="s-bullets">${li}</ul>`;
      break;
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
      el.innerHTML = `
        <div class="s-heading">${esc(slide.heading || '')}</div>
        <div class="split-cols">
          ${mkCol(slide.left)}
          ${mkCol(slide.right)}
        </div>`;
      break;
    }
    case 'code': {
      el.innerHTML = `
        <div class="s-heading">${esc(slide.heading || 'Code')}</div>
        <div class="code-block">
          <div class="code-lang">${esc(slide.language || 'code')}</div>
          <pre>${esc(slide.code || '')}</pre>
        </div>`;
      break;
    }
    case 'quote': {
      el.innerHTML = `
        <div class="quote-mark">"</div>
        <div class="quote-text">${esc(slide.text || '')}</div>
        ${slide.source ? `<div class="quote-source">\u2014 ${esc(slide.source)}</div>` : ''}`;
      break;
    }
    case 'divider': {
      const sec = sectionOf(index);
      const eyebrow = (sec.n > 1 && slide.progress !== false)
        ? `<div class="section-progress">Section ${sec.k} of ${sec.n}</div>` : '';
      el.innerHTML = `
        ${eyebrow}
        <div class="s-heading">${esc(slide.heading || '')}</div>
        <div class="accent-bar" style="margin:14px 0"></div>
        ${slide.subtitle ? `<div class="s-subtitle">${esc(slide.subtitle)}</div>` : ''}`;
      break;
    }
    case 'qa': {
      el.innerHTML = `
        <div class="qa-icon">\uD83D\uDCAC</div>
        <div class="s-heading">${esc(slide.heading || 'Questions?')}</div>
        ${slide.subtext ? `<div class="s-subtext">${esc(slide.subtext)}</div>` : ''}`;
      break;
    }
    case 'cta': {
      el.innerHTML = `
        <div class="s-heading">${esc(slide.heading || 'Next Steps')}</div>
        ${slide.action ? `<div class="cta-pill">\u2192 ${esc(slide.action)}</div>` : ''}
        ${slide.subtext ? `<div class="s-subtext">${esc(slide.subtext)}</div>` : ''}`;
      break;
    }
    case 'image': {
      const caption = slide.caption ? `<div class="image-caption">${esc(slide.caption)}</div>` : '';
      if (slide.heading) {
        el.innerHTML = `
          <div class="s-heading">${esc(slide.heading)}</div>
          <div class="image-container fit-${slide.fit || 'contain'}">
            ${mediaFrame(slide)}
          </div>
          ${caption}`;
      } else {
        el.innerHTML = `
          <div class="image-container full fit-${slide.fit || 'contain'}">
            ${mediaFrame(slide)}
          </div>
          ${caption}`;
      }
      break;
    }
    case 'stats': {
      const items = (slide.stats || []).map(s => `
        <div class="stat-item">
          <div class="stat-value">${esc(s.value || '')}</div>
          <div class="stat-label">${esc(s.label || '')}</div>
        </div>`).join('');
      el.innerHTML = `
        ${slide.heading ? `<div class="s-heading">${esc(slide.heading)}</div>` : ''}
        <div class="stats-grid count-${Math.min((slide.stats || []).length, 4)}">${items}</div>`;
      break;
    }
    case 'timeline': {
      const steps = (slide.steps || []).map((s, si) => `
        <div class="timeline-step">
          <div class="timeline-dot">${si + 1}</div>
          <div class="timeline-label">${esc(s.label || '')}</div>
          <div class="timeline-text">${esc(s.text || '')}</div>
        </div>`).join('');
      el.innerHTML = `
        ${slide.heading ? `<div class="s-heading">${esc(slide.heading)}</div>` : ''}
        <div class="timeline-track">${steps}</div>`;
      break;
    }
    case 'columns': {
      const mkCol = (col) => {
        if (!col) return '';
        return `<div class="text-col">
          ${col.heading ? `<div class="split-col-head">${esc(col.heading)}</div>` : ''}
          <div class="col-text">${esc(col.text || '')}</div>
        </div>`;
      };
      el.innerHTML = `
        ${slide.heading ? `<div class="s-heading">${esc(slide.heading)}</div>` : ''}
        <div class="split-cols">
          ${mkCol(slide.left)}
          ${mkCol(slide.right)}
        </div>`;
      break;
    }
    case 'agenda': {
      /* `auto: true` reads the deck's dividers, so the agenda cannot drift from
         the talk it announces. An explicit `items:` list always wins. */
      const items = (slide.items && slide.items.length)
        ? slide.items
        : (slide.auto
            ? state.slides.filter(s2 => (s2.type || 'bullets') === 'divider').map(s2 => s2.heading || '')
            : []);
      const cur = typeof slide.current === 'number' ? slide.current : 0;
      const li = items.map((it, ii) => {
        const label = typeof it === 'string' ? it : (it?.label || '');
        const text  = typeof it === 'string' ? '' : (it?.text || '');
        return `<li class="agenda-item${ii + 1 === cur ? ' is-current' : ''}">
          <span class="agenda-num">${String(ii + 1).padStart(2, '0')}</span>
          <span class="agenda-body">
            <span class="agenda-label">${inlineMd(label)}</span>
            ${text ? `<span class="agenda-text">${inlineMd(text)}</span>` : ''}
          </span>
        </li>`;
      }).join('');
      el.innerHTML = `
        <div class="s-heading">${esc(slide.heading || 'Agenda')}</div>
        ${slide.subtitle ? `<div class="s-subtitle">${esc(slide.subtitle)}</div>` : ''}
        <ol class="agenda-list${items.length > 5 ? ' two-col' : ''}">${li}</ol>`;
      break;
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
      el.innerHTML = `
        ${slide.heading ? `<div class="s-heading">${esc(slide.heading)}</div>` : ''}
        <div class="table-wrap">
          <table class="slide-table dens-${rows.length > 6 ? 'tight' : 'normal'}">
            ${cols.length ? `<thead><tr>${head}</tr></thead>` : ''}
            <tbody>${body}</tbody>
          </table>
        </div>
        ${slide.caption ? `<div class="table-caption">${esc(slide.caption)}</div>` : ''}`;
      break;
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
      el.innerHTML = `
        ${slide.heading ? `<div class="s-heading">${esc(slide.heading)}</div>` : ''}
        ${slide.subtitle ? `<div class="s-subtitle">${esc(slide.subtitle)}</div>` : ''}
        <div class="grid-items cols-${cols} style-${style}">${cells}</div>`;
      break;
    }
    case 'media': {
      /* Copy in a padded column, media bleeding to the slide edge on the other
         side. The image is the evidence; the column is what to look at in it. */
      const side = slide.side === 'left' ? 'left' : 'right';
      const body = (slide.bullets || []).length
        ? `<ul class="s-bullets">${(slide.bullets || []).map(b => `<li>${inlineMd(b)}</li>`).join('')}</ul>`
        : (slide.text ? `<div class="col-text">${inlineMd(slide.text)}</div>` : '');
      el.innerHTML = `
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
      break;
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
      el.innerHTML = `
        ${slide.heading ? `<div class="s-heading">${esc(slide.heading)}</div>` : ''}
        <div class="table-wrap">
          <table class="slide-table slide-matrix">
            <thead><tr><th></th>${head}</tr></thead>
            <tbody>${body}</tbody>
          </table>
        </div>
        ${slide.caption ? `<div class="table-caption">${esc(slide.caption)}</div>` : ''}`;
      break;
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
      el.innerHTML = `
        ${slide.heading ? `<div class="s-heading">${esc(slide.heading)}</div>` : ''}
        <div class="people-grid cols-${cols}">${cells}</div>`;
      break;
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
      el.innerHTML = `
        ${slide.heading ? `<div class="s-heading">${esc(slide.heading)}</div>` : ''}
        <ul class="check-list">${items}</ul>`;
      break;
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
      el.innerHTML = `
        ${slide.heading ? `<div class="s-heading">${esc(slide.heading)}</div>` : ''}
        <div class="cmp-panes">
          ${pane('Before', slide.before)}
          ${pane('After', slide.after)}
        </div>
        ${slide.caption ? `<div class="table-caption">${esc(slide.caption)}</div>` : ''}`;
      break;
    }
    case 'appendix': {
      el.innerHTML = `
        <div class="appendix-tag">Appendix</div>
        <div class="s-heading">${esc(slide.heading || 'Backup Slides')}</div>
        <div class="accent-bar" style="margin:14px 0"></div>
        ${slide.subtitle ? `<div class="s-subtitle">${esc(slide.subtitle)}</div>` : ''}`;
      break;
    }
    default:
      el.className = 'slide slide-state';
      el.innerHTML = `<p>Unknown slide type: <strong>${esc(type)}</strong></p>`;
  }

  // Per-slide background override
  const bg = resolveBg(slide.background);
  if (bg) el.style.background = bg;

  // Background pattern: per-slide wins over the deck's; `pattern: none` opts a
  // slide out. Applied after the background so it layers over either source.
  const pat = slide.pattern !== undefined ? slide.pattern : state.meta.pattern;
  if (pat && pat !== 'none') applyPattern(el, pat);

  /* The rail: a deck-level note on the left, the handling label and page count
     on the right. When the deck declares neither, the bare slide number stays
     exactly where it was. Title slides carry their own meta line, so the rail
     starts on slide two; any slide can opt out with `rail: false`. */
  const railText = state.meta.footer;
  const railClass = state.meta.classification;
  if ((railText || railClass) && type !== 'title' && slide.rail !== false) {
    const rail = document.createElement('div');
    rail.className = 'slide-rail';
    rail.innerHTML =
      `<span class="rail-note">${esc(railText || '')}</span>` +
      `<span class="rail-right">` +
        (railClass ? `<span class="rail-class">${esc(railClass)}</span>` : '') +
        `<span class="rail-num">${state.slides[index] === slide ? pageLabel(state.slides, index) : `${index + 1} / ${total}`}</span>` +
      `</span>`;
    el.appendChild(rail);
    el.classList.add('has-rail');
  } else {
    el.appendChild(num);
  }

  // Watermark logo on every non-title slide; logo_pos picks its corner
  if (state.meta.logo && state.meta.logo_all && type !== 'title') {
    const wm = document.createElement('img');
    wm.className = 'slide-logo-watermark';
    wm.src = resolveLogo(state.meta);
    wm.alt = '';
    const pos = LOGO_POS[state.meta.logo_pos];
    if (pos) Object.assign(wm.style, pos);
    const ss = state.meta.logo_stamp_size;
    if (typeof ss === 'number' && ss >= 12 && ss <= 120) {
      wm.style.maxHeight = `${ss}px`;
      wm.style.maxWidth = `${Math.round(ss * 2.7)}px`;
    }
    el.appendChild(wm);
  }

  return el;
}

/* ── Stage helpers ────────────────────────────────────────────────────── */

export function showEmpty() {
  document.getElementById('stage').innerHTML = `
    <div class="stage-empty">
      <div class="s-icon">\uD83D\uDCC4</div>
      <p>Paste YAML to get started<br>or open the \u2733 Catalog above</p>
    </div>`;
  document.getElementById('slide-count-badge').textContent = '';
}

export function showError(msg) {
  document.getElementById('stage').innerHTML = `
    <div class="stage-empty">
      <div class="s-icon">\u26A0</div>
      <p style="color:var(--danger);font-family:var(--mono);font-size:.75rem;max-width:80%">${esc(msg)}</p>
    </div>`;
}

export function showSlide(index) {
  const stage = document.getElementById('stage');
  stage.innerHTML = '';
  if (!state.slides.length) { showEmpty(); return; }
  const el = renderSlide(state.slides[index], index, state.slides.length);
  stage.appendChild(el);
  scaleSlide(el, stage);
}

export function updateCounter() {
  const n = state.slides.length;
  document.getElementById('slide-counter').textContent =
    n ? `${state.current + 1} / ${n}` : '\u2014 / \u2014';
  document.getElementById('prev-btn').disabled = state.current === 0 || !n;
  document.getElementById('next-btn').disabled = state.current >= n - 1 || !n;
}

export function updateWarnings(ws) {
  const el = document.getElementById('warnings');
  if (!ws.length) {
    el.className = 'warnings-bar empty';
    el.innerHTML = '\u2713 No issues';
    return;
  }
  el.className = 'warnings-bar';
  /* A count and a legend, because the bar clips at a fixed height and used to
     hide the rest with no sign that anything was missing, and because error,
     warning and note were distinguishable only by colour. */
  const warns = ws.filter(w => w.level === 'warn').length;
  const notes = ws.length - warns;
  const summary = `<div class="warning-summary">${
    warns ? `<b>${warns}</b> to fix` : 'nothing to fix'
  }${notes ? ` · ${notes} note${notes === 1 ? '' : 's'}` : ''}</div>`;
  el.innerHTML = summary + ws.map(w => `
    <div class="warning-item lvl-${w.level}">
      <span class="warning-badge">${w.slide ? `slide ${w.slide}` : 'deck'}</span>
      <span>${esc(w.msg)}</span>
    </div>`).join('');
}

/* ── Filmstrip ────────────────────────────────────────────────────────── */

export function renderFilmstrip() {
  const strip = document.getElementById('filmstrip');
  strip.innerHTML = '';
  const t = themeWithBrand(state.currentTheme, state.meta.brand);
  state.slides.forEach((slide, i) => {
    const type  = slide.type || 'bullets';
    const label = slide.heading || slide.text || slide.action || '';
    const thumb = document.createElement('div');
    thumb.className = 'film-thumb' + (i === state.current ? ' active' : '');
    thumb.style.background = t.bg;
    if (i === state.current) thumb.style.borderColor = t.accent;
    thumb.innerHTML = `
      <div class="film-type">${type}</div>
      <div class="film-num">${i + 1}</div>
      <div class="film-text">${esc(label.substring(0, 28))}</div>`;
    const go = () => { state.current = i; showSlide(i); updateCounter(); syncFilmstrip(); };
    thumb.onclick = go;
    /* Reachable and operable without a mouse: a thumbnail is a button, so it
       announces itself as one and answers Enter and Space. */
    thumb.tabIndex = 0;
    thumb.setAttribute('role', 'button');
    thumb.setAttribute('aria-label', `Slide ${i + 1}, ${type}${label ? ': ' + label.substring(0, 40) : ''}`);
    thumb.setAttribute('aria-current', i === state.current ? 'true' : 'false');
    thumb.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
    };
    strip.appendChild(thumb);
  });
}

export function syncFilmstrip() {
  const thumbs = document.querySelectorAll('.film-thumb');
  const t = themeWithBrand(state.currentTheme, state.meta.brand);
  thumbs.forEach((el, i) => {
    const isActive = i === state.current;
    el.classList.toggle('active', isActive);
    el.style.borderColor = isActive ? t.accent : '';
  });
  const active = document.querySelector('.film-thumb.active');
  if (active) {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    active.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest', inline: 'center' });
  }
}

/* ── Main update loop ─────────────────────────────────────────────────── */

export function update() {
  const text = document.getElementById('yaml-input').value.trim();
  localStorage.setItem('presentation-sage', document.getElementById('yaml-input').value);

  if (!text) {
    state.slides = []; state.meta = {}; state.error = null;
    showEmpty(); updateWarnings([]); updateCounter(); return;
  }

  const result = parseYAML(text);
  if (result.error) {
    state.error = result.error;
    showError(result.error);
    updateWarnings([{ level: 'error', slide: null, msg: result.error }]);
    return;
  }

  state.error  = null;
  state.slides = result.slides;
  state.meta   = result.meta;

  // Deck-declared theme: applies until the visitor picks one themselves this
  // session. Never persisted — localStorage keeps the visitor's own choice.
  const deckTheme = result.meta.theme;
  if (deckTheme && THEMES[deckTheme] && !state.themeOverride && state.currentTheme !== deckTheme) {
    state.currentTheme = deckTheme;
    const sel = document.getElementById('theme-select');
    if (sel) sel.value = deckTheme;
  }

  if (state.current >= state.slides.length)
    state.current = Math.max(0, state.slides.length - 1);

  showSlide(state.current);
  updateCounter();
  updateWarnings(validate(state.slides, state.meta));
  renderFilmstrip();

  const badge = document.getElementById('slide-count-badge');
  badge.textContent = state.slides.length
    ? `${state.slides.length} slide${state.slides.length !== 1 ? 's' : ''}`
    : '';
}

/* ── ResizeObservers ──────────────────────────────────────────────────── */

export function initResizeObservers() {
  const stageObserver = new ResizeObserver(() => {
    const stage = document.getElementById('stage');
    const slide = stage.querySelector('.slide:not(.slide-state)');
    if (slide) scaleSlide(slide, stage);
  });
  stageObserver.observe(document.getElementById('stage'));

  const fsObserver = new ResizeObserver(() => {
    const stage = document.getElementById('fs-slide-host');
    const slide = stage.querySelector('.slide');
    if (slide) scaleSlide(slide, document.getElementById('fs-stage'));
  });
  fsObserver.observe(document.getElementById('fs-stage'));
}
