/* ═══════════════════════════════════════════════════════════════════════════
   Event handlers — keyboard shortcuts, toolbar buttons, sample deck
═══════════════════════════════════════════════════════════════════════════ */

import { state, THEMES } from './state.js';
import { showSlide, updateCounter, syncFilmstrip, renderFilmstrip, update } from './render.js';
import { openFullscreen, closeFullscreen, fsPrev, fsNext,
         openGrid, closeGrid,
         openPresenter, closePresenter, pressPrev, pressNext } from './preview.js';
import { exportYAML, exportMarp, exportHTML, exportPPTX } from './export.js';
import { exportReveal, exportBundle, openGallery, closeGallery,
         removeGalleryEntry, exportGalleryIndex } from './publish.js';
import { runAudit } from './audit.js';

/* ── Debounce helper ─────────────────────────────────────────────────── */

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

const debouncedUpdate = debounce(update, 180);

/* ── Navigation ───────────────────────────────────────────────────────── */

export function prevSlide() {
  if (state.current > 0) {
    state.current--;
    showSlide(state.current);
    updateCounter();
    syncFilmstrip();
  }
}

export function nextSlide() {
  if (state.current < state.slides.length - 1) {
    state.current++;
    showSlide(state.current);
    updateCounter();
    syncFilmstrip();
  }
}

/* ── Theme switcher ───────────────────────────────────────────────────── */

export function setTheme(name) {
  if (!THEMES[name]) return;
  state.currentTheme = name;
  state.themeOverride = true;
  localStorage.setItem('pres-sage-theme', name);
  const sel = document.getElementById('theme-select');
  if (sel && sel.value !== name) sel.value = name;
  if (state.slides.length) { showSlide(state.current); renderFilmstrip(); }
}

/* ── Insert-slide dropdown ────────────────────────────────────────────── */

const SLIDE_SKELETONS = {
  title:    '\n    - type: title\n      heading: "Slide Title"\n      subtitle: "Subtitle"\n',
  bullets:  '\n    - type: bullets\n      heading: "Heading"\n      bullets:\n        - "Point one"\n        - "Point two"\n        - "Point three"\n',
  split:    '\n    - type: split\n      heading: "Comparison"\n      left:\n        heading: "Option A"\n        bullets:\n          - "Detail"\n      right:\n        heading: "Option B"\n        bullets:\n          - "Detail"\n',
  code:     '\n    - type: code\n      heading: "Code Example"\n      language: python\n      code: |\n        print("hello")\n',
  quote:    '\n    - type: quote\n      text: "Your quote here."\n      source: "Author"\n',
  divider:  '\n    - type: divider\n      heading: "Section Title"\n      subtitle: "Optional subtitle"\n',
  qa:       '\n    - type: qa\n      heading: "Questions?"\n      subtext: "Let\'s discuss"\n',
  cta:      '\n    - type: cta\n      heading: "Next Steps"\n      action: "What to do next"\n      subtext: "Additional context"\n',
  image:    '\n    - type: image\n      heading: "Image Title"\n      src: "./image.png"\n      alt: "Description"\n      caption: "Optional caption"\n',
  stats:    '\n    - type: stats\n      heading: "Key Metrics"\n      stats:\n        - value: "42%"\n          label: "First metric"\n        - value: "3x"\n          label: "Second metric"\n',
  timeline: '\n    - type: timeline\n      heading: "Roadmap"\n      steps:\n        - label: "Phase 1"\n          text: "Description"\n        - label: "Phase 2"\n          text: "Description"\n',
  columns:  '\n    - type: columns\n      heading: "Two Perspectives"\n      left:\n        heading: "Left"\n        text: "Paragraph text..."\n      right:\n        heading: "Right"\n        text: "Paragraph text..."\n',
};

export function toggleInsertMenu() {
  document.getElementById('insert-menu').classList.toggle('open');
}

