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
import { inspectPptx } from './js/receipt.js';

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

/* ── Checks 1 to 3 live in js/receipt.js, shared with the browser ───────────
   The app shows them as a receipt when a visitor exports PPTX; this CLI runs
   the same functions over `unzip`, so the two cannot disagree. Only the zip
   adapter differs. */
function zipOf(pptx) {
  const listing = unzipList(pptx);
  const names = listing.split('\n').map(l => l.trim())
    .filter(l => /^\d+\s+\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2}\s+\S/.test(l))
    .map(l => l.split(/\s+/).slice(3).join(' '));
  return {
    names: () => names,
    text: async (m) => unzipRead(pptx, m),
    head: async (m, n) => unzipRead(pptx, m).slice(0, n),
  };
}
async function checkFile(pptx, deck) {
  const r = await inspectPptx(zipOf(pptx), deck, basename(pptx));
  findings.push(...r.findings);
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
      if (f.endsWith('.pptx')) await checkFile(join(dir, f), null);
    }
  } else {
    const yamlNs = await import('js-yaml').catch(() => null);
    const yaml = yamlNs && (yamlNs.default || yamlNs);   // js-yaml's ESM build has no default export
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
      await checkFile(pptx, doc?.presentation);
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
