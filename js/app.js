/* ═══════════════════════════════════════════════════════════════════════════
   App entry point — wires up all modules and initializes
═══════════════════════════════════════════════════════════════════════════ */

import { state, THEMES } from './state.js';
import { update, initResizeObservers } from './render.js';
import { initEvents, exposeGlobals } from './events.js';

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

// Restore saved presentation from localStorage, or load from URL ?yaml=... parameter
const params = new URLSearchParams(location.search);
const urlYaml = params.get('yaml');
if (urlYaml) {
  try {
    document.getElementById('yaml-input').value = decodeURIComponent(urlYaml);
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
