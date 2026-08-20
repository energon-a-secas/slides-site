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

/* One sample slide per type. Short on purpose: a preview is 200px wide, and a
   realistic amount of copy at that size is an unreadable grey block. */
const SAMPLES = {
  title:    { type: 'title', heading: 'Deck Title', subtitle: 'One line that frames the talk' },
  bullets:  { type: 'bullets', heading: 'Heading', bullets: ['First point', 'Second point', 'Third point'] },
  split:    { type: 'split', heading: 'Comparison', left: { heading: 'Now', bullets: ['Item', 'Item'] }, right: { heading: 'Target', bullets: ['Item', 'Item'] } },
  code:     { type: 'code', heading: 'Example', language: 'python', code: 'producer.send(\n    topic="orders",\n    value=payload,\n)' },
  quote:    { type: 'quote', text: 'A short, memorable principle.', source: 'Attribution' },
  divider:  { type: 'divider', heading: 'Section Title', subtitle: 'What comes next' },
  qa:       { type: 'qa', heading: 'Questions?', subtext: 'A planned pause' },
  cta:      { type: 'cta', heading: 'Next Steps', action: 'The one thing to do', subtext: 'Where to find it' },
  image:    { type: 'image', heading: 'A screenshot', alt: 'Image placeholder', caption: 'Optional caption' },
  stats:    { type: 'stats', heading: 'Key Metrics', stats: [{ value: '42%', label: 'Lower cost' }, { value: '3x', label: 'Faster' }] },
  timeline: { type: 'timeline', heading: 'Roadmap', steps: [{ label: 'Phase 1', text: 'Shadow' }, { label: 'Phase 2', text: 'Cut over' }, { label: 'Phase 3', text: 'Remove' }] },
  columns:  { type: 'columns', heading: 'Two Perspectives', left: { heading: 'Left', text: 'A paragraph of free text.' }, right: { heading: 'Right', text: 'A paragraph of free text.' } },
  agenda:   { type: 'agenda', heading: 'Agenda', items: ['Where the time goes', 'What it costs', 'What we recommend'], current: 1 },
  table:    { type: 'table', heading: 'Options', columns: ['Option', 'Cost', 'Risk'], align: ['left', 'right', 'center'], highlight: 2, rows: [['Keep as is', '$0', 'High'], ['Rebuild', '$40k', 'Low']] },
  grid:     { type: 'grid', heading: 'Three Points', columns: 3, items: [{ icon: '◆', heading: 'First', text: 'What it means' }, { icon: '▲', heading: 'Second', text: 'What it means' }, { icon: '●', heading: 'Third', text: 'What it means' }] },
  media:    { type: 'media', heading: 'What you see', alt: 'Screenshot', side: 'right', bullets: ['Point at the change', 'Say why it matters'] },
  matrix:   { type: 'matrix', heading: 'Which option', columns: ['Keep', 'Rebuild', 'Patch'], highlight: 2, rows: [{ label: 'Runs offline', cells: ['no', 'yes', 'partial'] }, { label: 'Cost', cells: ['$0', '$40k', '$8k'] }] },
  people:   { type: 'people', heading: 'The team', columns: 3, people: [{ name: 'Jane Smith', role: 'Platform lead' }, { name: 'Alex Kim', role: 'Data' }, { name: 'Sam Ortiz', role: 'Design' }] },
  checklist:{ type: 'checklist', heading: 'Launch readiness', items: [{ label: 'Runbook written', state: 'done' }, { label: 'Load test', state: 'doing' }, { label: 'Vendor sign-off', state: 'blocked' }] },
  compare:  { type: 'compare', heading: 'Before and after', before: { alt: 'Old screen' }, after: { alt: 'New screen' } },
  appendix: { type: 'appendix', heading: 'Backup Slides', subtitle: 'Answers held in reserve' },
};

