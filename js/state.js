/* ═══════════════════════════════════════════════════════════════════════════
   Shared mutable state + theme system
═══════════════════════════════════════════════════════════════════════════ */

/* Key order = dropdown order: dark themes first, then light. Names are colors,
   never brands — decks get exported and reshared with this name in their YAML. */
/* Secondary text is legible, not merely present. `muted` carries captions, stat
   labels and person roles and clears 4.5:1 on every theme; `dim` carries the
   footer rail and title meta and clears 3:1, deliberately short of 4.5 so the
   chrome stays quieter than the body. Before this, muted sat at 3.38 to 4.51
   and dim at 1.65 to 2.00, and nothing had measured either because
   relLuminance() returned null for any rgba() string. */
export const THEMES = {
  neorgon: {
    bg: '#080f20', accent: '#0063e5', text: '#f9f9f9', ts: '#cacaca',
    muted: 'rgba(255,255,255,0.46)', dim: 'rgba(255,255,255,0.35)',
    border: 'rgba(255,255,255,.08)', codeBg: 'rgba(0,0,0,.5)', codeText: '#a5f3fc',
    grad: 'linear-gradient(135deg,rgba(0,99,229,.07) 0%,transparent 55%)',
  },
  royal: {
    bg: '#0a1733', accent: '#4f9cff', text: '#f2f7ff', ts: '#d7e4f7',
    muted: 'rgba(215,228,247,0.53)', dim: 'rgba(215,228,247,0.39)',
    border: 'rgba(79,156,255,.14)', codeBg: 'rgba(3,12,32,.6)', codeText: '#9ec9ff',
    grad: 'linear-gradient(135deg,rgba(0,99,229,.12) 0%,transparent 55%)',
  },
  midnight: {
    bg: '#0d0b1e', accent: '#a78bfa', text: '#f0ecff', ts: '#d8d0f5',
    muted: 'rgba(216,208,245,0.56)', dim: 'rgba(216,208,245,0.42)',
    border: 'rgba(167,139,250,.12)', codeBg: 'rgba(0,0,20,.6)', codeText: '#c4b5fd',
    grad: 'linear-gradient(135deg,rgba(167,139,250,.08) 0%,transparent 55%)',
  },
  forest: {
    bg: '#07130c', accent: '#34d399', text: '#eafff5', ts: '#c9ecd9',
    muted: 'rgba(201,236,217,0.52)', dim: 'rgba(201,236,217,0.39)',
    border: 'rgba(52,211,153,.13)', codeBg: 'rgba(0,12,6,.55)', codeText: '#86efc3',
    grad: 'linear-gradient(135deg,rgba(52,211,153,.07) 0%,transparent 55%)',
  },
  ember: {
    bg: '#130900', accent: '#f59e0b', text: '#fef3c7', ts: '#fde68a',
    muted: 'rgba(253,230,138,0.51)', dim: 'rgba(253,230,138,0.39)',
    border: 'rgba(245,158,11,.12)', codeBg: 'rgba(0,0,0,.55)', codeText: '#fde68a',
    grad: 'linear-gradient(135deg,rgba(245,158,11,.06) 0%,transparent 55%)',
  },
  graphite: {
    bg: '#111418', accent: '#b8c6d4', text: '#f4f6f8', ts: '#d6dce2',
    muted: 'rgba(214,220,226,0.54)', dim: 'rgba(214,220,226,0.41)',
    border: 'rgba(255,255,255,.10)', codeBg: 'rgba(0,0,0,.5)', codeText: '#cbd7e2',
    grad: 'linear-gradient(135deg,rgba(255,255,255,.05) 0%,transparent 55%)',
    onAccent: '#111418',   // silver accent can't carry white text (CTA pill, timeline dots)
  },
  minimal: {
    bg: '#f8fafc', accent: '#1d4ed8', text: '#0f172a', ts: '#1e293b',
    muted: 'rgba(15,23,42,0.6)', dim: 'rgba(15,23,42,0.48)',
    border: 'rgba(15,23,42,.1)', codeBg: 'rgba(0,0,0,.04)', codeText: '#1e40af',
    grad: 'linear-gradient(135deg,rgba(29,78,216,.04) 0%,transparent 55%)',
  },
  azure: {
    bg: '#f2f7fd', accent: '#0063e5', text: '#0c1a2e', ts: '#22344c',
    muted: 'rgba(12,26,46,0.61)', dim: 'rgba(12,26,46,0.48)',
    border: 'rgba(12,26,46,.12)', codeBg: 'rgba(0,60,140,.05)', codeText: '#0056c7',
    grad: 'linear-gradient(135deg,rgba(0,99,229,.08) 0%,transparent 55%)',
  },
  meadow: {
    bg: '#f5faf0', accent: '#3f7d20', text: '#141f0d', ts: '#2a3a1d',
    muted: 'rgba(20,31,13,0.62)', dim: 'rgba(20,31,13,0.49)',
    border: 'rgba(20,31,13,.12)', codeBg: 'rgba(46,90,20,.06)', codeText: '#2f6414',
    grad: 'linear-gradient(135deg,rgba(150,200,60,.12) 0%,transparent 55%)',
  },
  dawn: {
    bg: '#fdf8f1', accent: '#c2410c', text: '#27170a', ts: '#3f2814',
    muted: 'rgba(39,23,10,0.61)', dim: 'rgba(39,23,10,0.48)',
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
  /* This module is imported by the CLI as well as the page, and Node has no
     localStorage. Reading it through a guard keeps the themes and serializers
     importable headlessly; the browser behaviour is unchanged. */
  currentTheme: (typeof localStorage !== 'undefined' && localStorage?.getItem?.('pres-sage-theme')) || 'neorgon',
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
  // Two soft glow circles rather than a repeating texture: one big in the
  // bottom-right corner, one smaller upper-left. no-repeat, and drawn with the
  // strong ink — a lone soft circle at texture alpha is invisible.
  orbs: {
    layers: [
      'radial-gradient(circle 420px at 88% 96%, var(--sl-pattern-ink-strong), transparent 72%)',
      'radial-gradient(circle 280px at 12% 18%, var(--sl-pattern-ink-strong), transparent 72%)',
    ],
    sizes:   ['auto', 'auto'],
    repeats: ['no-repeat', 'no-repeat'],
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
    if (lum > 0.6) return { ink: 'rgba(15,23,42,.06)', strong: 'rgba(15,23,42,.12)' };
  }
  return { ink: 'rgba(255,255,255,.055)', strong: 'rgba(255,255,255,.11)' };
}

/** Layer a background pattern over whatever background the element already has. */
export function applyPattern(el, name) {
  const p = PATTERNS[name];
  if (!p) return;
  // The background shorthand leaves backgroundImage as a CSS-wide keyword
  // ('initial'), and a keyword inside a layer list invalidates the whole
  // declaration — only a real image/gradient counts as an under-layer.
  const existing = el.style.backgroundImage;
  const under =
    existing && !['none', 'initial', 'inherit', 'unset'].includes(existing) ? [existing] : [];
  el.style.backgroundImage = [...p.layers, ...under].join(', ');
  el.style.backgroundSize = [...p.sizes, ...under.map(() => 'auto')].join(', ');
  const repeats = p.repeats || p.layers.map(() => 'repeat');
  el.style.backgroundRepeat = [...repeats, ...under.map(() => 'no-repeat')].join(', ');
}

/** Apply a theme's CSS custom properties to a slide element */
export function applyTheme(el, name, brand) {
  const t = themeWithBrand(name, brand);
  el.style.background = t.bg;
  const ink = patternInk(t.bg);
  el.style.setProperty('--sl-pattern-ink', ink.ink);
  el.style.setProperty('--sl-pattern-ink-strong', ink.strong);
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
