/* ═══════════════════════════════════════════════════════════════════════════
   Catalog — browse slide types, gradients and patterns, and apply them
   by clicking rather than by remembering the YAML key.

   Every preview here is drawn by the player's own renderSlide(), so a type
   whose rendering changes cannot show a stale picture in the catalog.
═══════════════════════════════════════════════════════════════════════════ */

import { state, THEMES, BG_PRESETS, PATTERNS, applyTheme, applyPattern, resolveBg } from './state.js';
import { renderSlide, update } from './render.js';
import { SLIDE_SKELETONS, setTheme, typingOrOverlaid } from './events.js';
import { showToast } from './utils.js';
import { SAMPLES, WHEN, STRUCTURES, structureYAML, GLYPHS } from './catalog-data.js';
import { applyProp, insertSkeleton, insertAtCursor,
         setDeckProp, removeDeckProp, setBrandProp } from './yaml-edit.js';

async function copyText(text, btn) {
  const was = btn.dataset.label || btn.textContent;
  btn.dataset.label = was;
  let ok = true;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    ok = document.execCommand('copy');
    ta.remove();
  }
  btn.textContent = ok ? 'Copied' : 'Ctrl+C';
  setTimeout(() => { btn.textContent = was; }, 1300);
}


/* ── Loading whole decks ───────────────────────────────────────────────── */

/* A styled confirm rather than window.confirm: the native one is suppressed in
   some embedded contexts, and losing an hour of writing to a dialog that never
   appeared is the worst possible failure here. */
export function askConfirm(title, body, okLabel = 'Replace') {
  const dlg = document.getElementById('confirm-dialog');
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-body').textContent = body;
  document.getElementById('confirm-ok').textContent = okLabel;
  return new Promise(resolve => {
    const done = (ok) => {
      dlg.close();
      dlg.removeEventListener('close', onClose);
      resolve(ok);
    };
    const onClose = () => resolve(false);
    dlg.addEventListener('close', onClose, { once: true });
    document.getElementById('confirm-ok').onclick = () => done(true);
    document.getElementById('confirm-cancel').onclick = () => done(false);
    dlg.showModal();
  });
}

async function loadDeck(text, name = 'this deck') {
  const ta = document.getElementById('yaml-input');
  if (ta.value.trim()) {
    const ok = await askConfirm(
      'Replace the current deck?',
      `Loading ${name} overwrites what is in the editor. Your current deck is not saved anywhere else.`,
    );
    if (!ok) return;
  }
  ta.value = text;
  update();
  closeCatalog();
}

/* ── Rendering the catalog ─────────────────────────────────────────────── */

function typeCard(type) {
  const card = document.createElement('article');
  card.className = 'cat-card';

  const frame = document.createElement('div');
  frame.className = 'cat-preview';
  const slideEl = renderSlide(SAMPLES[type], 0, 1);
  frame.appendChild(slideEl);

  card.innerHTML = `
    <div class="cat-card-head">
      <span class="cat-name">${type}</span>
      <span class="cat-when">${WHEN[type] || ''}</span>
    </div>`;
  card.prepend(frame);

  const actions = document.createElement('div');
  actions.className = 'cat-actions';
  const ins = document.createElement('button');
  ins.className = 'btn btn-sm btn-primary';
  ins.textContent = 'Insert';
  ins.onclick = () => insertSkeleton(type);
  const cp = document.createElement('button');
  cp.className = 'btn btn-sm';
  cp.textContent = 'Copy YAML';
  cp.onclick = () => copyText((SLIDE_SKELETONS[type] || '').replace(/^\n/, ''), cp);
  actions.append(ins, cp);
  card.appendChild(actions);
  return card;
}

function swatch(kind, name) {
  const el = document.createElement('button');
  el.className = `cat-swatch cat-swatch-${kind}`;
  el.type = 'button';
  el.title = name === 'none'
    ? `Clear the ${kind}`
    : `${kind}: ${name}`;

  const chip = document.createElement('span');
  chip.className = 'cat-chip';
  if (name === 'none') {
    chip.classList.add('cat-chip-none');
  } else if (kind === 'background') {
    chip.style.background = resolveBg(name);
  } else {
    // Draw the real pattern over the current theme, so the swatch is the
    // texture the slide will get rather than an illustration of it.
    applyTheme(chip, state.currentTheme, state.meta.brand);
    applyPattern(chip, name);
  }
  const label = document.createElement('span');
  label.className = 'cat-swatch-label';
  label.textContent = name === 'none' ? 'clear' : name;
  el.append(chip, label);
  el.onclick = () => applyProp(kind === 'background' ? 'background' : 'pattern', name);
  return el;
}


