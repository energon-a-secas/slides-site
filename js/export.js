/* ═══════════════════════════════════════════════════════════════════════════
   Export functions — YAML, Marp Markdown, standalone HTML, PPTX
═══════════════════════════════════════════════════════════════════════════ */

import { state, themeWithBrand, resolveBg } from './state.js';
import { esc, slug, download, showToast } from './utils.js';
import { renderSlide } from './render.js';
import { deckToMarp, deckToPptx } from './serialize.js';

/* ── YAML export ──────────────────────────────────────────────────────── */

export function exportYAML() {
  const text = document.getElementById('yaml-input').value;
  if (!text.trim()) { showToast('Nothing to export'); return; }
  download(text, `${slug(state.meta)}.yaml`, 'text/yaml');
  showToast('YAML exported!');
}

/* ── Marp Markdown export ─────────────────────────────────────────────── */

export function exportMarp() {
  if (!state.slides.length) { showToast('Load a presentation first'); return; }
  const t = themeWithBrand(state.currentTheme, state.meta.brand);
  const text = deckToMarp(state.meta, state.slides, t);
  download(text, `${slug(state.meta)}.md`, 'text/markdown');
  showToast('Markdown exported!');
}

/* ── Standalone HTML export ───────────────────────────────────────────── */

export function exportHTML() {
  if (!state.slides.length) { showToast('Load a presentation first'); return; }
  const { meta, slides } = state;

  const slideMarkup = slides.map((slide, i) => {
    const el = renderSlide(slide, i, slides.length);
    el.style.cssText = 'max-width:min(92vw,calc(92vh*16/9));border-radius:4px;';
    return `<div class="fs-slide${i === 0 ? ' active' : ''}">${el.outerHTML}</div>`;
  }).join('\n');

  /* Two bugs lived in the old one-liner. styleSheets[0] is the CDN reset, which
     is cross-origin and served without `crossorigin`, so reading .cssRules threw
     a SecurityError and the export produced nothing at all, silently. And even
     when it did not throw, index [0] inlined the reset and none of the slide
     CSS. Collect every same-origin sheet instead, and skip the ones the browser
     will not open rather than dying on them. */
  const inlineStyle = Array.from(document.styleSheets)
    .map(sheet => {
      try {
        return Array.from(sheet.cssRules).map(r => r.cssText).join('\n');
      } catch {
        return '';   // cross-origin: unreadable by design, not an error here
      }
    })
    .filter(Boolean)
    .join('\n');

  if (!inlineStyle) {
    showToast('Could not read the stylesheet; export aborted');
    return;
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(meta.title)}</title>
<style>
${inlineStyle}
body{overflow:hidden;display:flex;align-items:center;justify-content:center;height:100vh;background:#000;}
.fs-slide{display:none;position:absolute;}
.fs-slide.active{display:flex;}
.controls{position:fixed;bottom:18px;display:flex;align-items:center;gap:12px;z-index:10;}
.controls .nav-btn{width:36px;height:36px;font-size:1rem;}
#ctr{font-size:.82rem;color:rgba(255,255,255,.4);min-width:60px;text-align:center;}
</style>
</head>
<body>
${slideMarkup}
<div class="controls">
  <button class="nav-btn" onclick="prev()">\u2039</button>
  <span id="ctr">1 / ${slides.length}</span>
  <button class="nav-btn" onclick="next()">\u203A</button>
</div>
<script>
let cur=0,total=${slides.length};
function show(n){document.querySelectorAll('.fs-slide').forEach((s,i)=>s.classList.toggle('active',i===n));document.getElementById('ctr').textContent=(n+1)+' / '+total;}
function prev(){if(cur>0){cur--;show(cur);}}
function next(){if(cur<total-1){cur++;show(cur);}}
document.addEventListener('keydown',e=>{
  if(e.key==='ArrowRight'||e.key==='ArrowDown')next();
  if(e.key==='ArrowLeft'||e.key==='ArrowUp')prev();
});
<\/script>
</body></html>`;

  download(html, `${slug(state.meta)}.html`, 'text/html');
  showToast('HTML exported!');
}


/* Synchronous by necessity: deckToPptx walks the deck in one pass. The image is
   already in the DOM for any slide the player has rendered, so this reuses that
   decoded bitmap rather than fetching again. */
function svgToPngDataUri(src) {
  const live = [...document.querySelectorAll('img.slide-image, img.person-face, img.title-logo')]
    .find(im => im.src === src || im.src.endsWith(src)) || null;
  if (!live || !live.complete || !live.naturalWidth) return null;
  try {
    const scale = Math.min(1600 / live.naturalWidth, 4);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(live.naturalWidth * scale);
    canvas.height = Math.round(live.naturalHeight * scale);
    canvas.getContext('2d').drawImage(live, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');   // throws if the canvas is tainted
  } catch {
    return null;
  }
}

/* ── PPTX export ──────────────────────────────────────────────────────── */

export function exportPPTX() {
  if (!state.slides.length) { showToast('Load a presentation first'); return; }
  if (typeof PptxGenJS === 'undefined') {
    showToast('Export library failed to load'); return;
  }
  const t = themeWithBrand(state.currentTheme, state.meta.brand);
  /* The browser can rasterise an SVG itself, which is what PPTX needs: see the
     note in js/serialize.js. Only same-origin and data: sources can be read
     back out of a canvas; a cross-origin image taints it, so those are left to
     be reported and skipped rather than silently corrupting the file. */
  const pptx = deckToPptx(new PptxGenJS(), state.meta, state.slides, t, {
    resolveImage: (src) => (src && /\.svgz?($|\?)/i.test(src)) ? svgToPngDataUri(src) : src,
  });
  pptx.writeFile({ fileName: `${slug(state.meta)}.pptx` });
  showToast('PPTX exported!');
}