export function insertSlide(type) {
  const ta = document.getElementById('yaml-input');
  const skeleton = SLIDE_SKELETONS[type] || SLIDE_SKELETONS.bullets;
  const pos = ta.selectionStart;
  const val = ta.value;
  ta.value = val.slice(0, pos) + skeleton + val.slice(pos);
  ta.selectionStart = ta.selectionEnd = pos + skeleton.length;
  ta.focus();
  document.getElementById('insert-menu').classList.remove('open');
  update();
}

/* ── Sample deck ──────────────────────────────────────────────────────── */

export function loadSample() {
  document.getElementById('yaml-input').value = `presentation:
  title: "Why We're Switching to Event-Driven Architecture"
  subtitle: "From polling chaos to reactive clarity"
  author: "Luciano"
  date: "2026-03"
  # theme: royal          # optional deck-wide look — see the Theme dropdown for names

  slides:
    - type: title
      heading: "Why We're Switching to Event-Driven Architecture"
      subtitle: "From polling chaos to reactive clarity"

    - type: bullets
      heading: "The Problem"
      bullets:
        - "API polling every 5s \u2014 **200k unnecessary requests/day**"
        - "Race conditions causing \`data inconsistencies\`"
        - "3 services sharing a DB table they shouldn't touch"
      note: "Emphasize the cost: each unnecessary request costs compute and adds latency"

    - type: split
      heading: "Before vs After"
      left:
        heading: "Now (REST polling)"
        bullets:
          - "Tight coupling between services"
          - "Hard to add new consumers"
          - "High DB load at peak"
      right:
        heading: "Target (Event-driven)"
        bullets:
          - "Services only know their own queue"
          - "New consumer = subscribe, done"
          - "Load distributed naturally"
      note: "Pause here \u2014 ask if anyone has questions about the current architecture"

    - type: code
      heading: "Producing an event (Kafka)"
      language: python
      code: |
        producer.send(
          topic="order.created",
          value={"order_id": 123, "user_id": 456}
        )

    - type: quote
      text: "Make each service responsible for one thing and let events connect them."
      source: "Team architecture principle"

    - type: qa
      heading: "Does this change affect you?"
      subtext: "Let's make sure every team's use case is covered"

    - type: divider
      heading: "Migration Plan"
      subtitle: "How we get from here to there"

    - type: bullets
      heading: "Phase 1 \u2014 Strangler fig (Week 1\u20132)"
      bullets:
        - "Identify the 3 highest-volume polling endpoints"
        - "Add Kafka producer alongside existing REST call"
        - "No consumer changes yet \u2014 just emit"
      note: "The strangler fig pattern lets us migrate incrementally without a big bang cutover"

    - type: stats
      heading: "Expected Impact"
      background: ocean
      stats:
        - value: "-80%"
          label: "API requests"
        - value: "$12k"
          label: "Monthly savings"
        - value: "3x"
          label: "Faster scaling"

    - type: timeline
      heading: "Rollout Plan"
      steps:
        - label: "Week 1-2"
          text: "Add Kafka producers"
        - label: "Week 3-4"
          text: "Migrate consumers"
        - label: "Week 5"
          text: "Remove polling"
        - label: "Week 6"
          text: "Monitor & tune"

    - type: cta
      heading: "Next Step"
      action: "Review the RFC in Confluence by Friday"
      subtext: "Link in Slack #architecture \u2014 comments welcome"
`;
  state.current = 0;
  update();
}

/* ── Keyboard shortcuts ───────────────────────────────────────────────── */