function deckCard(meta) {
  const card = document.createElement('article');
  card.className = 'cat-deck is-clickable';
  card.tabIndex = 0;
  card.setAttribute('role', 'button');
  card.innerHTML = `
    <span class="cat-deck-cat">${meta.category}</span>
    <h4>${meta.name}</h4>
    <p>${meta.desc}</p>
    <p class="cat-deck-uses">${meta.uses}</p>`;

  const yamlFor = () => fetch(`deck-library/decks/${meta.id}.yaml`).then(r => r.text());

  // The card itself is the primary action: load it here, after confirming
  const take = async () => loadDeck(await yamlFor(), meta.name);
  card.onclick = (e) => { if (!e.target.closest('.cat-deck-actions')) take(); };
  card.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); take(); } };

  const actions = document.createElement('div');
  actions.className = 'cat-deck-actions';

  const tab = document.createElement('button');
  tab.className = 'btn btn-sm';
  tab.textContent = 'New tab';
  tab.title = 'Open this deck in a second tab, leaving yours alone';
  tab.onclick = async () => {
    window.open(`?yaml=${encodeURIComponent(await yamlFor())}`, '_blank', 'noopener');
  };

  const cp = document.createElement('button');
  cp.className = 'btn btn-sm';
  cp.textContent = 'Copy';
  cp.onclick = async () => copyText(await yamlFor(), cp);

  actions.append(tab, cp);
  card.appendChild(actions);
  return card;
}

function structureCard(name) {
  const def = STRUCTURES[name];
  const card = document.createElement('article');
  card.className = 'cat-deck';
  card.innerHTML = `
    <span class="cat-deck-cat">Structure</span>
    <h4>${name}</h4>
    <p>${def.when}</p>
    <p class="cat-deck-uses">${def.types.join(' · ')}</p>`;
  card.classList.add('is-clickable');
  card.tabIndex = 0;
  card.setAttribute('role', 'button');
  const take = () => loadDeck(structureYAML(name), `the ${name} structure`);
  card.onclick = (e) => { if (!e.target.closest('.cat-deck-actions')) take(); };
  card.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); take(); } };

  const actions = document.createElement('div');
  actions.className = 'cat-deck-actions';
  const cp = document.createElement('button');
  cp.className = 'btn btn-sm';
  cp.textContent = 'Copy';
  cp.onclick = () => copyText(structureYAML(name), cp);
  actions.appendChild(cp);
  card.appendChild(actions);
  return card;
}

function themeSwatch(name) {
  const t = THEMES[name];
  const el = document.createElement('button');
  el.className = 'cat-swatch';
  el.type = 'button';
  el.title = `theme: ${name}`;
  const chip = document.createElement('span');
  chip.className = 'cat-chip';
  chip.style.background = t.bg;
  chip.style.borderColor = t.border;
  chip.innerHTML = `<span class="cat-theme-ink" style="color:${t.text}">Aa</span>` +
                   `<span class="cat-theme-dot" style="background:${t.accent}"></span>`;
  const label = document.createElement('span');
  label.className = 'cat-swatch-label';
  label.textContent = name;
  el.append(chip, label);
  el.onclick = () => {
    setTheme(name);            // the live preview follows immediately
    setDeckProp('theme', name); // and the deck carries it when exported
    update();
    showToast(`Theme: ${name}`);
  };
  return el;
}


/* An enum field is a select, not a text box: the audit rejects an unknown value
   and a dropdown cannot produce one. */
function choiceRow(key, label, options) {
  const wrap = document.createElement('label');
  wrap.className = 'cat-field';
  wrap.innerHTML = `<span>${label}</span>`;
  const sel = document.createElement('select');
  sel.innerHTML = ['', ...options]
    .map(o => `<option value="${o}"${(state.meta?.[key] || '') === o ? ' selected' : ''}>${o || '(not set)'}</option>`)
    .join('');
  sel.addEventListener('change', () => {
    if (sel.value) setDeckProp(key, sel.value); else removeDeckProp(key);
    update();
  });
  wrap.appendChild(sel);
  return wrap;
}

function fieldRow(key, label, placeholder) {
  const wrap = document.createElement('label');
  wrap.className = 'cat-field';
  wrap.innerHTML = `<span>${label}</span>`;
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = placeholder;
  input.value = state.meta?.[key] || '';
  const commit = () => {
    const v = input.value.trim();
    /* A numeric key must be written unquoted, or the audit rejects its own
       UI's output: duration: "20" is a string and the rule wants minutes. */
    const numeric = key === 'duration' && /^\d+$/.test(v);
    if (v) setDeckProp(key, numeric ? v : `"${v.replace(/"/g, '\\"')}"`);
    else removeDeckProp(key);
    update();
  };
  input.addEventListener('change', commit);
  input.addEventListener('blur', commit);
  wrap.appendChild(input);
  return wrap;
}

