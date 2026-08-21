/* ═══════════════════════════════════════════════════════════════════════════
   App entry point — wires up all modules and initializes
═══════════════════════════════════════════════════════════════════════════ */

import { state, THEMES } from './state.js';
import { update, initResizeObservers } from './render.js';
import { initEvents, exposeGlobals } from './events.js';
import { initCatalog } from './catalog.js';
import { initOnboarding } from './onboard.js';
import { loadFromUrl } from './share.js';

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

// Load a deck the URL carries (#d= payload, ?src= fetch, legacy ?yaml=),
// else restore the last session from localStorage.
if (!loadFromUrl()) {
  const saved = localStorage.getItem('presentation-sage');
  if (saved) {
    document.getElementById('yaml-input').value = saved;
    update();
  }
}

// Last, so it can see whether a deck arrived from the URL or localStorage
initOnboarding();
