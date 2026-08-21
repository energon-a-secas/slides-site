#!/usr/bin/env node
/* markdown-import.test.mjs: the Markdown importer, checked end to end.

   Converts sample Marp/CommonMark into decks, asserts the slide types, dumps
   each to YAML and runs it through validate.mjs, so a conversion that produces
   an unreadable or warning-laden deck fails here rather than in someone's
   browser. Run: node markdown-import.test.mjs   (needs js-yaml installed)
   Exit 0 all passed · 1 a case failed · 2 could not run. */
import { markdownToDeck } from './js/markdown-import.js';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const yamlNs = await import('js-yaml').catch(() => null);
const yaml = yamlNs && (yamlNs.default || yamlNs);
if (!yaml?.dump) { console.error('js-yaml is required: npm install js-yaml'); process.exit(2); }

const cases = [
  { name: 'front matter + title + bullets + code', md: `---
title: Event-Driven Ingest
author: Platform
---
# Event-Driven Ingest
Replacing the polling loop

---
## Why change

- Polling costs more than it looks
- The queue is already there

---
## The shape
\`\`\`js
queue.on('message', handle)
\`\`\`
`, want: ['title', 'bullets', 'code'] },
  { name: 'quote + table + image', md: `## A principle
> Simple things should be simple -- Alan Kay

---
## Options
| Option | Cost | Risk |
|---|---|---|
| Keep | $0 | High |
| Rebuild | $40k | Low |

---
## The dashboard
![latency over time](/img/latency.png)
Delivery latency held under a second
`, want: ['quote', 'table', 'image'] },
];

let failed = 0;
const tmp = mkdtempSync(join(tmpdir(), 'md-import-'));
for (const c of cases) {
  const { deck, warnings } = markdownToDeck(c.md);
  const got = deck.presentation.slides.map(s => s.type);
  const typesOk = JSON.stringify(got) === JSON.stringify(c.want);
  const f = join(tmp, 'deck.yaml');
  writeFileSync(f, yaml.dump(deck));
  const v = spawnSync('node', [join(HERE, 'validate.mjs'), f], { encoding: 'utf8' });
  const validates = v.status === 0;
  const ok = typesOk && validates;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.name}`);
  if (!typesOk) console.log(`      types: got [${got}] want [${c.want}]`);
  if (!validates) console.log(`      validate.mjs exit ${v.status}: ${(v.stdout || v.stderr).trim().split('\n')[0]}`);
  if (warnings.length) console.log(`      warnings: ${warnings.join(' | ')}`);
}
rmSync(tmp, { recursive: true, force: true });
console.log(`\n${cases.length - failed}/${cases.length} passed`);
process.exit(failed ? 1 : 0);
