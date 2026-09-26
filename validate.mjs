#!/usr/bin/env node
// Validate slides-site decks without opening the player.
//
// This is a thin CLI over the player's own js/parser.js — parseYAML() and
// validate() — so the density rules cannot fork: the player and this script
// disagree with each other only if one of them is outdated, which is exactly
// what --fresh checks.
//
// Usage:
//   node validate.mjs deck.yaml          # one deck (in a checkout: npm i js-yaml first)
//   node validate.mjs -                  # read the deck from stdin
//   node validate.mjs <dir>              # every deck in a repository (YAML with a presentation: root)
//   node validate.mjs --fresh [target]   # is this copy of the rules current with the live site?
//   node validate.mjs --storyline <deck>  # print the headings in order, and nothing else
//
// From any other repo, the published copy works standalone:
//   curl -sO https://slides.neorgon.com/validate.mjs && node validate.mjs deck.yaml
// When js/parser.js is not next to this file it is fetched from the live site,
// and js-yaml (the same 4.3.2 build the player loads, checked against the same
// integrity hash) is fetched when not installed.
//
// Exit codes: 0 clean or info-only · 1 density warnings (or stale in --fresh) · 2 unreadable.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SITE = 'https://slides.neorgon.com';
// Keep these two equal to the js-yaml <script> in index.html. The browser
// checks the integrity attribute itself; Node does not, so the js-yaml fallback
// below does it by hand before the fetched file is ever required.
const JSYAML_CDN = 'https://cdn.jsdelivr.net/npm/js-yaml@4.3.2/dist/js-yaml.min.js';
const JSYAML_SRI = 'sha384-uwLg6oO8ZhFG2SuQfgmkMtosjtrFYlkPspa/cXS+b3D8GLRTHMDl/mTwqImdlKQO';
// The files that carry rules and features (themes, patterns, brand keys). A
// checkout whose copies differ from the live site validates against different
// rules than the player people actually present in.
const RULE_FILES = ['js/parser.js', 'js/state.js', 'CLAUDE.md', 'template.yaml'];
const here = dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const fresh = args.includes('--fresh');
const wantStoryline = args.includes('--storyline');
/* Any leading dash is a flag, so a new one never has to be added here twice.
   Filtering only the flags we knew about meant --storyline was read as a path. */
const target = args.filter((a) => !a.startsWith('--'))[0];

if (!fresh && !target) {
  console.error('usage: node validate.mjs <deck.yaml | dir | -> | --fresh [checkout-dir]');
  process.exit(2);
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.text();
}

// ── --fresh: compare this checkout's rule files against the live site ───────
if (fresh) {
  const root = target || here;
  if (!existsSync(join(root, 'js', 'parser.js'))) {
    console.log(`no local checkout at ${root}: nothing to be stale: standalone runs fetch the live rules`);
    process.exit(0);
  }
  const sha = (s) => createHash('sha256').update(s.replace(/\r\n/g, '\n')).digest('hex').slice(0, 12);
  let differs = 0;
  for (const f of RULE_FILES) {
    const local = join(root, f);
    if (!existsSync(local)) {
      console.log(`STALE  ${f.padEnd(15)} missing locally`);
      differs += 1;
      continue;
    }
    const live = await fetchText(`${SITE}/${f}`);
    const same = sha(readFileSync(local, 'utf8')) === sha(live);
    console.log(`${same ? 'ok   ' : 'DIFFERS'}  ${f}`);
    if (!same) differs += 1;
  }
  if (differs) {
    console.log(`\n${differs} file(s) differ from ${SITE}: this checkout validates against different`);
    console.log('rules (themes, patterns, density) than the live player. Pull if behind; push if ahead.');
    process.exit(1);
  }
  console.log(`\ncurrent with ${SITE}: themes, patterns, and density rules all match`);
  process.exit(0);
}

// ── js-yaml: local install first, the player's pinned CDN build second ──────
let jsyaml;
try {
  const m = await import('js-yaml');
  jsyaml = m.default || m;   // js-yaml v5's ESM build exports no default
  if (typeof jsyaml.load !== 'function') throw new Error('js-yaml has no load()');
} catch {
  const cache = join(tmpdir(), 'slides-site-validate');
  mkdirSync(cache, { recursive: true });
  /* The cache name carries the version, and the bytes are checked on every run,
     so a copy cached from an older pin (4.1.0 lived at js-yaml.cjs) or a file
     changed on disk is never required. The build is UMD: under require() it
     fills module.exports instead of setting a global. */
  const shim = join(cache, `js-yaml-${JSYAML_CDN.match(/@([\d.]+)\//)[1]}.cjs`);
  const sri = (bytes) => `sha384-${createHash('sha384').update(bytes).digest('base64')}`;
  const cached = existsSync(shim) ? readFileSync(shim) : null;
  if (!cached || sri(cached) !== JSYAML_SRI) {
    console.error(`js-yaml not installed: fetching the player's build (${JSYAML_CDN})`);
    const res = await fetch(JSYAML_CDN);
    if (!res.ok) throw new Error(`${JSYAML_CDN} -> HTTP ${res.status}`);
    const bytes = Buffer.from(await res.arrayBuffer());
    if (sri(bytes) !== JSYAML_SRI) {
      console.error(`${JSYAML_CDN} does not match its integrity hash (${JSYAML_SRI}): not running it`);
      process.exit(2);
    }
    writeFileSync(shim, bytes);
  }
  jsyaml = createRequire(import.meta.url)(shim);
}
globalThis.jsyaml = jsyaml;

