#!/usr/bin/env node
// Validate a slides-site deck without opening the player.
//
// This is a thin CLI over the player's own js/parser.js — parseYAML() and
// validate() — so the density rules cannot fork: the player and this script
// disagree with each other only if one of them is outdated, never by design.
//
// Usage:
//   node validate.mjs deck.yaml          # in a checkout: npm i js-yaml first
//   node validate.mjs -                  # read the deck from stdin
//
// From any other repo, the published copy works standalone:
//   curl -sO https://slides.neorgon.com/validate.mjs && node validate.mjs deck.yaml
// When js/parser.js is not next to this file it is fetched from the live site,
// and js-yaml (the same 4.1.0 the player loads) is fetched when not installed.
//
// Exit codes: 0 clean or info-only · 1 density warnings · 2 unreadable deck.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SITE = 'https://slides.neorgon.com';
const JSYAML_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/js-yaml/4.1.0/js-yaml.min.js';
const here = dirname(fileURLToPath(import.meta.url));

const arg = process.argv[2];
if (!arg) {
  console.error('usage: node validate.mjs <deck.yaml | ->');
  process.exit(2);
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.text();
}

// ── js-yaml: local install first, the player's pinned CDN build second ──────
let jsyaml;
try {
  jsyaml = (await import('js-yaml')).default;
} catch {
  const cache = join(tmpdir(), 'slides-site-validate');
  mkdirSync(cache, { recursive: true });
  const shim = join(cache, 'js-yaml.cjs');
  try {
    jsyaml = createRequire(import.meta.url)(shim);
  } catch {
    console.error(`js-yaml not installed — fetching the player's build (${JSYAML_CDN})`);
    writeFileSync(shim, await fetchText(JSYAML_CDN));
    jsyaml = createRequire(import.meta.url)(shim);
  }
}
globalThis.jsyaml = jsyaml;

// parser.js's import chain reads localStorage at module scope; stub it.
globalThis.localStorage = { getItem: () => null, setItem: () => {} };

// ── the player's parser: beside this file in a checkout, else the live site ─
let parser;
try {
  parser = await import(pathToFileURL(join(here, 'js', 'parser.js')).href);
} catch {
  console.error(`js/parser.js not found locally — fetching the player's copy from ${SITE}`);
  const cache = join(tmpdir(), 'slides-site-validate', 'js');
  mkdirSync(cache, { recursive: true });
  for (const f of ['parser.js', 'state.js']) {
    writeFileSync(join(cache, f), await fetchText(`${SITE}/js/${f}`));
  }
  parser = await import(pathToFileURL(join(cache, 'parser.js')).href);
}

// ── run ─────────────────────────────────────────────────────────────────────
const text = arg === '-' ? readFileSync(0, 'utf8') : readFileSync(arg, 'utf8');
const doc = parser.parseYAML(text);
if (doc.error) {
  console.error(`unreadable deck: ${doc.error}`);
  process.exit(2);
}

const findings = parser.validate(doc.slides, doc.meta);
const tag = { warn: 'WARN', info: 'info' };
for (const f of findings) {
  const where = f.slide ? `slide ${f.slide}` : 'deck';
  console.log(`${tag[f.level] || f.level}  ${where.padEnd(9)} ${f.msg}`);
}

const warns = findings.filter((f) => f.level === 'warn').length;
console.log(
  `\n${doc.slides.length} slides — ${warns} warning(s), ${findings.length - warns} note(s)`
);
process.exit(warns > 0 ? 1 : 0);
