#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   check-exports.mjs — verify what an export actually contains.

   `validate.mjs` checks the deck. This checks the FILE, because every defect
   that survived longest in this project was invisible from the browser: a
   PowerPoint canvas 33% too wide, images that were SVG bytes with a .png name,
   speaker notes written to a notes part that held only a page number, and the
   author's home directory in the alt-text field.

   None of those needed a layout engine to catch. They needed someone to open
   the zip.

     node check-exports.mjs deck.yaml            # build to a temp dir, then check
     node check-exports.mjs --built dist/        # check files that already exist
     node check-exports.mjs deck-library/decks   # every deck

   Exit 0 clean · 1 findings · 2 could not run.
═══════════════════════════════════════════════════════════════════════════ */

import { readFile, readdir, mkdtemp, mkdir, rm } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, basename, extname, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const prebuilt = argv.includes('--built');
const inputs = argv.filter(a => !a.startsWith('--'));

if (!inputs.length || argv.includes('--help')) {
  console.log(`node check-exports.mjs <deck.yaml | dir>      build, then check
node check-exports.mjs --built <dir>          check existing exports
Exit 0 clean · 1 findings · 2 could not run.`);
  process.exit(argv.includes('--help') ? 0 : 2);
}

/* Severity matches validate.mjs so the two tools read the same way in CI:
   a `warn` is a defect in the file, an `info` is an observation about the
   layout that a human should judge. Exit 0 covers clean or info-only. */
const findings = [];
const note = (file, msg) => findings.push({ file, msg, level: 'warn' });
const observe = (file, msg) => findings.push({ file, msg, level: 'info' });

/* ── The zip, read without a zip library ──────────────────────────────────
   `unzip` ships on macOS and every Linux CI image, and shelling out keeps this
   script dependency-free like the rest of the repo. */
