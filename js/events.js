/* ═══════════════════════════════════════════════════════════════════════════
   Event handlers — keyboard shortcuts, toolbar buttons, sample deck
═══════════════════════════════════════════════════════════════════════════ */

import { state, THEMES } from './state.js';
import { showToast } from './utils.js';
import { copyShareLink } from './share.js';
import { markdownToDeck } from './markdown-import.js';
/* Late-bound to avoid an import cycle: catalog.js imports from this module. */
const openCatalogFromEvents = (tab) => window.openCatalog?.(tab);
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

export const SLIDE_SKELETONS = {
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
  timeline: '\n    - type: timeline\n      heading: "Roadmap"\n      steps:\n        - label: "Phase 1"\n          text: "Description"\n          date: "2026-09"\n        - label: "Phase 2"\n          text: "Description"\n          date: "2026-10"\n          mark: true\n',
  process:  '\n    - type: process\n      heading: "Rollout"\n      steps:\n        - label: "Shadow"\n          text: "Mirror traffic to the new path"\n          date: "2026-09"\n          owner: "Core"\n        - label: "Cut over"\n          text: "Switch reads to the subscription"\n          date: "2026-10"\n          owner: "Core"\n          current: true\n        - label: "Remove"\n          text: "Delete the polling loop"\n          date: "2026-11"\n          owner: "Infra"\n',
  chart:    '\n    - type: chart\n      heading: "Requests per day"\n      chart: bar\n      unit: "req/day"\n      labels: ["Q1", "Q2", "Q3"]\n      series:\n        - name: "API"\n          values: [120, 180, 240]\n        - name: "Web"\n          values: [80, 90, 140]\n',
  columns:  '\n    - type: columns\n      heading: "Two Perspectives"\n      left:\n        heading: "Left"\n        text: "Paragraph text..."\n      right:\n        heading: "Right"\n        text: "Paragraph text..."\n',
  agenda:   '\n    - type: agenda\n      heading: "Agenda"\n      auto: true\n',
  table:    '\n    - type: table\n      heading: "Comparison"\n      columns: ["Option", "Cost", "Risk"]\n      rows:\n        - ["Keep as is", "$0", "High"]\n        - ["Rebuild", "$40k", "Low"]\n      caption: "Optional caption"\n',
  grid:     '\n    - type: grid\n      heading: "Three Points"\n      columns: 3\n      items:\n        - heading: "First"\n          text: "What it means"\n        - heading: "Second"\n          text: "What it means"\n        - heading: "Third"\n          text: "What it means"\n',
  media:    '\n    - type: media\n      heading: "What you are looking at"\n      src: "./screenshot.png"\n      alt: "Description"\n      side: right\n      bullets:\n        - "Point one"\n        - "Point two"\n',
  matrix:    '\n    - type: matrix\n      heading: "Which option"\n      columns: ["Keep", "Rebuild", "Patch"]\n      highlight: 2\n      rows:\n        - label: "Runs offline"\n          cells: [no, yes, partial]\n        - label: "Cost"\n          cells: ["$0", "$40k", "$8k"]\n',
  people:    '\n    - type: people\n      heading: "The team"\n      columns: 3\n      people:\n        - name: "Jane Smith"\n          role: "Platform lead"\n        - name: "Alex Kim"\n          role: "Data"\n        - name: "Sam Ortiz"\n          role: "Design"\n',
  orgchart:  '\n    - type: orgchart\n      heading: "Who owns what"\n      root:\n        name: "Dana Reyes"\n        role: "Director"\n        reports:\n          - name: "Jane Smith"\n            role: "Platform lead"\n            reports:\n              - name: "Alex Kim"\n                role: "Data"\n          - name: "Sam Ortiz"\n            role: "Design"\n',
  checklist: '\n    - type: checklist\n      heading: "Launch readiness"\n      items:\n        - label: "Runbook written"\n          state: done\n        - label: "Load test"\n          state: doing\n        - label: "Vendor sign-off"\n          state: blocked\n          note: "waiting on legal"\n',
  compare:   '\n    - type: compare\n      heading: "Before and after"\n      before:\n        src: "./before.png"\n        alt: "The old screen"\n      after:\n        src: "./after.png"\n        alt: "The new screen"\n      caption: "Optional caption"\n',
  appendix:  '\n    - type: appendix\n      heading: "Backup Slides"\n      subtitle: "Answers held in reserve"\n',
};

/* The `+ Slide` dropdown was replaced by the Catalog's Slides tab. These two
   remain only because `exposeGlobals()` still publishes them; both referenced
   #insert-menu, which no longer exists, so calling either threw. */
export function insertSlide(type) {
  openCatalogFromEvents('slides');
  console.info(`insertSlide(${type}) is superseded by the Catalog's Slides tab.`);
}

/* ── Logo from a local file ───────────────────────────────────────────── */
/* The hosted player cannot read the visitor's disk through a YAML path, so a
   local logo is embedded as a data: URI written into the YAML itself — the
   deck stays a single self-contained file that renders anywhere. URLs still
   work by typing `logo:` directly. */

export function pickLogo() {
  document.getElementById('logo-file-input').click();
}

