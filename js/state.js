/* ═══════════════════════════════════════════════════════════════════════════
   Shared mutable state + theme system
═══════════════════════════════════════════════════════════════════════════ */

/* Key order = dropdown order: dark themes first, then light. Names are colors,
   never brands — decks get exported and reshared with this name in their YAML. */
export const THEMES = {
  neorgon: {
    bg: '#080f20', accent: '#0063e5', text: '#f9f9f9', ts: '#cacaca',
    muted: 'rgba(255,255,255,.45)', dim: 'rgba(255,255,255,.22)',
    border: 'rgba(255,255,255,.08)', codeBg: 'rgba(0,0,0,.5)', codeText: '#a5f3fc',
    grad: 'linear-gradient(135deg,rgba(0,99,229,.07) 0%,transparent 55%)',
  },
  royal: {
    bg: '#0a1733', accent: '#4f9cff', text: '#f2f7ff', ts: '#d7e4f7',
    muted: 'rgba(215,228,247,.5)', dim: 'rgba(215,228,247,.25)',
    border: 'rgba(79,156,255,.14)', codeBg: 'rgba(3,12,32,.6)', codeText: '#9ec9ff',
    grad: 'linear-gradient(135deg,rgba(0,99,229,.12) 0%,transparent 55%)',
  },
  midnight: {
    bg: '#0d0b1e', accent: '#a78bfa', text: '#f0ecff', ts: '#d8d0f5',
    muted: 'rgba(216,208,245,.45)', dim: 'rgba(216,208,245,.22)',
    border: 'rgba(167,139,250,.12)', codeBg: 'rgba(0,0,20,.6)', codeText: '#c4b5fd',
    grad: 'linear-gradient(135deg,rgba(167,139,250,.08) 0%,transparent 55%)',
  },
  forest: {
    bg: '#07130c', accent: '#34d399', text: '#eafff5', ts: '#c9ecd9',
    muted: 'rgba(201,236,217,.45)', dim: 'rgba(201,236,217,.22)',
    border: 'rgba(52,211,153,.13)', codeBg: 'rgba(0,12,6,.55)', codeText: '#86efc3',
    grad: 'linear-gradient(135deg,rgba(52,211,153,.07) 0%,transparent 55%)',
  },
  ember: {
    bg: '#130900', accent: '#f59e0b', text: '#fef3c7', ts: '#fde68a',
    muted: 'rgba(253,230,138,.45)', dim: 'rgba(253,230,138,.22)',
    border: 'rgba(245,158,11,.12)', codeBg: 'rgba(0,0,0,.55)', codeText: '#fde68a',
    grad: 'linear-gradient(135deg,rgba(245,158,11,.06) 0%,transparent 55%)',
  },
  graphite: {
    bg: '#111418', accent: '#b8c6d4', text: '#f4f6f8', ts: '#d6dce2',
    muted: 'rgba(214,220,226,.45)', dim: 'rgba(214,220,226,.22)',
    border: 'rgba(255,255,255,.10)', codeBg: 'rgba(0,0,0,.5)', codeText: '#cbd7e2',
    grad: 'linear-gradient(135deg,rgba(255,255,255,.05) 0%,transparent 55%)',
    onAccent: '#111418',   // silver accent can't carry white text (CTA pill, timeline dots)
  },
  minimal: {
    bg: '#f8fafc', accent: '#1d4ed8', text: '#0f172a', ts: '#1e293b',
    muted: 'rgba(15,23,42,.5)', dim: 'rgba(15,23,42,.3)',
    border: 'rgba(15,23,42,.1)', codeBg: 'rgba(0,0,0,.04)', codeText: '#1e40af',
    grad: 'linear-gradient(135deg,rgba(29,78,216,.04) 0%,transparent 55%)',
  },
  azure: {
    bg: '#f2f7fd', accent: '#0063e5', text: '#0c1a2e', ts: '#22344c',
    muted: 'rgba(12,26,46,.52)', dim: 'rgba(12,26,46,.3)',
    border: 'rgba(12,26,46,.12)', codeBg: 'rgba(0,60,140,.05)', codeText: '#0056c7',
    grad: 'linear-gradient(135deg,rgba(0,99,229,.08) 0%,transparent 55%)',
  },
  meadow: {
    bg: '#f5faf0', accent: '#3f7d20', text: '#141f0d', ts: '#2a3a1d',
    muted: 'rgba(20,31,13,.52)', dim: 'rgba(20,31,13,.3)',
    border: 'rgba(20,31,13,.12)', codeBg: 'rgba(46,90,20,.06)', codeText: '#2f6414',
    grad: 'linear-gradient(135deg,rgba(150,200,60,.12) 0%,transparent 55%)',
  },
  dawn: {
    bg: '#fdf8f1', accent: '#c2410c', text: '#27170a', ts: '#3f2814',
    muted: 'rgba(39,23,10,.52)', dim: 'rgba(39,23,10,.3)',
    border: 'rgba(39,23,10,.12)', codeBg: 'rgba(150,60,10,.05)', codeText: '#9a3412',
    grad: 'linear-gradient(135deg,rgba(234,88,12,.08) 0%,transparent 55%)',
  },
};

