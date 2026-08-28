#!/usr/bin/env node
/* exporters.test.mjs: the round-10 slide types, checked across every export.

   Loads tests/round10-deck.yaml (process, bar/pie/line charts, orgchart, a
   timeline with dates and a milestone, speaker notes) and asserts that each
   type produces non-empty, correct output in the player markup, Marp, Reveal
   and PPTX. Losing content in one export is this project's known failure
   mode, so every assertion names the string that must survive.

   Run: node exporters.test.mjs      (needs js-yaml, pptxgenjs, jszip: all in
   this repo's node_modules). Exit 0 all passed · 1 a case failed · 2 could
   not run. The print path is asserted statically (its CSS and note markup in
   js/export.js); rendering it needs a browser, which this test does not have. */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

const yamlNs = await import('js-yaml').catch(() => null);
const yaml = yamlNs && (yamlNs.default || yamlNs);
if (!yaml?.load) { console.error('js-yaml is required: npm install js-yaml'); process.exit(2); }

// parser.js reads the global the browser gets from a <script> tag, and its
// import chain touches localStorage at module scope. Same stubs validate.mjs uses.
globalThis.jsyaml = yaml;
globalThis.localStorage = { getItem: () => null, setItem: () => {} };

const mod = (f) => import(pathToFileURL(join(HERE, f)).href);
const { parseYAML, validate } = await mod('js/parser.js');
const { themeWithBrand } = await mod('js/state.js');
const { deckToMarp, deckToPptx } = await mod('js/serialize.js');
const { htmlBlock } = await mod('js/blocks.js');
const { chartSVG } = await mod('js/charts.js');
const { buildRevealHTML } = await mod('js/publish.js');
const { inspectPptx, zipFromJSZip } = await mod('js/receipt.js');

const raw = readFileSync(join(HERE, 'tests', 'round10-deck.yaml'), 'utf8');
const { meta, slides, error } = parseYAML(raw);
const t = themeWithBrand('neorgon', null);

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}${ok || !detail ? '' : `  (${detail})`}`);
  if (!ok) failed += 1;
};
const slideOf = (type, nth = 0) => slides.filter(s => s.type === type)[nth];

console.log('── the fixture itself');
check('fixture parses', !error, error);
const warns = validate(slides, meta).filter(w => w.level === 'warn');
check('fixture passes the audit with zero warnings', warns.length === 0,
  warns.map(w => w.msg).join(' | '));

console.log('── player / standalone HTML markup (js/blocks.js)');
{
  const html = htmlBlock('process', slideOf('process'), t);
  check('process: four cards with bands', (html.match(/proc-card/g) || []).length === 4);
  check('process: the current step is marked', html.includes('is-current'));
  check('process: date and owner reach the meta line', html.includes('2026-09') && html.includes('Core team'));

  for (const [kind, needle] of [['bar', 'Polling'], ['pie', 'Retries'], ['line', 'Reads']]) {
    const s = slides.find(x => x.type === 'chart' && x.chart === kind);
    const svg = chartSVG(s, t);
    check(`chart ${kind}: SVG with the legend/label "${needle}"`, svg.startsWith('<svg') && svg.includes(needle));
    check(`chart ${kind}: the unit is stated`, svg.includes(s.unit));
  }

  const org = htmlBlock('orgchart', slideOf('orgchart'), t);
  check('orgchart: root, branches and leaves all render',
    org.includes('Dana Reyes') && org.includes('Jane Smith') && org.includes('Mia Chen'));
  check('orgchart: initials disc fallback (no src given)', org.includes('org-initials') && org.includes('DR'));
}

console.log('── Marp Markdown (deckToMarp)');
{
  const md = deckToMarp(meta, slides, t);
  check('process: steps with meta in the list', md.includes('1. **Shadow**: Mirror traffic') && md.includes('(2026-09 · Core team)'));
  check('process: current step flagged', md.includes('← current'));
  check('chart: degrades loudly to its data table', md.includes('shown as its data table in Markdown'));
  check('chart: series rows carry the numbers', md.includes('| **Polling** | 210000 | 190000 | 40000 |'));
  check('chart: the unit heads the table', md.includes('| requests/day | June | July | August |'));
  check('orgchart: nested list with roles', md.includes('- **Dana Reyes** · Director') && md.includes('    - **Alex Kim** · Data'));
  check('timeline: date in parentheses, star on the milestone', md.includes('★ **Cut over** (2026-10-06)'));
}

console.log('── Reveal.js (buildRevealHTML)');
{
  const html = buildRevealHTML(meta, slides, 'neorgon');
  check('chart: the SVG survives into Reveal', (html.match(/<svg /g) || []).length >= 3);
  check('process: cards with the owner meta', html.includes('Core team') && html.includes('Switch reads to the subscription'));
  check('orgchart: every level present', html.includes('Dana Reyes') && html.includes('Rin Sato') && html.includes('Mia Chen'));
  check('timeline: dates above the axis, star on the milestone', html.includes('2026-10-06') && html.includes('★'));
  check('speaker notes reach the aside', html.includes('The starred step is the release.'));
}

console.log('── PPTX (deckToPptx + the receipt checks on the built file)');
{
  const { default: PptxGenJS } = await import('pptxgenjs');
  const pptx = deckToPptx(new PptxGenJS(), meta, slides, t, {});
  const b64 = await pptx.write({ outputType: 'base64' });
  check('a file is produced', b64.length > 20000, `${b64.length} b64 chars`);

  const { default: JSZip } = await import('jszip');
  const z = await JSZip.loadAsync(Buffer.from(b64, 'base64'));
  const names = Object.keys(z.files);
  check('eight slides in the archive', names.filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n)).length === 8);
  check('three native chart parts (bar, pie, line)', names.filter(n => /^ppt\/charts\/chart\d*\.xml$/.test(n)).length === 3);

  const res = await inspectPptx(zipFromJSZip(z), yaml.load(raw)?.presentation, 'round10.pptx');
  const defects = res.findings.filter(f => f.level === 'warn');
  check('receipt: no defects in the file', defects.length === 0, defects.map(f => f.msg).join(' | '));
  check('receipt: every authored string reached the file', res.facts.strings > 0 && res.facts.missing === 0,
    `${res.facts.missing} of ${res.facts.strings} missing`);
  check('receipt: speaker notes carried', res.facts.notes === 5, `${res.facts.notes} notes`);
}

console.log('── print / handout path (static check: needs a browser to render)');
{
  const src = readFileSync(join(HERE, 'js', 'export.js'), 'utf8');
  check('standalone HTML export carries an @media print block', src.includes('@media print'));
  check('each printed page gets its speaker note', src.includes('print-note') && src.includes('page-break-after:always'));
}

console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