export function initEvents() {
  const yamlInput = document.getElementById('yaml-input');

  // Tab / Shift+Tab → indent / dedent for YAML
  yamlInput.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    const start = yamlInput.selectionStart;
    const end = yamlInput.selectionEnd;
    const val = yamlInput.value;

    if (e.shiftKey) {
      const lineStart = val.lastIndexOf('\n', start - 1) + 1;
      const line = val.slice(lineStart, end);
      if (line.startsWith('  ')) {
        yamlInput.value = val.slice(0, lineStart) + line.slice(2) + val.slice(end);
        yamlInput.selectionStart = Math.max(lineStart, start - 2);
        yamlInput.selectionEnd = Math.max(lineStart, end - 2);
      }
    } else {
      yamlInput.value = val.slice(0, start) + '  ' + val.slice(end);
      yamlInput.selectionStart = yamlInput.selectionEnd = start + 2;
    }
    debouncedUpdate();
  });

  // Close insert menu on outside click
  document.addEventListener('click', (e) => {
    const menu = document.getElementById('insert-menu');
    const btn = document.getElementById('insert-slide-btn');
    if (!menu.contains(e.target) && e.target !== btn) {
      menu.classList.remove('open');
    }
  });

  // Editor arrow keys
  document.addEventListener('keydown', (e) => {
    const inEditor = document.activeElement === yamlInput;
    if (inEditor) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nextSlide();
    if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   prevSlide();
  });

  // Fullscreen keys
  document.addEventListener('keydown', (e) => {
    const fs = document.getElementById('fs-stage');
    if (!fs.classList.contains('active')) return;
    if (e.key === 'Escape') closeFullscreen();
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') fsNext();
    if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   fsPrev();
  });

  // Grid keys
  document.addEventListener('keydown', (e) => {
    if (!document.getElementById('grid-overlay').classList.contains('active')) return;
    if (e.key === 'Escape') closeGrid();
  });

  // Gallery keys
  document.addEventListener('keydown', (e) => {
    if (!document.getElementById('gallery-overlay').classList.contains('active')) return;
    if (e.key === 'Escape') closeGallery();
  });

  // Global shortcuts: G = grid, F = fullscreen present
  document.addEventListener('keydown', (e) => {
    const inEditor = document.activeElement === yamlInput;
    const inPres   = document.getElementById('pres-overlay').classList.contains('active');
    const inGrid   = document.getElementById('grid-overlay').classList.contains('active');
    if (inEditor || inPres || inGrid) return;
    if (e.key === 'g' || e.key === 'G') openGrid();
    if (e.key === 'f' || e.key === 'F') openPresenter();
  });

  // Presenter keys
  document.addEventListener('keydown', (e) => {
    if (!document.getElementById('pres-overlay').classList.contains('active')) return;
    if (e.key === 'Escape') closePresenter();
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') pressNext();
    if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   pressPrev();
  });

  // YAML input listener (debounced)
  yamlInput.addEventListener('input', debouncedUpdate);
}

/* ── Expose all handlers to window for inline onclick attributes ───── */

export function exposeGlobals() {
  window.setTheme        = setTheme;
  window.exportYAML      = exportYAML;
  window.exportMarp      = exportMarp;
  window.exportHTML       = exportHTML;
  window.exportPPTX      = exportPPTX;
  window.exportReveal    = exportReveal;
  window.exportBundle    = exportBundle;
  window.openGallery     = openGallery;
  window.closeGallery    = closeGallery;
  window.removeGalleryEntry = removeGalleryEntry;
  window.exportGalleryIndex = exportGalleryIndex;
  window.loadSample      = loadSample;
  window.runAudit        = runAudit;
  window.openGrid        = openGrid;
  window.openPresenter   = openPresenter;
  window.prevSlide       = prevSlide;
  window.nextSlide       = nextSlide;
  window.closeFullscreen = closeFullscreen;
  window.fsPrev          = fsPrev;
  window.fsNext          = fsNext;
  window.closeGrid       = closeGrid;
  window.closePresenter  = closePresenter;
  window.pressPrev       = pressPrev;
  window.pressNext       = pressNext;
  window.toggleInsertMenu = toggleInsertMenu;
  window.insertSlide     = insertSlide;
}
