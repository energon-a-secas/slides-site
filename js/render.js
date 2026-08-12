/* ═══════════════════════════════════════════════════════════════════════════
   DOM rendering — editor panel, slide preview, filmstrip, warnings
═══════════════════════════════════════════════════════════════════════════ */

import { state, THEMES, applyTheme, applyPattern, themeWithBrand, resolveBg } from './state.js';
import { esc, inlineMd, scaleSlide } from './utils.js';
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
const LOGO_POS = {
  'top-left':     { top: '16px',  left: '18px',  right: 'auto', bottom: 'auto' },
  'top-right':    { top: '16px',  right: '18px', left: 'auto',  bottom: 'auto' },
  'bottom-left':  { bottom: '14px', left: '18px', top: 'auto',  right: 'auto' },
  'bottom-right': { bottom: '32px', right: '18px', top: 'auto', left: 'auto' },
};

/* ── Slide renderer → HTMLElement ─────────────────────────────────────── */

export function renderSlide(slide, index, total) {
  const el  = document.createElement('div');
  const num = document.createElement('div');
  num.className = 'slide-num';
  num.textContent = `${index + 1} / ${total}`;

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
      el.innerHTML = `
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
            <img src="${esc(slide.src || '')}" alt="${esc(slide.alt || '')}" class="slide-image">
          </div>
          ${caption}`;
      } else {
        el.innerHTML = `
          <div class="image-container full fit-${slide.fit || 'contain'}">
            <img src="${esc(slide.src || '')}" alt="${esc(slide.alt || '')}" class="slide-image">
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

  el.appendChild(num);

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
      <p>Paste YAML to get started<br>or click \u2295 Sample above</p>
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
  el.innerHTML = ws.map(w => `
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
    thumb.onclick = () => { state.current = i; showSlide(i); updateCounter(); syncFilmstrip(); };
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
