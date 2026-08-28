/* ═══════════════════════════════════════════════════════════════════════════
   Catalog data: the sample slides, the one-line "when to use it" guide, the
   deck structures and the glyph strip. Static tables only, split out of
   js/catalog.js when it outgrew the 500-line rule; the widgets that render
   them stay there.
═══════════════════════════════════════════════════════════════════════════ */

import { SLIDE_SKELETONS } from './events.js';

/* One sample slide per type. Short on purpose: a preview is 200px wide, and a
   realistic amount of copy at that size is an unreadable grey block. */
export const SAMPLES = {
  title:    { type: 'title', heading: 'Deck Title', subtitle: 'One line that frames the talk' },
  bullets:  { type: 'bullets', heading: 'Heading', bullets: ['First point', 'Second point', 'Third point'] },
  split:    { type: 'split', heading: 'Comparison', left: { heading: 'Now', bullets: ['Item', 'Item'] }, right: { heading: 'Target', bullets: ['Item', 'Item'] } },
  code:     { type: 'code', heading: 'Example', language: 'python', code: 'producer.send(\n    topic="orders",\n    value=payload,\n)' },
  quote:    { type: 'quote', text: 'A short, memorable principle.', source: 'Attribution' },
  divider:  { type: 'divider', heading: 'Section Title', subtitle: 'What comes next' },
  qa:       { type: 'qa', heading: 'Questions?', subtext: 'A planned pause' },
  cta:      { type: 'cta', heading: 'Next Steps', action: 'The one thing to do', subtext: 'Where to find it' },
  image:    { type: 'image', heading: 'A screenshot', alt: 'Image placeholder', caption: 'Optional caption' },
  stats:    { type: 'stats', heading: 'Key Metrics', stats: [{ value: '42%', label: 'Lower cost' }, { value: '3x', label: 'Faster' }] },
  timeline: { type: 'timeline', heading: 'Roadmap', steps: [{ label: 'Phase 1', text: 'Shadow', date: '2026-09' }, { label: 'Phase 2', text: 'Cut over', date: '2026-10', mark: true }, { label: 'Phase 3', text: 'Remove', date: '2026-11' }] },
  process:  { type: 'process', heading: 'Rollout', steps: [{ label: 'Shadow', text: 'Mirror traffic', date: '2026-09', owner: 'Core' }, { label: 'Cut over', text: 'Switch reads', date: '2026-10', owner: 'Core', current: true }, { label: 'Remove', text: 'Delete the loop', date: '2026-11', owner: 'Infra' }] },
  chart:    { type: 'chart', heading: 'Requests per day', chart: 'bar', unit: 'req/day', labels: ['Q1', 'Q2', 'Q3'], series: [{ name: 'API', values: [120, 180, 240] }, { name: 'Web', values: [80, 90, 140] }] },
  columns:  { type: 'columns', heading: 'Two Perspectives', left: { heading: 'Left', text: 'A paragraph of free text.' }, right: { heading: 'Right', text: 'A paragraph of free text.' } },
  agenda:   { type: 'agenda', heading: 'Agenda', items: ['Where the time goes', 'What it costs', 'What we recommend'], current: 1 },
  table:    { type: 'table', heading: 'Options', columns: ['Option', 'Cost', 'Risk'], align: ['left', 'right', 'center'], highlight: 2, rows: [['Keep as is', '$0', 'High'], ['Rebuild', '$40k', 'Low']] },
  grid:     { type: 'grid', heading: 'Three Points', columns: 3, items: [{ icon: '◆', heading: 'First', text: 'What it means' }, { icon: '▲', heading: 'Second', text: 'What it means' }, { icon: '●', heading: 'Third', text: 'What it means' }] },
  media:    { type: 'media', heading: 'What you see', alt: 'Screenshot', side: 'right', bullets: ['Point at the change', 'Say why it matters'] },
  matrix:   { type: 'matrix', heading: 'Which option', columns: ['Keep', 'Rebuild', 'Patch'], highlight: 2, rows: [{ label: 'Runs offline', cells: ['no', 'yes', 'partial'] }, { label: 'Cost', cells: ['$0', '$40k', '$8k'] }] },
  people:   { type: 'people', heading: 'The team', columns: 3, people: [{ name: 'Jane Smith', role: 'Platform lead' }, { name: 'Alex Kim', role: 'Data' }, { name: 'Sam Ortiz', role: 'Design' }] },
  orgchart: { type: 'orgchart', heading: 'Who owns what', root: { name: 'Dana Reyes', role: 'Director', reports: [{ name: 'Jane Smith', role: 'Platform lead', reports: [{ name: 'Alex Kim', role: 'Data' }] }, { name: 'Sam Ortiz', role: 'Design' }] } },
  checklist:{ type: 'checklist', heading: 'Launch readiness', items: [{ label: 'Runbook written', state: 'done' }, { label: 'Load test', state: 'doing' }, { label: 'Vendor sign-off', state: 'blocked' }] },
  compare:  { type: 'compare', heading: 'Before and after', before: { alt: 'Old screen' }, after: { alt: 'New screen' } },
  appendix: { type: 'appendix', heading: 'Backup Slides', subtitle: 'Answers held in reserve' },
};