// parser.js's import chain reads localStorage at module scope; stub it.
globalThis.localStorage = { getItem: () => null, setItem: () => {} };

// ── the player's parser: beside this file in a checkout, else the live site ─
let parser;
try {
  parser = await import(pathToFileURL(join(here, 'js', 'parser.js')).href);
} catch {
  console.error(`js/parser.js not found locally: fetching the player's copy from ${SITE}`);
  const cache = join(tmpdir(), 'slides-site-validate', 'js');
  mkdirSync(cache, { recursive: true });
  for (const f of ['parser.js', 'state.js']) {
    writeFileSync(join(cache, f), await fetchText(`${SITE}/js/${f}`));
  }
  parser = await import(pathToFileURL(join(cache, 'parser.js')).href);
}

// ── single-deck validation ──────────────────────────────────────────────────
const tag = { warn: 'WARN', info: 'info' };

function checkDeck(text, label) {
  const doc = parser.parseYAML(text);
  if (doc.error) {
    console.log(`${label}: unreadable deck, ${doc.error}`);
    return { unreadable: true, warns: 0 };
  }
  const findings = parser.validate(doc.slides, doc.meta);
  for (const f of findings) {
    const where = f.slide ? `slide ${f.slide}` : 'deck';
    console.log(`${tag[f.level] || f.level}  ${where.padEnd(9)} ${f.msg}`);
  }
  if (wantStoryline) {
    /* Printed on its own, because reading the headings in order is the test the
       flow checklist has always asked for and never showed anyone. */
    console.log(`\n  storyline of ${label}:`);
    for (const row of parser.storyline(doc.slides)) {
      console.log(`   ${String(row.n).padStart(2)}. ${row.text}`);
    }
    console.log('');
  }
  const warns = findings.filter((f) => f.level === 'warn').length;
  console.log(`${label}: ${doc.slides.length} slides, ${warns} warning(s), ${findings.length - warns} note(s)`);
  return { unreadable: false, warns };
}

// ── run: stdin, one file, or every deck under a directory ───────────────────
if (target === '-' || !statSync(target).isDirectory()) {
  const text = target === '-' ? readFileSync(0, 'utf8') : readFileSync(target, 'utf8');
  const r = checkDeck(text, target === '-' ? 'stdin' : target);
  process.exit(r.unreadable ? 2 : r.warns > 0 ? 1 : 0);
}

// Directory mode: a deck is any YAML whose root is `presentation:`. Other YAML
// (CI configs, SAM templates) is not this validator's business and is skipped.
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'vendor', '.venv', '__pycache__']);
const decks = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (!SKIP_DIRS.has(name)) walk(p);
    } else if (/\.ya?ml$/.test(name)) {
      const text = readFileSync(p, 'utf8');
      if (/^presentation:\s*$/m.test(text) || /^presentation:\s/m.test(text)) decks.push([p, text]);
    }
  }
})(target);

if (!decks.length) {
  console.log(`no decks under ${target} (a deck is YAML with a presentation: root)`);
  process.exit(0);
}

let totalWarns = 0;
let unreadable = 0;
for (const [p, text] of decks) {
  console.log(`\n── ${relative(target, p)}`);
  const r = checkDeck(text, relative(target, p));
  totalWarns += r.warns;
  unreadable += r.unreadable ? 1 : 0;
}
console.log(`\n${decks.length} deck(s): ${totalWarns} warning(s), ${unreadable} unreadable`);
/* Say what was NOT checked. These rules are density rules; whether the content
   physically fits its 960x540 box needs a layout engine, which a CLI does not
   have. The app measures it in the audit panel's Fit section. Reporting a clean
   deck without this line implies a completeness the check does not have. */
console.log('geometry not checked (no DOM): open the deck and run Audit for the measured fit.');
process.exit(unreadable ? 2 : totalWarns > 0 ? 1 : 0);