/* WCAG contrast of two hex colours, so the brand pickers can say what they did
   rather than leaving it to the audit after the fact. */
function contrast(a, b) {
  const lum = (hex) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
    if (!m) return null;
    const ch = (i) => {
      const v = parseInt(m[1].slice(i, i + 2), 16) / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * ch(0) + 0.7152 * ch(2) + 0.0722 * ch(4);
  };
  const la = lum(a), lb = lum(b);
  if (la === null || lb === null) return null;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function brandRow(key, label, against, min) {
  const t = THEMES[state.currentTheme] || THEMES.neorgon;
  const wrap = document.createElement('label');
  wrap.className = 'cat-field cat-brand-field';
  wrap.innerHTML = `<span>${label}</span>`;
  const input = document.createElement('input');
  input.type = 'color';
  input.value = state.meta?.brand?.[key] || t[key === 'on_accent' ? 'text' : key] || '#0063e5';
  const read = document.createElement('em');
  read.className = 'cat-ratio';

  const show = () => {
    const brand = { ...(state.meta?.brand || {}), [key]: input.value };
    const other = brand[against] || t[against] || (against === 'on_accent' ? '#ffffff' : '#000000');
    const r = contrast(input.value, other);
    read.textContent = r ? `${r.toFixed(1)}:1 vs ${against}` : '';
    read.classList.toggle('is-bad', !!r && r < min);
  };
  input.addEventListener('input', show);
  input.addEventListener('change', () => { setBrandProp(key, input.value); update(); show(); });
  show();
  wrap.append(input, read);
  return wrap;
}


/* One panel, four tabs. Each toolbar entry point lands on its own tab, so the
   button that says "Examples" does not also show slide components. */
export function showTab(tab) {
  document.querySelectorAll('#cat-tabs button').forEach(b =>
    b.classList.toggle('is-on', b.dataset.tab === tab));
  document.querySelectorAll('.cat-section').forEach(sec =>
    sec.hidden = sec.dataset.tab !== tab);
  const body = document.getElementById('cat-body');
  if (body) body.scrollTop = 0;
  // Previews only get a measurable width once their tab is visible
  scalePreviews();
}

export function openCatalog(tab = 'decks') {
  const body = document.getElementById('cat-body');
  body.innerHTML = '';

  const mkSection = (tab, title, hint) => {
    const s = document.createElement('section');
    s.className = 'cat-section';
    s.dataset.tab = tab;
    s.innerHTML = `<h3>${title}</h3><p class="cat-hint">${hint}</p>`;
    body.appendChild(s);
    return s;
  };

  const decks = mkSection('decks', 'Start from a deck',
    'Twelve complete decks, each validating clean. Opening one replaces the editor.');
  const deckRow = document.createElement('div');
  deckRow.className = 'cat-decks';
  decks.appendChild(deckRow);
  fetch('deck-library/decks/index.json')
    .then(r => r.json())
    .then(list => list.forEach(m => deckRow.appendChild(deckCard(m))))
    .catch(() => { deckRow.innerHTML = '<p class="cat-hint">Deck list unavailable offline.</p>'; });

  const structures = mkSection('decks', 'Deck structures',
    'A whole talk shape rather than one slide. Built from the same skeletons the type cards insert.');
  const structRow = document.createElement('div');
  structRow.className = 'cat-decks';
  Object.keys(STRUCTURES).forEach(n => structRow.appendChild(structureCard(n)));
  structures.appendChild(structRow);

  const types = mkSection('slides', 'Slide types',
    'Every preview is rendered by the player itself. Insert drops the YAML at the cursor.');
  const grid = document.createElement('div');
  grid.className = 'cat-grid';
  Object.keys(SAMPLES).forEach(t => grid.appendChild(typeCard(t)));
  types.appendChild(grid);

  const bg = mkSection('style', 'Gradient backgrounds',
    'All seven presets are dark, so pair them with a dark theme. Any CSS gradient works too.');
  const bgRow = document.createElement('div');
  bgRow.className = 'cat-swatches';
  Object.keys(BG_PRESETS).forEach(n => bgRow.appendChild(swatch('background', n)));
  bgRow.appendChild(swatch('background', 'none'));
  bg.appendChild(bgRow);

  const pat = mkSection('style', 'Patterns',
    'A texture over the background. The ink follows the background luminance, so each one works on light and dark.');
  const patRow = document.createElement('div');
  patRow.className = 'cat-swatches';
  Object.keys(PATTERNS).forEach(n => patRow.appendChild(swatch('pattern', n)));
  patRow.appendChild(swatch('pattern', 'none'));
  pat.appendChild(patRow);

  const themes = mkSection('style', 'Deck theme',
    'Sets background, text, accent and code colours together. Picking one switches the preview and writes it into the deck.');
  const themeRow = document.createElement('div');
  themeRow.className = 'cat-swatches';
  Object.keys(THEMES).forEach(n => themeRow.appendChild(themeSwatch(n)));
  themes.appendChild(themeRow);

  const setup = mkSection('setup', 'Deck setup',
    'The deck-level lines everyone forgets to write. Blank clears the key. Audience, outcome and minutes change which rules the audit applies: a standup and a board pitch are not judged the same way.');
  const fields = document.createElement('div');
  fields.className = 'cat-fields';
  fields.append(
    fieldRow('author', 'Author', 'Your Name'),
    fieldRow('date', 'Date', '2026-08'),
    fieldRow('footer', 'Footer note', 'Platform review · Q3'),
    fieldRow('classification', 'Handling label', 'Internal'),
    choiceRow('audience', 'Audience', ['exec', 'engineering', 'customer', 'mixed', 'learner']),
    choiceRow('outcome', 'Outcome', ['inform', 'convince', 'approve', 'teach']),
    fieldRow('duration', 'Minutes for the talk', '20'),
    fieldRow('big_idea', 'The one sentence', 'What the room repeats afterwards'),
  );
  setup.appendChild(fields);

  /* The documented "embed a local image as the deck logo" action. It was
     implemented in events.js and had no caller at all after the toolbar was
     regrouped, so CLAUDE.md described a button that did not exist. */
  const logoRow = document.createElement('div');
  logoRow.className = 'cat-logo-row';
  const pick = document.createElement('button');
  pick.className = 'btn btn-sm';
  pick.textContent = '◉ Embed a logo file';
  pick.title = 'Embeds the image in the YAML as a data URI, so the deck travels as one file';
  pick.onclick = () => window.pickLogo?.();
  const hint = document.createElement('span');
  hint.textContent = 'Stored as a data URI, so the deck stays self-contained.';
  logoRow.append(pick, hint);
  setup.appendChild(logoRow);

  const brand = mkSection('setup', 'Brand colours',
    'Overrides the theme and travels with the deck. The ratio updates as you pick, so a failing pair is visible before the audit says so.');
  const brandFields = document.createElement('div');
  brandFields.className = 'cat-fields';
  brandFields.append(
    brandRow('accent', 'Accent', 'bg', 3),
    brandRow('bg', 'Background', 'text', 4.5),
    brandRow('text', 'Text', 'bg', 4.5),
    brandRow('on_accent', 'Text on accent', 'accent', 3),
  );
  brand.appendChild(brandFields);

  const glyphs = mkSection('setup', 'Glyphs',
    'For a grid item\'s `icon:`. Clicking one drops it at the cursor.');
  const glyphRow = document.createElement('div');
  glyphRow.className = 'cat-glyphs';
  GLYPHS.forEach(g => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cat-glyph';
    b.textContent = g;
    b.onclick = () => { insertAtCursor(g); showToast(`Inserted ${g}`); };
    glyphRow.appendChild(b);
  });
  glyphs.appendChild(glyphRow);

  document.getElementById('cat-overlay').classList.add('active');
  showTab(tab);
  scalePreviews();
}