export const WHEN = {
  title: 'First slide only',
  bullets: '2 to 5 parallel points',
  split: 'Two things, side by side',
  code: 'A focused snippet, 15 lines or fewer',
  quote: 'A principle or a striking line',
  divider: 'A section break',
  qa: 'A planned pause, every 4 to 5 slides',
  cta: 'The last slide: one action',
  image: 'A screenshot, diagram, or photo',
  stats: 'Up to 4 numbers that carry the argument',
  timeline: 'A sequence: roadmap, phases, milestones',
  process: 'Steps with detail: what, when, whose',
  chart: 'Bar, pie or line, drawn from your data',
  columns: 'Two columns of prose, not bullets',
  agenda: 'What the talk covers, ideally auto from dividers',
  table: 'A small comparison read across',
  grid: '2 to 4 points that are not a sequence',
  media: 'A screenshot needing a few lines beside it',
  matrix: 'Which option wins, scanned down a column',
  people: 'Introducing a team, with or without headshots',
  orgchart: 'Who reports to whom, up to 3 levels',
  checklist: 'Status: done, doing, blocked, to do',
  compare: 'Two images sharing one frame',
  appendix: 'Ends the talk; what follows is backup',
};

/* ── Deck skeletons: whole talk shapes ─────────────────────────────────── */

/* The three flows CLAUDE.md already prescribes, plus the update shape, built
   out of the same skeletons the type cards insert, so a change to a type
   reaches the structures too. */
export const STRUCTURES = {
  'Technical proposal': {
    when: 'Convincing engineers to change something',
    types: ['title', 'agenda', 'bullets', 'split', 'code', 'table', 'qa', 'timeline', 'cta'],
  },
  'Stakeholder pitch': {
    when: 'Asking for a decision or a budget',
    types: ['title', 'agenda', 'bullets', 'stats', 'grid', 'quote', 'qa', 'cta'],
  },
  'Tutorial / walkthrough': {
    when: 'Teaching something hands on',
    types: ['title', 'agenda', 'divider', 'grid', 'code', 'image', 'qa', 'checklist', 'cta'],
  },
  'Status update': {
    when: 'A recurring report to a room that was not there',
    types: ['title', 'agenda', 'stats', 'checklist', 'divider', 'people', 'qa', 'cta'],
  },
};

export function structureYAML(name) {
  const def = STRUCTURES[name];
  const head = [
    'presentation:',
    `  title: "${name}"`,
    '  subtitle: "One line that frames the talk"',
    '  author: "Your Name"',
    '',
    '  slides:',
  ].join('\n');
  return head + def.types.map(t => (SLIDE_SKELETONS[t] || '')).join('') + '\n';
}

/* ── Glyphs for grid icons ─────────────────────────────────────────────── */

export const GLYPHS = ['◆', '▲', '●', '■', '★', '✦', '➜', '⚑', '⌘', '⚙', '◐', '✓', '✕', '⚠', '∞', '⏱'];
