/* ═══════════════════════════════════════════════════════════════════════════
   App entry point — wires up all modules and initializes
═══════════════════════════════════════════════════════════════════════════ */

import { state, THEMES } from './state.js';
import { update, initResizeObservers } from './render.js';
import { initEvents, exposeGlobals } from './events.js';
import { initCatalog } from './catalog.js';
import { initOnboarding } from './onboard.js';

// Expose all onclick handlers to the global scope (used by HTML attributes)
exposeGlobals();

// Build the theme picker from THEMES — adding a theme never needs an HTML edit
if (!THEMES[state.currentTheme]) state.currentTheme = 'neorgon';
const themeSel = document.getElementById('theme-select');
themeSel.innerHTML = Object.keys(THEMES)
  .map(k => `<option value="${k}">${k[0].toUpperCase() + k.slice(1)}</option>`)
  .join('');
themeSel.value = state.currentTheme;

// Set up ResizeObservers for slide scaling
initResizeObservers();

// Bind keyboard shortcuts and input listener
initEvents();
initCatalog();

// Restore saved presentation from localStorage, or load from URL ?yaml=... parameter
const params = new URLSearchParams(location.search);
const urlYaml = params.get('yaml');
if (urlYaml) {
  try {
    // URLSearchParams.get() has already decoded this. Decoding again threw
    // URIError on any lone '%', which is why five of the twelve library decks
    // opened an empty editor: they contain percentages.
    document.getElementById('yaml-input').value = urlYaml;
    update();
  } catch (e) {
    console.error('Failed to decode YAML from URL', e);
  }
} else {
  const saved = localStorage.getItem('presentation-sage');
  if (saved) {
    document.getElementById('yaml-input').value = saved;
    update();
  }
}

// Last, so it can see whether a deck arrived from the URL or localStorage
initOnboarding();