/* A one-shot measurement after paint is wrong whenever the panel is opened
   before its box has a width (a hidden tab, a pane still animating): every
   preview then sits unscaled or at scale 0 until it is reopened. Observing the
   frames instead means the scale lands whenever a real width shows up, and
   again on every resize. */
let previewObserver = null;

function scalePreviews() {
  previewObserver?.disconnect();
  previewObserver = new ResizeObserver(entries => {
    entries.forEach(({ target }) => {
      const slideEl = target.querySelector('.slide');
      if (!slideEl || !target.clientWidth) return;
      slideEl.style.transform = `scale(${target.clientWidth / 960})`;
      slideEl.style.transformOrigin = 'top left';
      slideEl.style.position = 'absolute';
      slideEl.style.left = '0';
      slideEl.style.top = '0';
    });
  });
  document.querySelectorAll('.cat-preview').forEach(f => previewObserver.observe(f));
}

export function closeCatalog() {
  document.getElementById('cat-overlay').classList.remove('active');
  previewObserver?.disconnect();
  previewObserver = null;
}

export function initCatalog() {
  window.openCatalog = openCatalog;
  window.closeCatalog = closeCatalog;
  document.getElementById('cat-tabs')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (b) showTab(b.dataset.tab);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeCatalog();
    if (e.key.toLowerCase() === 'c' && !e.metaKey && !e.ctrlKey) {
      const overlay = document.getElementById('cat-overlay');
      if (overlay.classList.contains('active')) { closeCatalog(); return; }
      // Not while typing, and not on top of another overlay
      if (!typingOrOverlaid(document.getElementById('yaml-input'))) openCatalog();
    }
  });
}