/** Shared mutable state — all modules import this same object */
export const state = {
  slides:      [],
  meta:        {},
  current:     0,
  fsCurrent:   0,
  error:       null,
  currentTheme: localStorage.getItem('pres-sage-theme') || 'neorgon',
  themeOverride: false,   // true once the visitor picks a theme this session; deck-declared theme then stops re-applying
  auditOpen:   false,
};

export const BG_PRESETS = {
  aurora:   'linear-gradient(135deg, #1a0040 0%, #0d3b4e 50%, #0a2a2a 100%)',
  sunset:   'linear-gradient(135deg, #2d0a1e 0%, #4a1a0a 50%, #1a0800 100%)',
  ocean:    'linear-gradient(135deg, #001a33 0%, #003355 50%, #001a2e 100%)',
  ember:    'linear-gradient(135deg, #1a0500 0%, #3d1200 50%, #140300 100%)',
  midnight: 'linear-gradient(135deg, #0a0020 0%, #1a0040 50%, #050010 100%)',
  forest:   'linear-gradient(135deg, #001a0a 0%, #0a2e1a 50%, #001408 100%)',
  storm:    'linear-gradient(135deg, #0a0a1e 0%, #1a1a3a 50%, #050510 100%)',
};

/** Resolve a background value: preset name → gradient, or pass through raw CSS */
export function resolveBg(value) {
  if (!value) return null;
  return BG_PRESETS[value] || value;
}

/* Background patterns — subtle texture layered over any theme or bg preset.
   Every layer draws with var(--sl-pattern-ink), which applyTheme derives from
   the background's luminance, so the same pattern name works on dark and light
   themes alike. sizes maps per layer; composing code appends the underlying
   gradient's own size. */
export const PATTERNS = {
  dots: {
    layers: ['radial-gradient(circle, var(--sl-pattern-ink) 1px, transparent 1.6px)'],
    sizes:  ['22px 22px'],
  },
  grid: {
    layers: [
      'linear-gradient(var(--sl-pattern-ink) 1px, transparent 1px)',
      'linear-gradient(90deg, var(--sl-pattern-ink) 1px, transparent 1px)',
    ],
    sizes: ['44px 44px', '44px 44px'],
  },
  diagonal: {
    layers: ['repeating-linear-gradient(45deg, var(--sl-pattern-ink) 0 1px, transparent 1px 16px)'],
    sizes:  ['auto'],
  },
  rings: {
    layers: ['repeating-radial-gradient(circle at 85% 12%, var(--sl-pattern-ink) 0 1px, transparent 1px 46px)'],
    sizes:  ['auto'],
  },
};

/* Deck-declared brand colors. Only these keys may override the theme — the
   theme list stays color-named and shared (names are colors, never brands);
   a brand's identity travels inside the deck's own YAML instead. */
const BRAND_KEYS = { accent: 'accent', bg: 'bg', text: 'text', on_accent: 'onAccent' };

/** The resolved theme with the deck's brand overrides merged over it. */
export function themeWithBrand(name, brand) {
  const t = THEMES[name] || THEMES.neorgon;
  if (!brand || typeof brand !== 'object') return t;
  const merged = { ...t };
  for (const [yamlKey, themeKey] of Object.entries(BRAND_KEYS)) {
    if (typeof brand[yamlKey] === 'string' && brand[yamlKey]) merged[themeKey] = brand[yamlKey];
  }
  return merged;
}

/* Pattern ink from background luminance: dark backgrounds get faint white,
   light ones faint slate. Non-hex backgrounds fall back to faint white. */
function patternInk(bg) {
  const m = /^#([0-9a-f]{6})$/i.exec(bg || '');
  if (m) {
    const n = parseInt(m[1], 16);
    const lum = (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
    if (lum > 0.6) return 'rgba(15,23,42,.06)';
  }
  return 'rgba(255,255,255,.055)';
}

/** Layer a background pattern over whatever background the element already has. */
export function applyPattern(el, name) {
  const p = PATTERNS[name];
  if (!p) return;
  const existing = el.style.backgroundImage;
  const under = existing && existing !== 'none' ? [existing] : [];
  el.style.backgroundImage = [...p.layers, ...under].join(', ');
  el.style.backgroundSize = [...p.sizes, ...under.map(() => 'auto')].join(', ');
}

/** Apply a theme's CSS custom properties to a slide element */
export function applyTheme(el, name, brand) {
  const t = themeWithBrand(name, brand);
  el.style.background = t.bg;
  el.style.setProperty('--sl-pattern-ink', patternInk(t.bg));
  el.style.setProperty('--sl-on-accent', t.onAccent || '#fff');
  el.style.setProperty('--sl-accent',    t.accent);
  el.style.setProperty('--sl-text',      t.text);
  el.style.setProperty('--sl-ts',        t.ts);
  el.style.setProperty('--sl-muted',     t.muted);
  el.style.setProperty('--sl-dim',       t.dim);
  el.style.setProperty('--sl-border',    t.border);
  el.style.setProperty('--sl-code-bg',   t.codeBg);
  el.style.setProperty('--sl-code-text', t.codeText);
  el.style.setProperty('--sl-grad',      t.grad);
}
