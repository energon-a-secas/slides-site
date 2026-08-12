/* ═══════════════════════════════════════════════════════════════════════════
   Publish — Reveal.js export, ZIP bundle, gallery manager
═══════════════════════════════════════════════════════════════════════════ */

import { state, themeWithBrand, resolveBg } from './state.js';
import { esc, slug, download, showToast } from './utils.js';

const GALLERY_KEY = 'pres-sage-gallery';

/* ── Reveal.js HTML generation ───────────────────────────────────────── */

function buildRevealHTML(meta, slides, themeName) {
  const t = themeWithBrand(themeName, meta?.brand);

  const slideSections = slides.map(slide => {
    const type = slide.type || 'bullets';
    const note = slide.note ? `<aside class="notes">${esc(slide.note)}</aside>` : '';
    const bgVal = resolveBg(slide.background);
    const bgAttr = bgVal
      ? (bgVal.includes('gradient') ? `data-background="${bgVal}"` : `data-background-color="${bgVal}"`)
      : `data-background="${t.bg}"`;

    switch (type) {
      case 'title':
        return `<section ${bgAttr}>
  <h1 style="font-size:2.4em;font-weight:700;color:${t.text}">${esc(slide.heading || meta.title)}</h1>
  <div style="width:48px;height:4px;border-radius:2px;background:${t.accent};margin:24px auto"></div>
  <p style="font-size:1em;color:${t.muted}">${esc(slide.subtitle || meta.subtitle || '')}</p>
  <p style="font-size:0.6em;color:${t.dim};margin-top:40px">${esc(meta.author || '')}${meta.date ? ' &mdash; ' + esc(meta.date) : ''}</p>
  ${note}
</section>`;

      case 'bullets':
        return `<section ${bgAttr}>
  <h2 style="font-size:1.5em;font-weight:700;color:${t.text};border-bottom:1px solid ${t.border};padding-bottom:14px">${esc(slide.heading || '')}</h2>
  <ul style="list-style:none;padding:0;margin-top:20px;text-align:left">
    ${(slide.bullets || []).map(b =>
      `<li style="padding:8px 0 8px 24px;position:relative;color:${t.ts};font-size:0.85em;line-height:1.5"><span style="position:absolute;left:0;top:16px;width:8px;height:8px;border-radius:50%;background:${t.accent}"></span>${esc(b)}</li>`
    ).join('\n    ')}
  </ul>
  ${note}
</section>`;

      case 'split': {
        const mkCol = (col, label) => {
          if (!col) return '';
          return `<div style="flex:1">
      <h4 style="font-size:0.65em;font-weight:700;color:${t.accent};text-transform:uppercase;letter-spacing:0.6px;margin-bottom:12px">${esc(col.heading || label)}</h4>
      <ul style="list-style:disc;padding-left:20px;color:${t.ts};font-size:0.75em;line-height:1.6">
        ${(col.bullets || []).map(b => `<li>${esc(b)}</li>`).join('\n        ')}
      </ul>
    </div>`;
        };
        return `<section ${bgAttr}>
  <h2 style="font-size:1.5em;font-weight:700;color:${t.text};border-bottom:1px solid ${t.border};padding-bottom:14px">${esc(slide.heading || '')}</h2>
  <div style="display:flex;gap:40px;margin-top:20px">
    ${mkCol(slide.left, 'Left')}
    ${mkCol(slide.right, 'Right')}
  </div>
  ${note}
</section>`;
      }

      case 'code':
        return `<section ${bgAttr}>
  <h2 style="font-size:1.5em;font-weight:700;color:${t.text};border-bottom:1px solid ${t.border};padding-bottom:14px">${esc(slide.heading || 'Code')}</h2>
  <pre style="background:${t.codeBg};border:1px solid ${t.border};border-radius:8px;padding:20px;margin-top:16px;text-align:left;box-shadow:none"><code style="color:${t.codeText};font-size:0.7em;line-height:1.6;font-family:'JetBrains Mono','Fira Code','Cascadia Code',monospace">${esc(slide.code || '')}</code></pre>
  ${note}
</section>`;

      case 'quote':
        return `<section ${bgAttr}>
  <div style="font-size:4em;color:${t.accent};opacity:0.35;font-family:Georgia,serif;line-height:0.8">&ldquo;</div>
  <p style="font-size:1.1em;color:${t.text};font-style:italic;line-height:1.6;margin-top:10px">${esc(slide.text || '')}</p>
  ${slide.source ? `<p style="margin-top:20px;font-size:0.7em;color:${t.accent};font-weight:600">&mdash; ${esc(slide.source)}</p>` : ''}
  ${note}
</section>`;

      case 'divider': {
        const divBg = bgVal || `linear-gradient(135deg, rgba(176,21,176,.12) 0%, rgba(61,0,128,.12) 50%, ${t.bg} 100%)`;
        return `<section data-background="${divBg}">
  <h1 style="font-size:2.4em;font-weight:700;color:${t.text}">${esc(slide.heading || '')}</h1>
  <div style="width:48px;height:4px;border-radius:2px;background:${t.accent};margin:18px auto"></div>
  ${slide.subtitle ? `<p style="font-size:0.85em;color:${t.muted};margin-top:12px">${esc(slide.subtitle)}</p>` : ''}
  ${note}
</section>`;
      }

      case 'qa':
        return `<section ${bgAttr}>
  <div style="font-size:2.5em;margin-bottom:16px">&#x1F4AC;</div>
  <h1 style="font-size:2em;font-weight:700;color:${t.text}">${esc(slide.heading || 'Questions?')}</h1>
  ${slide.subtext ? `<p style="font-size:0.8em;color:${t.muted};margin-top:16px">${esc(slide.subtext)}</p>` : ''}
  ${note}
</section>`;

      case 'cta':
        return `<section ${bgAttr}>
  <h2 style="font-size:1.6em;font-weight:700;color:${t.text}">${esc(slide.heading || 'Next Steps')}</h2>
  ${slide.action ? `<div style="display:inline-block;background:${t.accent};color:#fff;font-weight:700;font-size:0.85em;padding:14px 34px;border-radius:9px;margin-top:28px">&rarr; ${esc(slide.action)}</div>` : ''}
  ${slide.subtext ? `<p style="font-size:0.7em;color:${t.muted};margin-top:18px">${esc(slide.subtext)}</p>` : ''}
  ${note}
</section>`;

      case 'image':
        return `<section ${bgAttr}>
  ${slide.heading ? `<h2 style="font-size:1.5em;font-weight:700;color:${t.text};margin-bottom:16px">${esc(slide.heading)}</h2>` : ''}
  <img src="${esc(slide.src || '')}" alt="${esc(slide.alt || '')}" style="max-width:85%;max-height:${slide.heading ? '65%' : '80%'};object-fit:${slide.fit || 'contain'};border-radius:6px">
  ${slide.caption ? `<p style="font-size:0.65em;color:${t.muted};margin-top:12px">${esc(slide.caption)}</p>` : ''}
  ${note}
</section>`;

      case 'stats':
        return `<section ${bgAttr}>
  ${slide.heading ? `<h2 style="font-size:1.5em;font-weight:700;color:${t.text};border-bottom:1px solid ${t.border};padding-bottom:14px">${esc(slide.heading)}</h2>` : ''}
  <div style="display:flex;justify-content:center;gap:48px;flex-wrap:wrap;margin-top:24px">
    ${(slide.stats || []).map(s => `<div style="min-width:120px">
      <div style="font-size:2.6em;font-weight:800;color:${t.accent};line-height:1.1">${esc(s.value || '')}</div>
      <div style="font-size:0.65em;color:${t.muted};margin-top:8px">${esc(s.label || '')}</div>
    </div>`).join('\n    ')}
  </div>
  ${note}
</section>`;

      case 'timeline':
        return `<section ${bgAttr}>
  ${slide.heading ? `<h2 style="font-size:1.5em;font-weight:700;color:${t.text};border-bottom:1px solid ${t.border};padding-bottom:14px">${esc(slide.heading)}</h2>` : ''}
  <div style="display:flex;gap:12px;margin-top:24px;align-items:flex-start">
    ${(slide.steps || []).map((s, i) => `<div style="flex:1;text-align:center">
      <div style="width:32px;height:32px;border-radius:50%;background:${t.accent};color:#fff;font-size:0.65em;font-weight:700;display:inline-flex;align-items:center;justify-content:center">${i + 1}</div>
      <div style="font-size:0.6em;font-weight:700;color:${t.accent};text-transform:uppercase;margin-top:10px">${esc(s.label || '')}</div>
      <div style="font-size:0.65em;color:${t.ts};margin-top:6px;line-height:1.4">${esc(s.text || '')}</div>
    </div>`).join('\n    ')}
  </div>
  ${note}
</section>`;

      case 'columns':
        return `<section ${bgAttr}>
  ${slide.heading ? `<h2 style="font-size:1.5em;font-weight:700;color:${t.text};border-bottom:1px solid ${t.border};padding-bottom:14px">${esc(slide.heading)}</h2>` : ''}
  <div style="display:flex;gap:40px;margin-top:20px;text-align:left">
    ${[slide.left, slide.right].filter(Boolean).map(col => `<div style="flex:1">
      ${col.heading ? `<h4 style="font-size:0.65em;font-weight:700;color:${t.accent};text-transform:uppercase;letter-spacing:0.6px;margin-bottom:12px">${esc(col.heading)}</h4>` : ''}
      <p style="font-size:0.75em;color:${t.ts};line-height:1.55">${esc(col.text || '')}</p>
    </div>`).join('\n    ')}
  </div>
  ${note}
</section>`;

      default:
        return `<section ${bgAttr}><p>Unknown type: ${esc(type)}</p>${note}</section>`;
    }
  }).join('\n\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(meta.title || 'Presentation')}</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/reveal.js/5.1.0/reveal.min.css">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/reveal.js/5.1.0/theme/black.min.css">
<style>
  :root { --r-background-color: ${t.bg}; }
  .reveal { font-family: 'Avenir Next', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  .reveal .slides section { text-align: center; }
  .reveal .progress { color: ${t.accent}; height: 3px; }
  .reveal .controls { color: ${t.accent}; }
  .reveal .slide-number { color: ${t.dim}; font-size: 0.55em; }
  .reveal pre { box-shadow: none; width: 100%; }
  .reveal pre code { max-height: 500px; }
</style>
</head>
<body>
<div class="reveal">
<div class="slides">

${slideSections}

</div>
</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/reveal.js/5.1.0/reveal.min.js"><\/script>
<script>
Reveal.initialize({
  hash: true,
  slideNumber: 'c/t',
  progress: true,
  controls: true,
  transition: 'slide',
  transitionSpeed: 'default',
  center: true,
  touch: true,
  width: 960,
  height: 540,
  margin: 0.08,
});
<\/script>
</body>
</html>`;
}

/* ── Export Reveal.js HTML ────────────────────────────────────────────── */

export function exportReveal() {
  if (!state.slides.length) { showToast('Load a presentation first'); return; }
  const html = buildRevealHTML(state.meta, state.slides, state.currentTheme);
  download(html, `${slug(state.meta)}.html`, 'text/html');
  showToast('Reveal.js HTML exported!');
}

/* ── Export ZIP bundle (for GitHub Pages) ─────────────────────────────── */

export async function exportBundle() {
  if (!state.slides.length) { showToast('Load a presentation first'); return; }
  if (typeof JSZip === 'undefined') { showToast('ZIP library failed to load'); return; }

  const talkSlug = slug(state.meta);
  const html = buildRevealHTML(state.meta, state.slides, state.currentTheme);

  const zip = new JSZip();
  const folder = zip.folder(talkSlug);
  folder.file('index.html', html);

  const blob = await zip.generateAsync({ type: 'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${talkSlug}.zip`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);

  addToGallery(state.meta, state.slides.length);
  showToast('Bundle exported! Unzip into your presentations repo.');
}

/* ── Gallery registry (localStorage) ─────────────────────────────────── */

function loadGallery() {
  try { return JSON.parse(localStorage.getItem(GALLERY_KEY)) || []; }
  catch { return []; }
}

function saveGallery(entries) {
  localStorage.setItem(GALLERY_KEY, JSON.stringify(entries));
}

function addToGallery(meta, slideCount) {
  const entries = loadGallery();
  const s = slug(meta);
  const existing = entries.findIndex(e => e.slug === s);
  const entry = {
    slug: s,
    title: meta.title || 'Untitled',
    subtitle: meta.subtitle || '',
    date: meta.date || new Date().toISOString().slice(0, 7),
    slideCount,
  };
  if (existing >= 0) entries[existing] = entry;
  else entries.unshift(entry);
  saveGallery(entries);
}

function removeFromGallery(gallerySlug) {
  const entries = loadGallery().filter(e => e.slug !== gallerySlug);
  saveGallery(entries);
}

/* ── Gallery overlay UI ──────────────────────────────────────────────── */

export function openGallery() {
  const overlay = document.getElementById('gallery-overlay');
  overlay.classList.add('active');
  renderGalleryList();
}

export function closeGallery() {
  document.getElementById('gallery-overlay').classList.remove('active');
}

function renderGalleryList() {
  const entries = loadGallery();
  const list = document.getElementById('gallery-list');

  if (!entries.length) {
    list.innerHTML = `<div class="gallery-empty">No presentations published yet.<br>Export a bundle to add your first talk.</div>`;
    return;
  }

  list.innerHTML = entries.map(e => `
    <div class="gallery-entry" data-slug="${esc(e.slug)}">
      <div class="gallery-entry-info">
        <div class="gallery-entry-title">${esc(e.title)}</div>
        <div class="gallery-entry-meta">${esc(e.slug)}/ &middot; ${esc(e.date)} &middot; ${e.slideCount} slides</div>
      </div>
      <button class="btn btn-sm gallery-remove" onclick="removeGalleryEntry('${esc(e.slug)}')" title="Remove from gallery">&times;</button>
    </div>`).join('');
}

export function removeGalleryEntry(gallerySlug) {
  removeFromGallery(gallerySlug);
  renderGalleryList();
  showToast('Removed from gallery');
}

/* ── Gallery index.html export ───────────────────────────────────────── */

export function exportGalleryIndex() {
  const entries = loadGallery();
  if (!entries.length) { showToast('No presentations in gallery'); return; }

  const baseUrl = document.getElementById('gallery-base-url')?.value.trim() || '.';

  const cards = entries.map(e => `
    <a href="${baseUrl === '.' ? '' : baseUrl + '/'}${e.slug}/" class="talk-card">
      <div class="talk-title">${esc(e.title)}</div>
      ${e.subtitle ? `<div class="talk-subtitle">${esc(e.subtitle)}</div>` : ''}
      <div class="talk-meta">${esc(e.date)} &middot; ${e.slideCount} slides</div>
    </a>`).join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Presentations</title>
<style>
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Avenir Next',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#040714;color:#f9f9f9;min-height:100vh;padding:0}
.header{background:linear-gradient(135deg,#B015B0 0%,#3D0080 45%,#080010 100%);padding:28px 32px;border-bottom:1px solid rgba(255,255,255,.07)}
.header h1{font-size:1.6em;font-weight:700;letter-spacing:0.5px}
.header p{font-size:0.85em;color:rgba(255,255,255,.55);margin-top:6px}
.grid{max-width:960px;margin:0 auto;padding:40px 24px;display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:18px}
.talk-card{display:block;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:24px;text-decoration:none;color:inherit;transition:all .2s}
.talk-card:hover{background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.18);transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,.4)}
.talk-title{font-size:1.1em;font-weight:600;color:#f9f9f9;margin-bottom:6px}
.talk-subtitle{font-size:0.82em;color:rgba(255,255,255,.5);margin-bottom:10px}
.talk-meta{font-size:0.72em;color:rgba(255,255,255,.3)}
.footer{text-align:center;padding:32px;font-size:0.72em;color:rgba(255,255,255,.2)}
.footer a{color:rgba(255,255,255,.35);text-decoration:none}
.footer a:hover{color:rgba(255,255,255,.6)}
</style>
</head>
<body>
<div class="header">
  <h1>Presentations</h1>
  <p>${entries.length} talk${entries.length !== 1 ? 's' : ''}</p>
</div>
<div class="grid">
${cards}
</div>
<div class="footer">Built with <a href="https://slides.neorgon.com/" target="_blank">Presentation Sage</a></div>
</body>
</html>`;

  download(html, 'index.html', 'text/html');
  showToast('Gallery index.html exported!');
}
