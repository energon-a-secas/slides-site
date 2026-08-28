/* ═══════════════════════════════════════════════════════════════════════════
   Export functions — YAML, Marp Markdown, standalone HTML, PPTX
═══════════════════════════════════════════════════════════════════════════ */

import { state, themeWithBrand, resolveBg } from './state.js';
import { esc, slug, download, showToast } from './utils.js';
import { renderSlide } from './render.js';
import { deckToMarp, deckToPptx } from './serialize.js';
import { inspectPptx, zipFromJSZip } from './receipt.js';

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
    /* The handout path. On screen these two are invisible (`display:contents`
       and `display:none`); the print stylesheet below turns each slide into a
       page with its speaker note under it. Same trick as the footer kit's
       disclaimer: content held out of the way on screen, restored in flow for
       print, so the note field finally reaches paper. */
    const note = slide.note
      ? `<section class="print-note"><span class="print-note-label">Speaker note · slide ${i + 1}</span><p>${esc(String(slide.note)).replace(/\n/g, '<br>')}</p></section>`
      : '';
    return `<div class="fs-slide${i === 0 ? ' active' : ''}"><div class="print-box">${el.outerHTML}</div>${note}</div>`;
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
.print-box{display:contents;}
.print-note{display:none;}
.controls{position:fixed;bottom:18px;display:flex;align-items:center;gap:12px;z-index:10;}
.controls .nav-btn{width:36px;height:36px;font-size:1rem;}
#ctr{font-size:.82rem;color:rgba(255,255,255,.4);min-width:60px;text-align:center;}
/* Handout: one slide per page, its speaker note beneath. 0.7 scales the fixed
   960x540 canvas under both A4 and Letter printable widths; the box reserves
   the scaled size because transform does not affect layout. */
@media print {
  body{display:block;height:auto;overflow:visible;background:#fff;}
  .controls{display:none;}
  .fs-slide,.fs-slide.active{display:block;position:static;page-break-after:always;break-inside:avoid;}
  .fs-slide:last-child{page-break-after:auto;}
  .print-box{display:block;position:relative;width:672px;height:378px;margin:0 auto;overflow:hidden;}
  .print-box .slide{position:absolute;left:0;top:0;transform:scale(.7);transform-origin:top left;max-width:none!important;border-radius:0!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .print-note{display:block;width:672px;margin:14px auto 0;padding:10px 14px;border-left:3px solid #999;color:#111;font-size:12px;line-height:1.5;}
  .print-note p{margin:0;}
  .print-note-label{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#666;margin-bottom:4px;}
}
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

export async function exportPPTX() {
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
  const fileName = `${slug(state.meta)}.pptx`;
  /* Build to a blob first so the bytes the visitor downloads are the bytes the
     receipt inspected. If the blob path fails for any reason, fall back to the
     plain download: the file always comes first, the receipt is extra. */
  let blob = null;
  try { blob = await pptx.write({ outputType: 'blob' }); } catch { blob = null; }
  if (!blob) { pptx.writeFile({ fileName }); showToast('PPTX exported!'); return; }
  download(blob, fileName, 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
  showToast('PPTX exported!');
  try {
    if (typeof JSZip === 'undefined') return;
    const z = await JSZip.loadAsync(blob);
    let deck = null;
    try { deck = jsyaml.load(document.getElementById('yaml-input').value)?.presentation || null; } catch { deck = null; }
    showReceipt(await inspectPptx(zipFromJSZip(z), deck, fileName), fileName, blob.size);
  } catch (e) {
    console.warn('Export receipt skipped:', e);
  }
}

/* ── The receipt dialog ───────────────────────────────────────────────────
   Same checks as check-exports.mjs (they share js/receipt.js), shown on the
   file that was just downloaded. Facts first, so a clean export says what was
   verified rather than just "no problems"; findings after, in audit levels. */
function showReceipt(result, fileName, bytes) {
  const dlg = document.getElementById('receipt-dialog');
  if (!dlg) return;
  const { findings, facts } = result;
  const warns = findings.filter(f => f.level === 'warn');
  const has = (re) => findings.some(f => f.level === 'warn' && re.test(f.msg));
  const fact = (ok, text) => `<div class="receipt-fact ${ok ? 'ok' : 'bad'}"><span class="glyph">${ok ? '\u2713' : '\u2715'}</span><span>${esc(text)}</span></div>`;
  const rows = [];
  rows.push(fact(facts.textRuns > 0, `Editable text: ${facts.textRuns} text run${facts.textRuns === 1 ? '' : 's'} across ${facts.slides} slide${facts.slides === 1 ? '' : 's'}, real text boxes, not pictures of slides`));
  if (facts.strings) rows.push(fact(facts.missing === 0, `Authored strings present: ${facts.strings - facts.missing} of ${facts.strings}`));
  if (facts.media) rows.push(fact(facts.mediaOk === facts.media, `Images: ${facts.mediaOk} of ${facts.media} are what their extension says`));
  rows.push(fact(!has(/local filesystem path/), 'No local file paths inside the file'));
  if (facts.pageIn) rows.push(fact(!has(/off the page/) && !has(/overlap/), `Page ${facts.pageIn} in, nothing off the page, no text boxes colliding`));
  rows.push(facts.notes ? fact(true, `Speaker notes carried on ${facts.notes} slide${facts.notes === 1 ? '' : 's'}`) : `<div class="receipt-fact info"><span class="glyph">\u2013</span><span>No speaker notes in this deck</span></div>`);
  const issues = findings.length
    ? `<div class="receipt-findings">${findings.map(f => `<div class="receipt-issue ${f.level}"><span class="receipt-level">${f.level}</span>${esc(f.msg)}</div>`).join('')}</div>`
    : '';
  dlg.querySelector('#receipt-title').textContent = warns.length ? `${warns.length} defect${warns.length === 1 ? '' : 's'} in the exported file` : 'Clean export receipt';
  dlg.querySelector('#receipt-sub').textContent = `${fileName} \u00B7 ${(bytes / 1024).toFixed(0)} KB \u00B7 checked after building, before you open it`;
  dlg.querySelector('#receipt-body').innerHTML = `<div class="receipt-facts">${rows.join('')}</div>${issues}`;
  dlg.querySelector('#receipt-close').onclick = () => dlg.close();
  if (!dlg.open) dlg.showModal();
}
