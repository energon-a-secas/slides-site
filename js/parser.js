/* ═══════════════════════════════════════════════════════════════════════════
   YAML parsing + slide validation (coaching)
═══════════════════════════════════════════════════════════════════════════ */

import { THEMES, PATTERNS, BG_PRESETS, resolveBg } from './state.js';

/** Parse raw YAML text into { meta, slides } or { error } */
export function parseYAML(text) {
  try {
    // jsyaml is loaded globally via CDN <script> tag
    const doc = jsyaml.load(text);
    if (!doc || !doc.presentation)
      return { error: 'Root key "presentation:" not found' };
    const p = doc.presentation;
    return {
      meta: {
        title:    p.title    || 'Untitled',
        subtitle: p.subtitle || '',
        author:   p.author   || '',
        date:     p.date     || '',
        theme:    p.theme    || '',
        logo:     p.logo     || '',
        logo_all: !!p.logo_all,
        logo_pos: p.logo_pos || '',
        logo_size: p.logo_size || 0,
        logo_stamp_size: p.logo_stamp_size || 0,
        brand:    p.brand    || null,
        pattern:  p.pattern  || '',
        footer:   p.footer   || '',
        classification: p.classification || '',
        audience: p.audience || '',
        room:     p.room     || '',
        big_idea: p.big_idea || '',
        outcome:  p.outcome  || '',
        duration: p.duration || 0,
      },
      slides: p.slides || [],
    };
  } catch (e) {
    return { error: e.message };
  }
}

/** WCAG relative luminance of a #rgb/#rrggbb color; null when not hex. */
/* Channels of a CSS colour, plus its alpha. Returns null for anything that is
   not a hex or rgb(a) literal, because a named colour or a gradient cannot be
   measured without a renderer. */
function parseColor(color) {
  const s = String(color).trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].split('').map(c => c + c).join('') : hex[1];
    return { rgb: [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)), a: 1 };
  }
  const m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:[\s,\/]+([\d.]+))?\s*\)$/i.exec(s);
  if (m) return { rgb: [+m[1], +m[2], +m[3]], a: m[4] === undefined ? 1 : parseFloat(m[4]) };
  return null;
}

/* WCAG relative luminance. A translucent colour is composited over `over`
   first: this function used to return null for any rgba() string, which is why
   the `muted` and `dim` theme tokens were never once measured, and why the
   claim that the curated themes pass was only ever true of `text` on `bg`. */