const WHEN = {
  title: 'First slide only',
  bullets: '2 to 5 parallel points',
  split: 'Two things, side by side',
  code: 'A focused snippet, 15 lines or fewer',
  quote: 'A principle or a striking line',
  divider: 'A section break',
  qa: 'A planned pause, every 4 to 5 slides',
  cta: 'The last slide: one action',
  image: 'A screenshot, diagram, or photo',
  stats: 'Up to 4 numbers that carry the argument',
  timeline: 'A sequence: roadmap, phases, milestones',
  columns: 'Two columns of prose, not bullets',
  agenda: 'What the talk covers, ideally auto from dividers',
  table: 'A small comparison read across',
  grid: '2 to 4 points that are not a sequence',
  media: 'A screenshot needing a few lines beside it',
  matrix: 'Which option wins, scanned down a column',
  people: 'Introducing a team, with or without headshots',
  checklist: 'Status: done, doing, blocked, to do',
  compare: 'Two images sharing one frame',
  appendix: 'Ends the talk; what follows is backup',
};

/* ── YAML surgery ──────────────────────────────────────────────────────── */

/* The textarea is the source of truth, so applying a style means editing text,
   not a model. Slides are found by their `- type:` lines; a property is written
   at the slide's own indentation + 2, which is the shape every deck here uses. */
function slideLineRanges(lines) {
  const starts = [];
  lines.forEach((l, i) => {
    const m = /^(\s*)-\s+type:/.exec(l);
    if (m) starts.push({ line: i, indent: m[1].length });
  });
  return starts.map((s, i) => ({
    ...s,
    end: i + 1 < starts.length ? starts[i + 1].line - 1 : lines.length - 1,
  }));
}

function setSlideProp(index, key, value) {
  const ta = document.getElementById('yaml-input');
  const lines = ta.value.split('\n');
  const ranges = slideLineRanges(lines);
  const r = ranges[index];
  if (!r) return false;

  const pad = ' '.repeat(r.indent + 2);
  const re = new RegExp(`^\\s*${key}:`);
  for (let i = r.line; i <= r.end; i++) {
    if (re.test(lines[i])) {
      lines[i] = `${pad}${key}: ${value}`;
      ta.value = lines.join('\n');
      return true;
    }
  }
  lines.splice(r.line + 1, 0, `${pad}${key}: ${value}`);
  ta.value = lines.join('\n');
  return true;
}

function setDeckProp(key, value) {
  const ta = document.getElementById('yaml-input');
  const lines = ta.value.split('\n');
  const re = new RegExp(`^(\\s*)${key}:`);
  const slidesAt = lines.findIndex(l => /^\s*slides:/.test(l));
  for (let i = 0; i < (slidesAt === -1 ? lines.length : slidesAt); i++) {
    if (re.test(lines[i])) {
      const indent = re.exec(lines[i])[1];
      lines[i] = `${indent}${key}: ${value}`;
      ta.value = lines.join('\n');
      return true;
    }
  }
  const presAt = lines.findIndex(l => /^presentation:/.test(l));
  if (presAt === -1) return false;
  lines.splice(presAt + 1, 0, `  ${key}: ${value}`);
  ta.value = lines.join('\n');
  return true;
}

function removeSlideProp(index, key) {
  const ta = document.getElementById('yaml-input');
  const lines = ta.value.split('\n');
  const r = slideLineRanges(lines)[index];
  if (!r) return false;
  const re = new RegExp(`^\\s*${key}:`);
  for (let i = r.end; i >= r.line; i--) if (re.test(lines[i])) lines.splice(i, 1);
  ta.value = lines.join('\n');
  return true;
}

function removeDeckProp(key) {
  const ta = document.getElementById('yaml-input');
  const lines = ta.value.split('\n');
  const slidesAt = lines.findIndex(l => /^\s*slides:/.test(l));
  const limit = slidesAt === -1 ? lines.length : slidesAt;
  const re = new RegExp(`^\\s*${key}:`);
  for (let i = limit - 1; i >= 0; i--) if (re.test(lines[i])) lines.splice(i, 1);
  ta.value = lines.join('\n');
  return true;
}

function applyProp(key, value) {
  const scope = document.querySelector('input[name="cat-scope"]:checked')?.value || 'slide';
  const deck = scope === 'deck';

  /* `background: none` is not "no background", it is a CSS keyword that makes
     the slide transparent and shows the page through it. Clearing the override
     means deleting the key. `pattern: none` is different: it is the documented
     way to opt one slide out of a deck-wide pattern, so it is written out. */
  const clearing = value === 'none' && (key === 'background' || deck);
  const ok = clearing
    ? (deck ? removeDeckProp(key) : removeSlideProp(state.current, key))
    : (deck ? setDeckProp(key, value) : setSlideProp(state.current, key, value));

  if (!ok) { showToast('Add a slide first'); return; }
  update();
  const where = deck ? 'Deck' : `Slide ${state.current + 1}`;
  showToast(clearing ? `${where} ${key} cleared` : `${where} ${key}: ${value}`);
}

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