function unzipList(pptx) {
  const r = spawnSync('unzip', ['-l', pptx], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout : '';
}
function unzipRead(pptx, member) {
  const r = spawnSync('unzip', ['-p', pptx, member], { encoding: 'latin1' });
  return r.status === 0 ? r.stdout : '';
}

/* ── Check 2: the bytes are what the extension claims, and nothing personal ── */
function checkZipSanity(pptx) {
  const name = basename(pptx);
  const listing = unzipList(pptx);

  for (const m of listing.matchAll(/(ppt\/media\/\S+\.(png|jpg|jpeg|svg))/g)) {
    const member = m[1];
    const head = unzipRead(pptx, member).slice(0, 8);
    const isPng = head.startsWith('\x89PNG');
    const isJpg = head.charCodeAt(0) === 0xff && head.charCodeAt(1) === 0xd8;
    const isSvg = /^\s*<(\?xml|svg)/.test(head);
    const ext = member.split('.').pop().toLowerCase();
    if (ext === 'png' && !isPng) note(name, `${member} is not a PNG (starts "${head.trim().slice(0, 12)}"). PowerPoint 2013, Keynote, LibreOffice and Google Slides will draw a broken image.`);
    if ((ext === 'jpg' || ext === 'jpeg') && !isJpg) note(name, `${member} is not a JPEG.`);
    if (ext === 'svg' && !isSvg) note(name, `${member} is not an SVG.`);
  }

  // Anything that identifies the machine the deck was built on
  const slideXml = listing.match(/ppt\/slides\/slide\d+\.xml/g) || [];
  for (const member of slideXml) {
    const xml = unzipRead(pptx, member);
    const leak = xml.match(/(\/Users\/[^"<\s]+|\/home\/[^"<\s]+|[A-Z]:\\\\[^"<\s]+)/);
    if (leak) note(name, `${member} contains a local filesystem path: ${leak[1].slice(0, 60)}. It discloses the author's machine and is not portable.`);
  }
}

/* ── Check 1: no string left behind ───────────────────────────────────────
   The generalisation that catches an entire class: if the author typed it, the
   export should contain it. Cheap, and it does not need to know what a matrix
   is to notice that a matrix lost its row labels. */
function deckStrings(node, out = []) {
  if (typeof node === 'string') {
    const t = node.trim();
    // Skip paths, URLs and anything too short to be distinctive
    if (t.length >= 4 && !/^[.\/]|^https?:|^data:|^#[0-9a-f]{3,8}$/i.test(t)) out.push(t);
  } else if (Array.isArray(node)) {
    node.forEach(n => deckStrings(n, out));
  } else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      /* Configuration, not content: these name a renderer, a file or a knob,
         and none of them should be echoed as text in the export. */
      if (k.startsWith('logo')) continue;
      if (['type', 'src', 'background', 'pattern', 'theme', 'language',
           'fit', 'side', 'style', 'state', 'align', 'classification',
           /* deck metadata: recorded for the audit, never rendered on a slide */
           'audience', 'outcome', 'duration', 'big_idea'].includes(k)) continue;
      deckStrings(v, out);
    }
  }
  return out;
}

function checkStringsPresent(deck, pptx, mdPath) {
  const name = basename(pptx || mdPath);
  const wanted = [...new Set(deckStrings(deck))];

  const haystacks = [];
  if (pptx && existsSync(pptx)) {
    const listing = unzipList(pptx);
    for (const member of [...(listing.match(/ppt\/slides\/slide\d+\.xml/g) || []),
                          ...(listing.match(/ppt\/notesSlides\/notesSlide\d+\.xml/g) || [])]) {
      haystacks.push(unzipRead(pptx, member));
    }
  }
  const hay = haystacks.join('\n');
  if (!hay) return;

  // XML escapes and splits runs, so compare on letters and digits only
  const flat = (s) => s.replace(/&[a-z]+;/g, ' ').replace(/[^a-z0-9]/gi, '').toLowerCase();
  const flatHay = flat(hay);

  /* `yes` / `no` / `partial` are a matrix vocabulary that renders as ✓ ✕ –,
     so the literal word is absent by design. */
  const GLYPH_WORDS = new Set(['yes', 'no', 'partial', 'true', 'false']);
  const missing = wanted.filter(w =>
    w.length >= 6 && !GLYPH_WORDS.has(w.toLowerCase()) && !flatHay.includes(flat(w)));
  if (missing.length) {
    const shown = missing.slice(0, 6).map(m => `"${m.slice(0, 48)}"`).join(', ');
    note(name, `${missing.length} authored string(s) never reach the PPTX: ${shown}${missing.length > 6 ? ' …' : ''}`);
  }
}

/* ── Check 3: box arithmetic ─────────────────────────────────────────────── */
const EMU = 914400;
function checkBoxes(pptx) {
  const name = basename(pptx);
  const listing = unzipList(pptx);
  const pres = unzipRead(pptx, 'ppt/presentation.xml');
  const size = pres.match(/sldSz\s+cx="(\d+)"\s+cy="(\d+)"/);
  if (!size) return;
  const pageW = +size[1] / EMU, pageH = +size[2] / EMU;

  const sparse = [];
  const overlaps = [];
  for (const member of listing.match(/ppt\/slides\/slide\d+\.xml/g) || []) {
    const xml = unzipRead(pptx, member);
    /* Per shape, so a box can be told apart from the text drawn on top of it.
       Text centred on an ellipse or a card is the normal way to label a shape;
       only two TEXT runs sharing a band is a defect. */
    const boxes = [];
    for (const sp of xml.matchAll(/<p:(sp|pic)>([\s\S]*?)<\/p:\1>/g)) {
      const inner = sp[2];
      const off = inner.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/>/);
      if (!off) continue;
      boxes.push({
        x: +off[1] / EMU, y: +off[2] / EMU, w: +off[3] / EMU, h: +off[4] / EMU,
        hasText: /<a:t>[^<]/.test(inner),
        isPic: sp[1] === 'pic',
      });
    }
    if (!boxes.length) continue;

    for (const b of boxes) {
      const right = b.x + b.w, bottom = b.y + b.h;
      if (b.x < -0.01 || b.y < -0.01 || right > pageW + 0.01 || bottom > pageH + 0.01) {
        note(name, `${member}: a shape runs off the page (${b.x.toFixed(2)},${b.y.toFixed(2)} ${b.w.toFixed(2)}x${b.h.toFixed(2)} on ${pageW}x${pageH}in).`);
        break;
      }
    }

    /* Text boxes that sit on top of each other. The caption band and the footer
       rail overlapped by 0.15in across five slides and nothing noticed, because
       nothing was looking for a collision. */
    for (let a = 0; a < boxes.length; a++) {
      for (let b = a + 1; b < boxes.length; b++) {
        const A = boxes[a], B = boxes[b];
        // Only two pieces of text colliding; text over a shape is deliberate.
        if (!A.hasText || !B.hasText) continue;
        const ox = Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x);
        const oy = Math.min(A.y + A.h, B.y + B.h) - Math.max(A.y, B.y);
        if (ox > 0.05 && oy > 0.05) {
          overlaps.push(`${member.match(/slide(\d+)/)[1]} (${oy.toFixed(2)}in)`);
          a = boxes.length;   // one report per slide is enough
          break;
        }
      }
    }

    // How much of the page the content actually uses. A deck that stops
    // two-thirds up reads as unfinished rather than spacious.
    const content = boxes.filter(b => b.y + b.h < pageH - 0.35);   // exclude the rail band
    if (content.length > 2) {
      const maxBottom = Math.max(...content.map(b => b.y + b.h));
      if (maxBottom < pageH * 0.70) sparse.push(member.match(/slide(\d+)/)[1]);
    }
  }
  if (overlaps.length) {
    note(name, `text boxes overlap on slide(s) ${overlaps.join(', ')}. Two runs printed on the same band read as one smudged line.`);
  }
  if (sparse.length) {
    observe(name, `${sparse.length} slide(s) use less than 70% of the page height (${sparse.join(', ')}). Layouts are top-anchored at a fixed pitch, so a slide with fewer items than the maximum leaves the rest blank.`);
  }
}

/* ── Check 4: the theme's own colour hierarchy, before any file exists ───── */
async function checkThemeOrder() {
  const { THEMES } = await import(join(HERE, 'js/state.js'));
  const lum = (css, bg) => {
    const rgb = (c) => {
      const s = String(c);
      if (s.startsWith('#')) {
        const h = s.slice(1).length === 3 ? s.slice(1).split('').map(x => x + x).join('') : s.slice(1, 7);
        return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
      }
      const m = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
      return m ? [+m[1], +m[2], +m[3]] : null;
    };
    const a = (String(css).match(/rgba\([^)]*,\s*([\d.]+)\s*\)/) || [, '1'])[1];
    const c = rgb(css), b = rgb(bg);
    if (!c || !b) return null;
    const comp = c.map((v, i) => v * +a + b[i] * (1 - +a));
    const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(comp[0]) + 0.7152 * f(comp[1]) + 0.0722 * f(comp[2]);
  };
  const ratio = (fg, bg) => {
    const l1 = lum(fg, bg), l2 = lum(bg, bg);
    if (l1 === null || l2 === null) return null;
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };

  for (const [name, t] of Object.entries(THEMES)) {
    const r = (k) => ratio(t[k], t.bg);
    const [dim, muted, body, text] = ['dim', 'muted', 'ts', 'text'].map(r);
    if ([dim, muted, body, text].some(v => v === null)) continue;
    if (!(dim < muted && muted < body && body <= text + 0.01)) {
      note(`theme:${name}`, `colour hierarchy is out of order: dim ${dim.toFixed(1)} · muted ${muted.toFixed(1)} · body ${body.toFixed(1)} · text ${text.toFixed(1)} (each should exceed the one before it).`);
    }
  }
}