function relLuminance(color, over) {
  const c = parseColor(color);
  if (!c) return null;
  let rgb = c.rgb;
  if (c.a < 1) {
    const base = parseColor(over ?? '#000000');
    if (!base) return null;
    rgb = rgb.map((v, i) => v * c.a + base.rgb[i] * (1 - c.a));
  }
  const chan = (v) => {
    v /= 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * chan(rgb[0]) + 0.7152 * chan(rgb[1]) + 0.0722 * chan(rgb[2]);
}


/* Average luminance of every hex stop in a background value. Gradients have no
   single colour, and the average is what decides whether text sits on it
   readably. Returns null when nothing hex is in there to measure. */
function bgLuminance(value) {
  const hexes = String(resolveBg(value) || '').match(/#[0-9a-f]{3,6}\b/gi) || [];
  const ls = hexes.map(relLuminance).filter(l => l !== null);
  if (!ls.length) return null;
  return ls.reduce((a, b) => a + b, 0) / ls.length;
}


/* A heading either names a subject or makes a claim. Alley, Schreiber, Ramsdell
   & Muffo (2006) measured 69% vs 79% recall on facts that sat in a sentence
   headline rather than the body, p = .001, across four sections of the same
   course. Read their control honestly: the defensible claim is "a fact stated
   in the headline is recalled better than the same fact in the body", not
   "assertion headings improve slides generally". That is still what this rule
   needs.

   Two halves, deliberately different in confidence. The stoplist is exact and
   worth naming per slide. The verb test is a heuristic with no POS tagger
   behind it, so it only feeds an aggregate count and never accuses one slide. */
const TOPIC_LABELS = new Set([
  'agenda', 'overview', 'background', 'problem', 'the problem', 'solution',
  'the solution', 'timeline', 'rollout', 'actions', 'action items', 'results',
  'next steps', 'next step', 'the ask', 'ask', 'blockers', 'today', 'yesterday',
  'setup', 'summary', 'conclusion', 'conclusions', 'context', 'impact', 'goals',
  'objectives', 'scope', 'risks', 'demo', 'introduction', 'about us', 'our team',
]);

/* Deliberately generous, because a false "this is a label" on a genuinely good
   heading is the expensive error: it teaches the author to ignore the rule.
   Past tense and imperatives count, so "Spend fell 31%" and "Approve the
   consolidation" both read as claims. */
const FINITE_VERB = /\b(is|are|was|were|be|been|has|have|had|will|can|cannot|do|does|did|should|must|may|might)\b/i;
const VERBY = /\w+(s|ed|ing)\b/i;


/* The storyline: every heading in order, nothing else. The flow checklist has
   always asked "if you printed only the headings, do they tell a coherent
   story?" and given the author no way to see it. Reading this back is also the
   fastest way to feel the difference between a label and a claim. */
export function storyline(slides) {
  const at = slides.findIndex(s => (s.type || 'bullets') === 'appendix');
  const main = at === -1 ? slides : slides.slice(0, at);
  return main.map((s, i) => {
    const type = s.type || 'bullets';
    const text = s.heading || s.text || s.action || '';
    return { n: i + 1, type, text: String(text).trim() };
  }).filter(r => r.text);
}

/** Run coaching / density checks on a parsed deck. Returns array of { level, slide, msg } */
export function validate(slides, meta) {
  const W = [];
  const add = (level, slide, msg) => W.push({ level, slide, msg });

  let hasQA  = false;
  let hasCTA = false;
  let headingCount = 0;
  let labelCount = 0;

  /* Everything after an `appendix` marker is backup material: answers held in
     reserve for questions. Those slides are allowed to be dense, and they are
     not the deck's ending, so the density and flow rules stop at the marker. */
  const appendixAt = slides.findIndex(s2 => (s2.type || 'bullets') === 'appendix');
  const inAppendix = (i) => appendixAt !== -1 && i > appendixAt;
  const mainSlides = appendixAt === -1 ? slides : slides.slice(0, appendixAt);

  slides.forEach((slide, i) => {
    const n    = i + 1;
    const type = slide.type || 'bullets';
    const dense = !inAppendix(i);   // density checks apply to the talk, not the backup

    if (type === 'qa')  hasQA  = true;
    if (type === 'cta') hasCTA = true;

    if (!slide.heading && !['quote', 'qa', 'cta', 'agenda', 'appendix'].includes(type))
      add('warn', n, 'Missing heading. Every slide needs a clear label.');

    if (type === 'bullets' && dense) {
      const bullets = slide.bullets || [];
      if (bullets.length > 5)
        add('warn', n, `${bullets.length} bullets. Aim for 5 or fewer.`);
      /* Shu & Carlson (2014), Journal of Marketing 78(1): in a persuasion
         setting three claims is the optimum and the fourth starts to raise
         scepticism. Tested on advertising claims rather than slide bullets, so
         this is an info, not a limit. */
      else if (['convince', 'approve'].includes(meta?.outcome) && bullets.length > 3)
        add('info', n, `${bullets.length} claims on a persuasion slide. Three lands harder than five.`);

      bullets.forEach((b, bi) => {
        const words = String(b).trim().split(/\s+/).filter(Boolean);
        if (words.length > 10)
          add('warn', n, `Bullet ${bi + 1}: ${words.length} words. Aim for 10 or fewer.`);
        if (words.length > 5 && String(b).trim().endsWith('.'))
          add('info', n, `Bullet ${bi + 1}: full sentence. Fragments land harder.`);
      });
    }

    if (type === 'code' && dense) {
      const lines = (slide.code || '').split('\n').length;
      if (lines > 15)
        add('warn', n, `Code block: ${lines} lines. Trim to 15 or fewer, or show only the key part.`);
    }

    if (type === 'split' && dense) {
      const max = Math.max(
        (slide.left?.bullets  || []).length,
        (slide.right?.bullets || []).length
      );
      if (max > 4)
        add('warn', n, `Split slide: ${max} items per column. Keep each column to 4 or fewer.`);
    }


    if (type === 'table' && dense) {
      const cols = slide.columns || [];
      const rows = slide.rows || [];
      if (!Array.isArray(cols) || !cols.length)
        add('warn', n, 'Table: no columns. Give it a `columns:` list of header labels.');
      if (!Array.isArray(rows) || !rows.length)
        add('warn', n, 'Table: no rows. Give it a `rows:` list of cell lists.');
      if (cols.length > 6)
        add('warn', n, `Table: ${cols.length} columns. Past 6 the cells are unreadable from the back of the room.`);
      if (rows.length > 8)
        add('warn', n, `Table: ${rows.length} rows. Past 8, show the shape and hand out the data.`);
      rows.forEach((r, ri) => {
        if (Array.isArray(r) && cols.length && r.length !== cols.length)
          add('warn', n, `Table row ${ri + 1}: ${r.length} cells for ${cols.length} columns.`);
      });
    }

    if (type === 'grid' && dense) {
      const items = slide.items || [];
      if (!items.length)
        add('warn', n, 'Grid: no items. Give it an `items:` list.');
      if (items.length > 6)
        add('warn', n, `Grid: ${items.length} items. Keep it to 6; more is a table, not a grid.`);
      if (slide.columns !== undefined && ![2, 3, 4].includes(slide.columns))
        add('warn', n, `Grid columns ${JSON.stringify(slide.columns)}: expected 2, 3 or 4. Deriving from the item count.`);
      if (slide.style !== undefined && !['cards', 'plain'].includes(slide.style))
        add('warn', n, `Unknown grid style "${slide.style}", using cards. Styles: cards, plain.`);
      items.forEach((it, ii) => {
        const words = String(it?.text || '').trim().split(/\s+/).filter(Boolean);
        if (words.length > 25)
          add('info', n, `Grid item ${ii + 1}: ${words.length} words. A card is a caption, not a paragraph.`);
      });
    }

    if (type === 'media') {
      if (slide.side !== undefined && !['left', 'right'].includes(slide.side))
        add('warn', n, `Unknown media side "${slide.side}", using right. Sides: left, right.`);
      if ((slide.bullets || []).length > 5)
        add('warn', n, `Media slide: ${(slide.bullets || []).length} bullets beside the image. Aim for 5 or fewer.`);
    }

    if ((type === 'image' || type === 'media') && !slide.src)
      add('info', n, 'No `src`, so a placeholder frame renders. Fine while drafting, not for the room.');

    if (type === 'agenda') {
      const items = slide.items || [];
      const dividers = slides.filter(s2 => (s2.type === 'divider')).length;
      if (slide.auto && !items.length && dividers < 2)
        add('warn', n, `Agenda: auto needs section dividers to read; this deck has ${dividers}. Add dividers or list \`items:\` yourself.`);
      if (!slide.auto && !items.length)
        add('warn', n, 'Agenda: no items. List `items:` or set `auto: true` to derive them from the deck dividers.');
      if (items.length > 8)
        add('warn', n, `Agenda: ${items.length} items. Past 8 nobody holds the shape of the talk.`);
    }

    if (slide.rail !== undefined && typeof slide.rail !== 'boolean')
      add('warn', n, `rail: expects true or false, got ${JSON.stringify(slide.rail)}.`);


    /* A per-slide background replaces the theme's, but not the theme's text
       colour. Every gradient preset is dark, so one dropped on a light theme
       leaves dark ink on a dark slide. This is the check that catches it. */

    if (type === 'matrix' && dense) {
      const cols = slide.columns || [];
      const rows = slide.rows || [];
      if (!cols.length) add('warn', n, 'Matrix: no columns. Give it a `columns:` list of the options compared.');
      if (!rows.length) add('warn', n, 'Matrix: no rows. Each row needs a `label:` and a `cells:` list.');
      if (cols.length > 5) add('warn', n, `Matrix: ${cols.length} options. Past 5 nobody compares, they just look.`);
      if (rows.length > 7) add('warn', n, `Matrix: ${rows.length} criteria. Past 7, cut to the ones that decide it.`);
      rows.forEach((r, ri) => {
        if (Array.isArray(r?.cells) && cols.length && r.cells.length !== cols.length)
          add('warn', n, `Matrix row ${ri + 1}: ${r.cells.length} cells for ${cols.length} columns.`);
        if (!r?.label) add('info', n, `Matrix row ${ri + 1}: no label, so the row says nothing on its own.`);
      });
    }

    if (type === 'people' && dense) {
      const list = slide.people || [];
      if (!list.length) add('warn', n, 'People: no `people:` list.');
      if (list.length > 10) add('warn', n, `People: ${list.length} faces. Past 10 it is an org chart, not an introduction.`);
      if (slide.columns !== undefined && ![2, 3, 4, 5].includes(slide.columns))
        add('warn', n, `People columns ${JSON.stringify(slide.columns)}: expected 2 to 5. Deriving from the count.`);
      list.forEach((pn, pi) => {
        if (!pn?.name) add('warn', n, `Person ${pi + 1}: no name.`);
      });
    }

    if (type === 'checklist' && dense) {
      const items = slide.items || [];
      const STATES = ['done', 'doing', 'blocked', 'todo'];
      if (!items.length) add('warn', n, 'Checklist: no `items:` list.');
      if (items.length > 8) add('warn', n, `Checklist: ${items.length} items. Past 8, split it or show only what changed.`);
      items.forEach((it, ii) => {
        if (it?.state !== undefined && !STATES.includes(it.state))
          add('warn', n, `Checklist item ${ii + 1}: unknown state "${it.state}", treated as todo. States: ${STATES.join(', ')}.`);
        if (!it?.label) add('warn', n, `Checklist item ${ii + 1}: no label.`);
      });
    }

    if (type === 'compare') {
      if (!slide.before || !slide.after)
        add('warn', n, 'Compare: needs both `before:` and `after:`. One frame alone is an image slide.');
      if (!slide.before?.src || !slide.after?.src)
        add('info', n, 'Compare: a frame with no `src` renders a placeholder. Fine while drafting.');
    }

    if (type === 'timeline' && dense) {
      const steps = slide.steps || [];
      if (steps.length > 6)
        add('warn', n, `Timeline: ${steps.length} steps. Past 6 the axis is a table, not a road.`);
      steps.forEach((st, si) => {
        if (st?.mark !== undefined && typeof st.mark !== 'boolean')
          add('warn', n, `Timeline step ${si + 1}: mark: expects true or false, got ${JSON.stringify(st.mark)}.`);
      });
    }

    if (type === 'process') {
      const steps = slide.steps || [];
      if (!steps.length) add('warn', n, 'Process: no `steps:` list.');
      if (slide.flow !== undefined && !['columns', 'rows'].includes(slide.flow))
        add('warn', n, `Unknown process flow "${slide.flow}", using columns. Flows: columns, rows.`);
      if (dense && steps.length > 5)
        add('warn', n, `Process: ${steps.length} steps. Past 5 the cards are strips; split the process or use a timeline.`);
      if (dense && slide.flow === 'rows' && steps.length > 4)
        add('warn', n, `Process: ${steps.length} steps in rows flow. Four rows fill the slide; the rest are cut off.`);
      const current = steps.filter(st => st?.current === true).length;
      if (current > 1)
        add('warn', n, `Process: ${current} steps marked current. "Where we are" is one place.`);
      steps.forEach((st, si) => {
        if (!st?.label) add('warn', n, `Process step ${si + 1}: no label. The header band is what the room reads.`);
      });
    }

    if (type === 'chart') {
      /* The three chart rules CLAUDE.md states: at most 6 series, a legend
         (every series named), and a stated unit. The structural checks stay on
         in the appendix; only the series cap is a density rule. */
      const KINDS = ['bar', 'pie', 'line'];
      const series = Array.isArray(slide.series) ? slide.series : [];
      const labels = Array.isArray(slide.labels) ? slide.labels : [];
      if (slide.chart !== undefined && !KINDS.includes(slide.chart))
        add('warn', n, `Unknown chart "${slide.chart}", using bar. Kinds: ${KINDS.join(', ')}.`);
      if (!series.length)
        add('warn', n, 'Chart: no `series:` list. Each series needs a `name:` and a `values:` list.');
      if (!slide.unit)
        add('warn', n, 'Chart: no `unit:`. Say what the numbers are ("requests/day", "USD"), or the bars are just shapes.');
      if (dense && series.length > 6)
        add('warn', n, `Chart: ${series.length} series. Past 6 the legend outgrows the chart; split it or cut.`);
      if (!labels.length && series.length)
        add('info', n, 'Chart: no `labels:` list, so the points are numbered instead of named.');
      if (slide.chart === 'pie' && series.length > 1)
        add('warn', n, `Pie: ${series.length} series. A pie draws one; the others are dropped. Use bar to compare series.`);
      series.forEach((sr, si) => {
        const vals = Array.isArray(sr?.values) ? sr.values : [];
        if (!vals.length)
          add('warn', n, `Chart series ${si + 1}: no \`values:\` list.`);
        else if (labels.length && vals.length !== labels.length)
          add('warn', n, `Chart series "${sr?.name || si + 1}": ${vals.length} values for ${labels.length} labels.`);
        if (vals.some(v => typeof v !== 'number' || Number.isNaN(v)))
          add('warn', n, `Chart series "${sr?.name || si + 1}": non-numeric values are drawn as 0.`);
        if (!sr?.name && slide.chart !== 'pie' && series.length > 1)
          add('warn', n, `Chart series ${si + 1}: no name, so the legend cannot label it.`);
      });
    }

    if (type === 'orgchart') {
      const root = slide.root;
      if (!root || typeof root !== 'object') {
        add('warn', n, 'Orgchart: no `root:` node. It needs a `root:` with `name:`, `role:` and `reports:`.');
      } else {
        let nodes = 0, maxDepth = 0, unnamed = 0;
        (function walk(pn, depth) {
          if (!pn) return;
          nodes += 1;
          if (!pn.name) unnamed += 1;
          maxDepth = Math.max(maxDepth, depth);
          (pn.reports || []).forEach(c => walk(c, depth + 1));
        })(root, 1);
        if (dense && nodes > 12)
          add('warn', n, `Orgchart: ${nodes} nodes. Past 12 it is unreadable on a projector; show one branch, or use a people slide.`);
        if (maxDepth > 3)
          add('warn', n, `Orgchart: ${maxDepth} levels. The layout draws 3; deeper reports are flattened into their branch list.`);
        if (unnamed) add('warn', n, `Orgchart: ${unnamed} node(s) with no name.`);
      }
    }


    /* Headings that name a subject rather than stating a claim. Exempt: a title
       is a name, a qa heading is a prompt, an appendix marker is a signpost, and
       a calendar spine ("Day One") is a position the reader needs. */
    if (slide.heading && !['title', 'qa', 'appendix'].includes(type)) {
      const bare = String(slide.heading).toLowerCase().trim().replace(/[?:.]$/, '');
      headingCount += 1;
      const words = String(slide.heading).trim().split(/\s+/).length;
      if (TOPIC_LABELS.has(bare)) {
        labelCount += 1;
        add('info', n, `Heading "${slide.heading}" names a topic. State the claim instead: "Rollout" says nothing, "Nothing switches in week one" does.`);
      } else if (words <= 3 && !FINITE_VERB.test(slide.heading) && !VERBY.test(slide.heading)) {
        /* Only very short headings with nothing verb-shaped in them. Anything
           longer is left alone: without a parts-of-speech tagger the guess is
           worse than silence, and the aggregate below is what the author reads. */
        labelCount += 1;
      }
    }


    /* A number in the heading has to be on the slide under it. Kong, Liu &
       Karahalios (CHI 2019) found readers recall the title's message over the
       data, and still rate the chart impartial when the two disagree, so a
       mismatch does not self-correct in the room. */
    /* Dividers and markers are exempt: a section heading is supported by the
       slides it introduces, not by the divider itself, so demanding the number
       on the divider is asking the wrong slide for it. */
    if (slide.heading && dense && !['divider', 'appendix', 'title'].includes(type)) {
      /* Keep times, decimals and thousands together: splitting "14:02" into
         "14" and "02" made the rule miss the very value sitting on the slide.
         Bare one and two digit numbers are dropped as too weak to act on. */
      const claimed = (String(slide.heading).match(/\d[\d,.:]*\d%?|\d%/g) || [])
        .filter(t => t.replace(/\D/g, '').length >= 2 || t.endsWith('%'));
      if (claimed.length) {
        const body = JSON.stringify({ ...slide, heading: '' });
        const absent = claimed.filter(nRaw => !body.includes(nRaw));
        if (absent.length)
          add('info', n, `The heading claims ${absent.map(x => `"${x}"`).join(', ')}, which does not appear anywhere on this slide. Show the number you are asserting.`);
      }
    }

    if (slide.background) {
      const themeName = (meta?.theme && THEMES[meta.theme]) ? meta.theme : 'neorgon';
      const textColor = meta?.brand?.text || THEMES[themeName].text;
      const lt = relLuminance(textColor);
      const lb = bgLuminance(slide.background);
      if (lt !== null && lb !== null) {
        const ratio = (Math.max(lt, lb) + 0.05) / (Math.min(lt, lb) + 0.05);
        if (ratio < 4.5) {
          const known = BG_PRESETS[slide.background] ? `preset "${slide.background}"` : 'background';
          add('warn', n, `The ${known} gives ${ratio.toFixed(1)}:1 against this deck's text colour, below 4.5:1. Every preset is dark, so pair them with a dark theme.`);
        }
      }
    }

    if (slide.pattern !== undefined && slide.pattern !== 'none' && !PATTERNS[slide.pattern])
      add('warn', n, `Unknown pattern "${slide.pattern}": ignored. Available: ${Object.keys(PATTERNS).join(', ')}, none.`);
  });

  /* Reported once, not per slide: the verb half of the test is a heuristic and
     firing it on forty headings would be noise rather than coaching. */
  if (headingCount >= 4 && labelCount / headingCount >= 0.6) {
    add('info', null,
      `${labelCount} of ${headingCount} headings read as topic labels. Printed on their own, ` +
      `headings should make the argument: a reader who skims only those should get the point.`);
  }


  /* `CLAUDE.md` opens by telling the author to establish audience, outcome and
     setting before writing any YAML, and until now nothing recorded the answer,
     so one ruleset applied to a standup and a board pitch alike. These three
     fields are what let a rule differ by room. All optional: a deck that
     declares none behaves exactly as before. */
  const AUDIENCES = ['exec', 'engineering', 'customer', 'mixed', 'learner'];
  const ROOMS = ['desk', 'meeting', 'classroom', 'hall'];
  const OUTCOMES  = ['inform', 'convince', 'approve', 'teach'];

  if (meta?.audience && !AUDIENCES.includes(meta.audience))
    add('warn', null, `Unknown audience "${meta.audience}". One of: ${AUDIENCES.join(', ')}.`);
  if (meta?.room && !ROOMS.includes(meta.room) && !(typeof meta.room === 'number' && meta.room > 0))
    add('warn', null, `Unknown room "${meta.room}". One of: ${ROOMS.join(', ')}, or a viewing ratio as a number.`);
  if (meta?.outcome && !OUTCOMES.includes(meta.outcome))
    add('warn', null, `Unknown outcome "${meta.outcome}". One of: ${OUTCOMES.join(', ')}.`);
  if (meta?.duration !== undefined && meta.duration !== 0 &&
      (typeof meta.duration !== 'number' || meta.duration <= 0))
    add('warn', null, `duration ${JSON.stringify(meta.duration)}: expected minutes as a number.`);

  /* Minutes per slide. Alley & Neeley (2005): "Limit the number of slides so
     that at least 1 minute can be spent on each slide." Counts the talk only,
     since backup slides behind the appendix marker consume no time. */
  if (typeof meta?.duration === 'number' && meta.duration > 0 && mainSlides.length > meta.duration) {
    const each = Math.round((meta.duration * 60) / mainSlides.length);
    add('warn', null,
      `${mainSlides.length} slides in ${meta.duration} minutes is ${each} seconds each. ` +
      `Cut ${mainSlides.length - meta.duration}, or move them behind an appendix marker.`);
  }

  /* Answer first, for a decision. AR 25-50 para 1-36 requires the main point at
     the beginning; Minto's pyramid says the same. Duarte's sparkline says the
     opposite and is right for a talk, which is exactly why this fires only when
     the deck says it is asking for a decision. */
  if (meta?.big_idea) {
    const words = String(meta.big_idea).trim().split(/\s+/).length;
    if (words > 30)
      add('warn', null, `big_idea is ${words} words. One sentence a room can repeat, 30 words at most.`);
  }

  if (meta?.outcome === 'approve' && mainSlides.length >= 5) {
    const askAt = mainSlides.findIndex(s2 => (s2.type || 'bullets') === 'cta');

    /* A deck satisfies BLUF by stating its answer early, not by moving the ask
       to the front: a deck still ends with what it wants. So the check is
       whether the recommendation shows up in the first 40%, and a declared
       `big_idea` appearing there is what proves it. */
    const front = mainSlides.slice(0, Math.max(2, Math.ceil(mainSlides.length * 0.4)));
    const key = String(meta.big_idea || '').toLowerCase().replace(/[^a-z0-9 ]/g, '')
      .split(/\s+/).filter(w => w.length > 4);
    const statedEarly = key.length > 0 && front.some(s2 => {
      const text = JSON.stringify(s2).toLowerCase();
      return key.filter(w => text.includes(w)).length >= Math.min(2, key.length);
    });

    if (askAt === -1) {
      add('warn', null, 'outcome is approve and the deck never asks. Add a cta naming the decision.');
    } else if (!statedEarly && askAt / mainSlides.length > 0.4) {
      add('info', askAt + 1,
        meta.big_idea
          ? `The recommendation does not appear until ${Math.round((askAt / mainSlides.length) * 100)}% in. State the big_idea in the opening slides, then use the evidence to support it.`
          : `The ask lands ${Math.round((askAt / mainSlides.length) * 100)}% of the way in. A room that has to decide wants the recommendation early, then the evidence for it. Declaring big_idea and stating it up front settles this.`);
    }
  }


  /* Minto's grouping rule, the checkable part: a heading should summarise more
     than one thing below it. Reuses the divider indices the auto agenda and the
     "Section k of n" eyebrow already compute. */
  const dividerIdx = mainSlides
    .map((s2, i) => ((s2.type || 'bullets') === 'divider' ? i : -1))
    .filter(i => i !== -1);
  dividerIdx.forEach((at, k) => {
    const next = dividerIdx[k + 1] ?? mainSlides.length;
    const between = next - at - 1;
    if (between < 2)
      add('info', at + 1,
        `This section holds ${between === 0 ? 'no slides' : 'one slide'}. A section with one slide is not a section: merge it, or give it a second.`);
  });

  // Deck-level checks
  if (meta?.theme && !THEMES[meta.theme])
    add('warn', null, `Unknown theme "${meta.theme}": falling back to the current one. Available: ${Object.keys(THEMES).join(', ')}.`);

  if (meta?.pattern && meta.pattern !== 'none' && !PATTERNS[meta.pattern])
    add('warn', null, `Unknown pattern "${meta.pattern}": ignored. Available: ${Object.keys(PATTERNS).join(', ')}, none.`);

  if (meta?.brand) {
    const allowed = ['accent', 'bg', 'text', 'on_accent'];
    if (typeof meta.brand !== 'object' || Array.isArray(meta.brand)) {
      add('warn', null, `brand: must be a map of color overrides (${allowed.join(', ')}).`);
    } else {
      for (const k of Object.keys(meta.brand)) {
        if (!allowed.includes(k))
          add('warn', null, `brand.${k} is not a brand key: ignored. Allowed: ${allowed.join(', ')}.`);
        else if (typeof meta.brand[k] !== 'string' || !meta.brand[k])
          add('warn', null, `brand.${k} must be a CSS color string.`);
      }

      // Contrast: brand colors override curated themes, so nothing else vouches
      // for their readability. Pairs are resolved the way the player resolves
      // them (deck theme if valid, else the site default), and a pair is only
      // checked when at least one member comes from brand — fully theme-derived
      // pairs are the theme author's problem, not the deck's.
      const themeName = (meta.theme && THEMES[meta.theme]) ? meta.theme : 'neorgon';
      const base = THEMES[themeName];
      const b = meta.brand;
      const pairs = [
        ['text', b.text || base.text, !!b.text, 'bg', b.bg || base.bg, !!b.bg, 4.5, 'warn'],
        ['on_accent', b.on_accent || '#ffffff', !!b.on_accent, 'accent', b.accent || base.accent, !!b.accent, 3, 'warn'],
        ['accent', b.accent || base.accent, !!b.accent, 'bg', b.bg || base.bg, !!b.bg, 3, 'info'],
      ];
      const unhexed = new Set();
      for (const [an, a, aBrand, bn, bv, bBrand, min, level] of pairs) {
        if (!aBrand && !bBrand) continue;
        const la = relLuminance(a, bv);
        const lb = relLuminance(bv, base.bg);
        if (la === null || lb === null) {
          const [cn, cv, cBrand] = la === null ? [an, a, aBrand] : [bn, bv, bBrand];
          if (cBrand && !unhexed.has(cn)) {
            unhexed.add(cn);
            add('info', null, `brand ${cn} "${cv}" is not a hex color: contrast unchecked. Use #rrggbb to get the check.`);
          }
          continue;
        }
        const ratio = (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
        if (ratio < min) {
          const from = (name, isBrand) =>
            isBrand ? '' : (name === 'on_accent' ? ` (${name} is the default #ffffff)` : ` (${name} from the ${themeName} theme)`);
          add(level, null,
            `brand contrast: ${an} on ${bn} is ${ratio.toFixed(1)}:1, below ${min}:1${from(an, aBrand)}${from(bn, bBrand)}.`);
        }
      }
    }
  }

  if (appendixAt !== -1) {
    if (slides.filter(s2 => (s2.type || 'bullets') === 'appendix').length > 1)
      add('warn', null, 'More than one appendix marker. The first one already ends the talk; the rest read as sections.');
    if (appendixAt === slides.length - 1)
      add('info', appendixAt + 1, 'Appendix marker is the last slide, so there is nothing behind it.');
    if (appendixAt === 0)
      add('warn', 1, 'Appendix marker is the first slide, so the whole deck counts as backup.');
  }

  for (const k of ['footer', 'classification']) {
    if (meta?.[k] === undefined || meta[k] === '') continue;
    if (typeof meta[k] !== 'string')
      add('warn', null, `${k}: expects a single line of text.`);
    else if (meta[k].length > 60)
      add('warn', null, `${k}: ${meta[k].length} characters. The rail is one line; keep it under 60.`);
  }

  if (meta?.logo_pos && !['top-left', 'top-right', 'bottom-left', 'bottom-right'].includes(meta.logo_pos))
    add('warn', null, `Unknown logo_pos "${meta.logo_pos}": using the default (top-right). Corners: top-left, top-right, bottom-left, bottom-right.`);

  if (meta?.logo_size && (typeof meta.logo_size !== 'number' || meta.logo_size < 16 || meta.logo_size > 240))
    add('warn', null, `logo_size ${JSON.stringify(meta.logo_size)}, expected a pixel height between 16 and 240; using the default. Sizes the title-slide logo only; the stamp is logo_stamp_size.`);

  if (meta?.logo_stamp_size && (typeof meta.logo_stamp_size !== 'number' || meta.logo_stamp_size < 12 || meta.logo_stamp_size > 120))
    add('warn', null, `logo_stamp_size ${JSON.stringify(meta.logo_stamp_size)}, expected a pixel height between 12 and 120; using the default (30).`);

  /* `./brand.png` was accepted here and has exactly the problem the message
     describes: a relative path resolves against wherever the player is served,
     not against the YAML. Only a URL, a data: URI, or a root-absolute path
     survives being opened somewhere else. */
  if (meta?.logo && meta.logo !== 'placeholder' && !/^(data:|https?:\/\/|\/)/.test(meta.logo))
    add('info', null,
      `logo "${meta.logo}" is a relative path: it resolves against wherever the player is served, ` +
      'not against the YAML file. Use a full URL, a data: URI (the player’s Logo button embeds a local file), ' +
      'or self-host the deck beside the image.');

  if (slides.length > 0 && slides[0].type !== 'title')
    add('info', 1, 'First slide is not a title. Consider adding one for context.');

  if (mainSlides.length > 5 && !hasQA)
    add('info', null, 'No Q&A or pause slide. Add one every 4 to 5 slides.');

  if (mainSlides.length > 3 && !hasCTA)
    add('info', null, 'No CTA slide. What is the one thing your audience should do?');

  const last = mainSlides[mainSlides.length - 1];
  if (last && last.type !== 'cta' && last.type !== 'qa' && mainSlides.length > 2)
    add('info', mainSlides.length, 'Last slide is not a CTA or Q&A. Does it end with a clear action?');

  return W;
}
