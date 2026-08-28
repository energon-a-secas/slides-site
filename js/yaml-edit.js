/* ═══════════════════════════════════════════════════════════════════════════
   YAML surgery: every way the catalog edits the textarea, which is the
   deck's source of truth. Slide and deck keys, the nested brand: map, and
   the insert-at-cursor helpers. Split out of js/catalog.js when it outgrew
   the 500-line rule; the catalog UI imports from here.
═══════════════════════════════════════════════════════════════════════════ */

import { state } from './state.js';
import { update } from './render.js';
import { SLIDE_SKELETONS } from './events.js';
import { showToast } from './utils.js';

/* ── YAML surgery ──────────────────────────────────────────────────────── */

/* The textarea is the source of truth, so applying a style means editing text,
   not a model. Slides are found by their `- type:` lines; a property is written
   at the slide's own indentation + 2, which is the shape every deck here uses. */
export function slideLineRanges(lines) {
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

export function setSlideProp(index, key, value) {
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

export function setDeckProp(key, value) {
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

export function removeSlideProp(index, key) {
  const ta = document.getElementById('yaml-input');
  const lines = ta.value.split('\n');
  const r = slideLineRanges(lines)[index];
  if (!r) return false;
  const re = new RegExp(`^\\s*${key}:`);
  for (let i = r.end; i >= r.line; i--) if (re.test(lines[i])) lines.splice(i, 1);
  ta.value = lines.join('\n');
  return true;
}

export function removeDeckProp(key) {
  const ta = document.getElementById('yaml-input');
  const lines = ta.value.split('\n');
  const slidesAt = lines.findIndex(l => /^\s*slides:/.test(l));
  const limit = slidesAt === -1 ? lines.length : slidesAt;
  const re = new RegExp(`^\\s*${key}:`);
  for (let i = limit - 1; i >= 0; i--) if (re.test(lines[i])) lines.splice(i, 1);
  ta.value = lines.join('\n');
  return true;
}

export function applyProp(key, value) {
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

export function insertSkeleton(type) {
  const ta = document.getElementById('yaml-input');
  const skeleton = SLIDE_SKELETONS[type] || SLIDE_SKELETONS.bullets;
  const pos = ta.selectionStart || ta.value.length;
  ta.value = ta.value.slice(0, pos) + skeleton + ta.value.slice(pos);
  ta.selectionStart = ta.selectionEnd = pos + skeleton.length;
  update();
  showToast(`${type} slide inserted`);
}

/* `brand:` is a nested map, so it needs its own writer: find the block, then
   the key inside it, and create whichever half is missing. */
export function setBrandProp(key, value) {
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

export function insertAtCursor(text) {
  const ta = document.getElementById('yaml-input');
  const pos = ta.selectionStart ?? ta.value.length;
  ta.value = ta.value.slice(0, pos) + text + ta.value.slice(pos);
  ta.selectionStart = ta.selectionEnd = pos + text.length;
  ta.focus();
  update();
}
