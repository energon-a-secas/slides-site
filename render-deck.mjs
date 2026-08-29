#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   render-deck.mjs — turn a deck YAML into PPTX, PDF, HTML or Markdown
   without opening the app.

   The PPTX and Markdown come from js/serialize.js, the same module the browser
   uses, so a deck built on a server matches the one the app hands you. PDF and
   HTML are produced by Marp CLI from that Markdown.

     node render-deck.mjs deck.yaml --pptx
     node render-deck.mjs deck.yaml --pdf --html --out dist/
     node render-deck.mjs deck-library/decks --pptx --out dist/

   Dependencies, and what each one is for:
     js-yaml               parse the deck            (required)
     pptxgenjs             --pptx                    (required for PPTX)
     @marp-team/marp-cli   --pdf, --html, --marp-pptx (spawns headless Chrome)

     npm install js-yaml pptxgenjs @marp-team/marp-cli

   Everything is optional until you ask for the format that needs it: this
   script reports the missing package and the install line rather than a stack
   trace.
═══════════════════════════════════════════════════════════════════════════ */

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { dirname, join, basename, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

/* ── Argument parsing ─────────────────────────────────────────────────── */

const argv = process.argv.slice(2);
const flags = new Set(argv.filter(a => a.startsWith('--')));
const inputs = argv.filter(a => !a.startsWith('--') && !isFlagValue(a));

function isFlagValue(arg) {
  const i = argv.indexOf(arg);
  return i > 0 && (argv[i - 1] === '--out' || argv[i - 1] === '--base');
}
const outDir = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : '.';
const baseDir = argv.includes('--base') ? resolve(argv[argv.indexOf('--base') + 1]) : HERE;

if (!inputs.length || flags.has('--help')) {
  console.log(`
render-deck.mjs: build a deck without opening the app

  node render-deck.mjs <deck.yaml | directory> [more...] [formats] [--out DIR]

Formats (default --pptx):
  --pptx        PowerPoint with real text boxes, via pptxgenjs
  --pdf         PDF, via Marp CLI
  --html        self-contained HTML, via Marp CLI
  --md          Marp Markdown only, no further tooling needed
  --marp-pptx   PPTX via Marp instead (one image per slide, not editable text)

Other:
  --out DIR     where to write (default: the working directory)
  --base DIR    what a root-absolute asset path (/deck-library/...) means on
                disk (default: this script's directory, i.e. the site root)
  --quiet       only print paths written
  --help        this text

Install what you need:
  npm install js-yaml pptxgenjs @marp-team/marp-cli
`.trim());
  process.exit(inputs.length ? 0 : 1);
}

const quiet = flags.has('--quiet');
const say = (...a) => { if (!quiet) console.log(...a); };

/* ── Dependency loading, with a useful failure ────────────────────────── */

async function need(pkg, why) {
  try {
    return await import(pkg);
  } catch {
    console.error(
      `\n${pkg} is required for ${why}.\n` +
      `  npm install ${pkg}\n` +
      `(or run this script from a directory where it is installed)\n`
    );
    process.exit(2);
  }
}

/* ── Deck loading ─────────────────────────────────────────────────────── */

const { THEMES, themeWithBrand } = await import(join(HERE, 'js/state.js'));
const { deckToMarp, deckToPptx } = await import(join(HERE, 'js/serialize.js'));

async function loadDeck(file) {
  const yamlNs = await need('js-yaml', 'reading the deck');
  const yaml = yamlNs.default || yamlNs;   // js-yaml v5's ESM build exports no default
  const doc = yaml.load(await readFile(file, 'utf8'));
  if (!doc?.presentation) throw new Error(`${file}: no "presentation:" root key`);
  const p = doc.presentation;
  const meta = {
    title: p.title || 'Untitled', subtitle: p.subtitle || '',
    author: p.author || '', date: p.date || '',
    theme: p.theme || '', logo: p.logo || '', logo_all: !!p.logo_all,
    logo_pos: p.logo_pos || '', logo_size: p.logo_size || 0,
    logo_stamp_size: p.logo_stamp_size || 0,
    brand: p.brand || null, pattern: p.pattern || '',
    footer: p.footer || '', classification: p.classification || '',
  };
  const themeName = THEMES[meta.theme] ? meta.theme : 'neorgon';
  return { meta, slides: p.slides || [], theme: themeWithBrand(themeName, meta.brand) };
}


/* A deck written for the browser says `/deck-library/assets/x.svg`, meaning
   "the site root". Node reads that as the filesystem root and fails. Rewriting
   root-absolute asset paths against --base is what lets the same deck build in
   both places; http(s) and data: URIs are left alone. */
function resolveAssets(node, base) {
  if (Array.isArray(node)) return node.map(n => resolveAssets(n, base));
  if (!node || typeof node !== 'object') return node;
  const out = {};
  for (const [k, v] of Object.entries(node)) {
    if ((k === 'src' || k === 'logo') && typeof v === 'string' && v.startsWith('/')) {
      out[k] = join(base, v.slice(1));
    } else {
      out[k] = resolveAssets(v, base);
    }
  }
  return out;
}


/* SVG cannot be embedded in PPTX portably (see js/serialize.js), so it is
   rasterised first. No Node rasteriser is assumed: this shells out to whatever
   the machine already has, and returns null when it has none, which makes
   deckToPptx report the skip instead of writing a broken picture. */
function makeRasterizer(outDir) {
  const cache = new Map();
  const tools = [
    ['rsvg-convert', (i, o) => ['rsvg-convert', ['-w', '1600', '-o', o, i]]],
    ['resvg',        (i, o) => ['resvg', ['-w', '1600', i, o]]],
    ['magick',       (i, o) => ['magick', ['-density', '200', i, o]]],
    ['python3',      (i, o) => ['python3', ['-c',
      'import sys,cairosvg;cairosvg.svg2png(url=sys.argv[1],write_to=sys.argv[2],output_width=1600)', i, o]]],
  ];
  const available = tools.find(([bin]) =>
    spawnSync(bin, ['--version'], { stdio: 'ignore' }).status === 0 ||
    spawnSync('command', ['-v', bin], { shell: true, stdio: 'ignore' }).status === 0);

  return (src) => {
    if (!src || !/\.svgz?$/i.test(src)) return src;          // rasters pass through
    if (cache.has(src)) return cache.get(src);
    if (!available) { cache.set(src, null); return null; }

    const png = join(outDir, `.raster-${basename(src).replace(/\.svgz?$/i, '')}.png`);
    const [bin, argsFor] = available;
    const [cmd, args] = argsFor(src, png);
    const r = spawnSync(cmd, args, { stdio: 'ignore' });
    // cairosvg lives behind python3, which exists everywhere; a non-zero exit
    // there means the module is missing, not that the file is bad.
    const ok = r.status === 0 && existsSync(png);
    cache.set(src, ok ? png : null);
    return ok ? png : null;
  };
}

function slugOf(meta) {
  return String(meta.title || 'presentation')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'presentation';
}

/* ── Marp CLI ─────────────────────────────────────────────────────────── */

/* Marp is a binary, not a library, so it is spawned rather than imported. It
   drives headless Chrome; on a server that usually means installing Chrome or
   setting CHROME_PATH. The failure is reported rather than swallowed. */
function runMarp(args) {
  return new Promise((res, rej) => {
    const proc = spawn('npx', ['--yes', '@marp-team/marp-cli', ...args], {
      stdio: quiet ? ['ignore', 'ignore', 'pipe'] : 'inherit',
    });
    let err = '';
    proc.stderr?.on('data', d => { err += d; });
    proc.on('error', rej);
    proc.on('close', code => code === 0
      ? res()
      : rej(new Error(`marp exited ${code}${err ? `\n${err.trim()}` : ''}`)));
  });
}

/* ── Build one deck ───────────────────────────────────────────────────── */

async function build(file, out) {
  const loaded = await loadDeck(file);
  const meta = resolveAssets(loaded.meta, baseDir);
  const slides = resolveAssets(loaded.slides, baseDir);
  const theme = loaded.theme;
  const stem = slugOf(meta);
  const written = [];

  const wantMd = flags.has('--md');
  const wantMarpOut = flags.has('--pdf') || flags.has('--html') || flags.has('--marp-pptx');
  const wantPptx = flags.has('--pptx') || (!wantMd && !wantMarpOut);

  if (wantPptx) {
    const { default: PptxGenJS } = await need('pptxgenjs', 'PPTX output');
    const pptx = deckToPptx(new PptxGenJS(), meta, slides, theme, {
      resolveImage: makeRasterizer(out),
    });
    const path = join(out, `${stem}.pptx`);
    await writeFile(path, Buffer.from(await pptx.write({ outputType: 'base64' }), 'base64'));
    written.push(path);
  }

  if (wantMd || wantMarpOut) {
    const md = deckToMarp(meta, slides, theme);
    const mdPath = join(out, `${stem}.md`);
    await writeFile(mdPath, md);
    if (wantMd) written.push(mdPath);

    for (const [flag, arg, ext] of [
      ['--pdf', '--pdf', 'pdf'],
      ['--html', '--html', 'html'],
      ['--marp-pptx', '--pptx', 'pptx'],
    ]) {
      if (!flags.has(flag)) continue;
      const outPath = join(out, `${stem}${flag === '--marp-pptx' ? '-marp' : ''}.${ext}`);
      await runMarp([mdPath, arg, '--allow-local-files', '-o', outPath]);
      written.push(outPath);
    }
    // The Markdown was a means to an end unless it was asked for
    if (!wantMd) written.push(`${mdPath} (intermediate)`);
  }

  return written;
}

/* ── Main ─────────────────────────────────────────────────────────────── */

/* Every input is honoured, not just the first: silently ignoring the rest of
   an argument list is the kind of quiet failure that gets noticed only when a
   deck is missing from a build. */
const missing = inputs.filter(i => !existsSync(resolve(i)));
if (missing.length) {
  console.error(`No such file or directory: ${missing.join(', ')}`);
  process.exit(1);
}
await mkdir(outDir, { recursive: true });

const files = (await Promise.all(inputs.map(async (i) => {
  const t = resolve(i);
  return statSync(t).isDirectory()
    ? (await readdir(t))
        .filter(f => ['.yaml', '.yml'].includes(extname(f)))
        .map(f => join(t, f))
    : [t];
}))).flat();

if (!files.length) {
  console.error(`No .yaml files in ${inputs[0]}`);
  process.exit(1);
}

let failed = 0;
for (const file of files) {
  try {
    const written = await build(file, outDir);
    say(`${basename(file)}`);
    written.forEach(w => console.log(`  ${w}`));
  } catch (e) {
    failed++;
    console.error(`${basename(file)}: ${e.message}`);
  }
}

if (failed) {
  console.error(`\n${failed} of ${files.length} deck(s) failed`);
  process.exit(1);
}