function insertSkeleton(type) {
  const ta = document.getElementById('yaml-input');
  const skeleton = SLIDE_SKELETONS[type] || SLIDE_SKELETONS.bullets;
  const pos = ta.selectionStart || ta.value.length;
  ta.value = ta.value.slice(0, pos) + skeleton + ta.value.slice(pos);
  ta.selectionStart = ta.selectionEnd = pos + skeleton.length;
  update();
  showToast(`${type} slide inserted`);
}


/* ── Deck-level surgery: nested maps and whole decks ───────────────────── */

/* `brand:` is a nested map, so it needs its own writer: find the block, then
   the key inside it, and create whichever half is missing. */
function setBrandProp(key, value) {
  const ta = document.getElementById('yaml-input');
  const lines = ta.value.split('\n');
  const slidesAt = lines.findIndex(l => /^\s*slides:/.test(l));
  const limit = slidesAt === -1 ? lines.length : slidesAt;
  const brandAt = lines.findIndex((l, i) => i < limit && /^\s*brand:\s*$/.test(l));

  if (brandAt === -1) {
    const presAt = lines.findIndex(l => /^presentation:/.test(l));
    if (presAt === -1) return false;
    lines.splice(presAt + 1, 0, '  brand:', `    ${key}: "${value}"`);
    ta.value = lines.join('\n');
    return true;
  }
  const re = new RegExp(`^\\s+${key}:`);
  for (let i = brandAt + 1; i < limit; i++) {
    if (/^\s{0,2}\S/.test(lines[i])) break;          // left the brand block
    if (re.test(lines[i])) {
      lines[i] = `    ${key}: "${value}"`;
      ta.value = lines.join('\n');
      return true;
    }
  }
  lines.splice(brandAt + 1, 0, `    ${key}: "${value}"`);
  ta.value = lines.join('\n');
  return true;
}

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

/* ── Deck skeletons: whole talk shapes ─────────────────────────────────── */

/* The three flows CLAUDE.md already prescribes, plus the update shape, built
   out of the same skeletons the type cards insert, so a change to a type
   reaches the structures too. */
const STRUCTURES = {
  'Technical proposal': {
    when: 'Convincing engineers to change something',
    types: ['title', 'agenda', 'bullets', 'split', 'code', 'table', 'qa', 'timeline', 'cta'],
  },
  'Stakeholder pitch': {
    when: 'Asking for a decision or a budget',
    types: ['title', 'agenda', 'bullets', 'stats', 'grid', 'quote', 'qa', 'cta'],
  },
  'Tutorial / walkthrough': {
    when: 'Teaching something hands on',
    types: ['title', 'agenda', 'divider', 'grid', 'code', 'image', 'qa', 'checklist', 'cta'],
  },
  'Status update': {
    when: 'A recurring report to a room that was not there',
    types: ['title', 'agenda', 'stats', 'checklist', 'divider', 'people', 'qa', 'cta'],
  },
};

function structureYAML(name) {
  const def = STRUCTURES[name];
  const head = [
    'presentation:',
    `  title: "${name}"`,
    '  subtitle: "One line that frames the talk"',
    '  author: "Your Name"',
    '',
    '  slides:',
  ].join('\n');
  return head + def.types.map(t => (SLIDE_SKELETONS[t] || '')).join('') + '\n';
}

/* ── Glyphs for grid icons ─────────────────────────────────────────────── */

const GLYPHS = ['◆', '▲', '●', '■', '★', '✦', '➜', '⚑', '⌘', '⚙', '◐', '✓', '✕', '⚠', '∞', '⏱'];

function insertAtCursor(text) {
  const ta = document.getElementById('yaml-input');
  const pos = ta.selectionStart ?? ta.value.length;
  ta.value = ta.value.slice(0, pos) + text + ta.value.slice(pos);
  ta.selectionStart = ta.selectionEnd = pos + text.length;
  ta.focus();
  update();
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