export function onLogoFile(e) {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  if (file.size > 500 * 1024) {
    showToast('Logo is over 500 KB: resize it first; it gets embedded into the YAML');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const ta = document.getElementById('yaml-input');
    let v = ta.value;
    if (!/^\s*presentation:/m.test(v)) {
      showToast('Load or start a deck first');
      return;
    }
    const line = `  logo: "${reader.result}"`;
    const existing = /^ {2}logo:[^\n]*$/m;
    v = existing.test(v)
      ? v.replace(existing, line)
      : v.replace(/^( {2}title:[^\n]*)$/m, `$1\n${line}`);
    ta.value = v;
    update();
    showToast(`Logo embedded (${Math.round(file.size / 1024)} KB), add logo_all: true for a watermark on every slide`);
  };
  reader.readAsDataURL(file);
}

/* ── Sample deck ──────────────────────────────────────────────────────── */

/* The starter deck is a library file, not a string kept here. Two copies of
   "the example" drift, and the one in the source always loses. */
export const STARTER_DECK = 'deck-library/decks/design-review.yaml';

export async function loadSample(path = STARTER_DECK) {
  const ta = document.getElementById('yaml-input');
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`${res.status}`);
    ta.value = await res.text();
    update();
    showToast('Sample deck loaded');
  } catch (e) {
    showToast('Could not load the sample deck');
    console.error('loadSample', e);
  }
}

/* ── Keyboard shortcuts ───────────────────────────────────────────────── */

/* A global single-key shortcut must not fire while the user is typing, and must
   not fire while an overlay owns the screen. Checking the one textarea by
   identity missed every <input>, which is why typing a URL with a 'g' in it
   into the Gallery opened the Overview, and arrowing the theme <select> also
   advanced the slide. */
export function typingOrOverlaid(yamlInput) {
  const el = document.activeElement;
  const tag = (el?.tagName || '').toLowerCase();
  if (el === yamlInput) return true;
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if (el?.isContentEditable) return true;
  return ['pres-overlay', 'grid-overlay', 'gallery-overlay', 'cat-overlay']
    .some(id => document.getElementById(id)?.classList.contains('active'));
}

export function initEvents() {
  const yamlInput = document.getElementById('yaml-input');

  document.getElementById('logo-file-input').addEventListener('change', onLogoFile);
  document.getElementById('share-link-btn').addEventListener('click', copyShareLink);
  document.getElementById('md-import-btn').addEventListener('click', () => document.getElementById('md-dialog').showModal());
  document.getElementById('md-cancel').addEventListener('click', () => document.getElementById('md-dialog').close());
  document.getElementById('md-convert').addEventListener('click', convertMarkdown);

  // Tab / Shift+Tab → indent / dedent for YAML
  yamlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      // Arms one Tab press to leave the editor instead of indenting.
      yamlInput.dataset.tabOut = '1';
      showToast('Tab now moves focus out of the editor');
      return;
    }

    if (e.key !== 'Tab') return;
    /* Escape then Tab is the standard way out of a textarea that owns Tab, and
       without it this was a WCAG 2.1.2 keyboard trap: every control after the
       editor in DOM order, which is the whole preview side, was unreachable.
       `tabOut` is armed by the Escape handler below. */
    if (yamlInput.dataset.tabOut === '1') {
      delete yamlInput.dataset.tabOut;
      return;                       // let the browser move focus normally
    }
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

  /* Toolbar dropdowns. One delegated handler covers every menu, so adding a
     group to the toolbar needs no JS at all. */
  document.addEventListener('click', (e) => {
    const toggle = e.target.closest('[data-menu-toggle]');
    const wrap = toggle?.closest('.tb-menu');
    document.querySelectorAll('.tb-menu.open').forEach(m => {
      if (m !== wrap) {
        m.classList.remove('open');
        m.querySelector('[data-menu-toggle]')?.setAttribute('aria-expanded', 'false');
      }
    });
    if (wrap) {
      const open = wrap.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
      return;
    }
    // A click inside a menu list runs the action, then closes the menu
    e.target.closest('.tb-menu-list') && wrapClose();
  });

  function wrapClose() {
    document.querySelectorAll('.tb-menu.open').forEach(m => {
      m.classList.remove('open');
      m.querySelector('[data-menu-toggle]')?.setAttribute('aria-expanded', 'false');
    });
  }

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') wrapClose(); });

  // Editor arrow keys
  document.addEventListener('keydown', (e) => {
    if (typingOrOverlaid(yamlInput)) return;
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
    if (typingOrOverlaid(yamlInput)) return;
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

/* Paste Markdown (Marp or CommonMark) and convert it to the deck YAML the
   player renders. The audit still runs after, so weak headings are caught the
   same way they are for a hand-written deck. */
function convertMarkdown() {
  const md = document.getElementById('md-input').value;
  if (!md.trim()) { showToast('Paste some Markdown first'); return; }
  const { deck, warnings } = markdownToDeck(md);
  if (!deck.presentation.slides.length) { showToast(warnings[0] || 'No slides found'); return; }
  document.getElementById('yaml-input').value = jsyaml.dump(deck, { lineWidth: 100 });
  update();
  document.getElementById('md-dialog').close();
  document.getElementById('md-input').value = '';
  const n = deck.presentation.slides.length;
  showToast(warnings.length
    ? `Converted ${n} slide${n === 1 ? '' : 's'}, ${warnings.length} note${warnings.length === 1 ? '' : 's'}. Run Audit`
    : `Converted ${n} slide${n === 1 ? '' : 's'}. Now edit or export`);
}

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
  window.pickLogo        = pickLogo;
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
  window.insertSlide     = insertSlide;
}