/* ── Run ─────────────────────────────────────────────────────────────────── */

async function decksFrom(paths) {
  const out = [];
  for (const p of paths) {
    const t = resolve(p);
    if (!existsSync(t)) { console.error(`no such path: ${p}`); process.exit(2); }
    if (statSync(t).isDirectory()) {
      for (const f of await readdir(t)) {
        if (['.yaml', '.yml'].includes(extname(f))) out.push(join(t, f));
      }
    } else out.push(t);
  }
  return out;
}

let tmp = null;
try {
  await checkThemeOrder();

  if (prebuilt) {
    const dir = resolve(inputs[0]);
    for (const f of await readdir(dir)) {
      if (f.endsWith('.pptx')) { checkZipSanity(join(dir, f)); checkBoxes(join(dir, f)); }
    }
  } else {
    const { default: yaml } = await import('js-yaml').catch(() => ({ default: null }));
    if (!yaml) { console.error('js-yaml is required to build decks for checking.\n  npm install js-yaml'); process.exit(2); }

    tmp = await mkdtemp(join(tmpdir(), 'deck-check-'));
    let n = 0;
    for (const deckPath of await decksFrom(inputs)) {
      /* One directory per deck. Building them all into a shared directory and
         picking the newest file checked each deck against whichever export
         happened to sort last, which reported entire decks as having lost
         their own titles. */
      const out = join(tmp, `deck-${n++}`);
      await mkdir(out, { recursive: true });
      const built = spawnSync('node', [join(HERE, 'render-deck.mjs'), deckPath, '--pptx', '--out', out, '--quiet'],
        { encoding: 'utf8' });
      if (built.status !== 0) { note(basename(deckPath), `render-deck.mjs failed: ${(built.stderr || '').trim().split('\n').pop()}`); continue; }

      const doc = yaml.load(await readFile(deckPath, 'utf8'));
      const files = (await readdir(out)).filter(f => f.endsWith('.pptx'));
      if (!files.length) { note(basename(deckPath), 'no .pptx was produced'); continue; }
      const pptx = join(out, files[0]);
      checkZipSanity(pptx);
      checkBoxes(pptx);
      checkStringsPresent(doc?.presentation, pptx, null);
    }
  }
} finally {
  if (tmp) await rm(tmp, { recursive: true, force: true });
}

if (!findings.length) {
  console.log('exports clean');
  process.exit(0);
}
const byFile = findings.reduce((m, f) => ((m[f.file] ??= []).push(f), m), {});
for (const [file, list] of Object.entries(byFile)) {
  console.log(`\n── ${file}`);
  list.forEach(f => console.log(`   ${f.level.padEnd(5)} ${f.msg}`));
}
const warns = findings.filter(f => f.level === 'warn').length;
console.log(`\n${warns} defect(s) · ${findings.length - warns} observation(s)`);
process.exit(warns ? 1 : 0);
