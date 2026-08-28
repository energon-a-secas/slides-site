/* ═══════════════════════════════════════════════════════════════════════════
   DOM rendering — editor panel, slide preview, filmstrip, warnings
═══════════════════════════════════════════════════════════════════════════ */

import { state, THEMES, applyTheme, applyPattern, themeWithBrand, resolveBg } from './state.js';
import { esc, inlineMd, scaleSlide } from './utils.js';
import { htmlBlock } from './blocks.js';
import { pageLabel } from './serialize.js';
import { slideHtml } from './slide-html.js';
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
    case 'process':
    case 'chart':
    case 'orgchart': {
      el.innerHTML = htmlBlock(type, slide, themeWithBrand(state.currentTheme, state.meta.brand));
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
    default: {
      const html = slideHtml(type, slide);
      if (html !== null) { el.innerHTML = html; break; }
      el.className = 'slide slide-state';
      el.innerHTML = `<p>Unknown slide type: <strong>${esc(type)}</strong></p>`;
    }
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
