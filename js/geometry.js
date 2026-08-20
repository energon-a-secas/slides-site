/* ═══════════════════════════════════════════════════════════════════════════
   Geometry — does the content actually fit on the slide?

   Everything else in this app approximates this question. The density rules
   cap bullets at five and words at ten because those usually fit; `CLAUDE.md`
   says so plainly: "It checks density, not geometry: a passing deck can still
   overflow a slide, so the player click-through remains the final check."

   This measures it instead. `.slide` and nineteen inner containers carry
   `overflow: hidden`, so content past the box does not spill, warn, or leave a
   scrollbar. It simply disappears, and the author finds out in the room.

   Scope, deliberately narrow: this reports content that is CUT OFF, and
   nothing else. A "how full is this slide" margin heuristic was written and
   removed: `scrollHeight` on a fixed-height flex container never falls below
   `clientHeight`, so the ratio was pinned at 100% and it called a two-bullet
   title slide full. A check that cries wolf gets switched off, and then the
   real finding goes with it.

   Why this lives outside js/parser.js: `validate()` is shared with
   validate.mjs and must stay DOM-free, so the CLI and the audit bar cannot
   disagree. Measuring needs a real layout, so it is a separate browser-only
   pass and the CLI says it did not run rather than pretending.
═══════════════════════════════════════════════════════════════════════════ */

import { renderSlide } from './render.js';

/* The containers that clip. Each is a scroll parent inside a fixed 960x540
   box, so `scrollHeight > clientHeight` means content was cut off. */
const CLIPPING = {
  '.s-bullets': 'the bullet list',
  '.split-cols': 'a column',
  '.grid-items': 'the grid',
  '.check-list': 'the checklist',
  '.table-wrap': 'the table',
  '.code-block': 'the code block',
  '.media-copy': 'the copy beside the image',
  '.agenda-list': 'the agenda',
  '.people-grid': 'the people grid',
  '.timeline-track': 'the timeline',
  '.cmp-panes': 'the comparison',
  '.stats-grid': 'the stats row',
};

/* A slide is 960x540 and the stage scales it to fit. Measuring has to happen
   at natural size: a scaled element reports scaled boxes, and a deck would
   look fine at 60% and clip at 100%. */
function stage() {
  let host = document.getElementById('geometry-probe');
  if (host) return host;
  host = document.createElement('div');
  host.id = 'geometry-probe';
  host.setAttribute('aria-hidden', 'true');
  // Off-screen rather than display:none, which would report every box as zero.
  host.style.cssText =
    'position:fixed;left:-10000px;top:0;width:960px;height:540px;' +
    'pointer-events:none;opacity:0;';
  document.body.appendChild(host);
  return host;
}


/* Minimum legible size, by room.

   ISO 9241-303 sets a floor of 16 arcminutes of cap height and AVIXA's DISCAS
   acuity factor of 200 works out to 17.2, so the two agree within about 7%.
   The working rule below is DERIVED from AVIXA's published %EH table rather
   than quoted from the standard, which is paywalled: element height must be at
   least the farthest viewing distance divided by 200. It reproduces the classic
   4/6/8 rules of thumb exactly, which is decent corroboration and not a
   citation.

   Viewing ratio is distance expressed in screen heights. On this 540px-tall
   canvas the floor works out at 2.7px per unit of ratio, read as font-size.
   AVIXA's "element" wording is ambiguous between font-size and cap height, and
   the two readings differ by about 30%; the looser one ships. */
const ROOM_RATIO = { desk: 3, meeting: 4, classroom: 6, hall: 8 };

function minimumPx(room) {
  const vr = typeof room === 'number' ? room : ROOM_RATIO[room];
  return vr ? Math.round(vr * 2.7 * 10) / 10 : null;
}

/**
 * Measure every slide at its real size.
 * @returns {Promise<Array<{slide:number, level:string, msg:string}>>}
 */
export async function measureFit(slides, meta) {
  if (!slides?.length) return [];

  // Web fonts change line counts, so measuring before they load reports a fit
  // the viewer will not get.
  if (document.fonts?.ready) {
    try { await document.fonts.ready; } catch { /* no font API: measure anyway */ }
  }

  const host = stage();
  const findings = [];

  slides.forEach((slide, i) => {
    host.innerHTML = '';
    const el = renderSlide(slide, i, slides.length);
    // Undo the stage's scaling; this probe is the one place we want 1:1.
    el.style.transform = 'none';
    el.style.position = 'relative';
    host.appendChild(el);

    /* Text too small for the declared room. Unset means the rule never fires,
       so no existing deck starts warning. */
    const floor = minimumPx(meta?.room);
    if (floor) {
      const tooSmall = new Map();
      for (const node of el.querySelectorAll('*')) {
        // Chrome is meant to be small and nobody reads it from the back row.
        if (node.closest('.slide-rail, .slide-num, .s-meta')) continue;
        const text = [...node.childNodes].some(c => c.nodeType === 3 && c.textContent.trim());
        if (!text) continue;
        const px = parseFloat(getComputedStyle(node).fontSize);
        if (px && px < floor) {
          const key = node.className || node.tagName.toLowerCase();
          if (!tooSmall.has(key)) tooSmall.set(key, px);
        }
      }
      if (tooSmall.size) {
        const worst = [...tooSmall.entries()].sort((a, b) => a[1] - b[1]).slice(0, 3);
        findings.push({
          slide: i + 1,
          level: 'info',
          msg: `text below ${floor}px is unreadable from the back of a ${meta.room}: ` +
               worst.map(([k, px]) => `${String(k).split(' ')[0] || 'text'} at ${Math.round(px)}px`).join(', ') + '.',
        });
      }
    }

    const seen = new Set();
    for (const [sel, label] of Object.entries(CLIPPING)) {
      for (const box of el.querySelectorAll(sel)) {
        const overY = box.scrollHeight - box.clientHeight;
        const overX = box.scrollWidth - box.clientWidth;
        if (overY <= 1 && overX <= 1) continue;
        if (seen.has(sel)) continue;
        seen.add(sel);

        findings.push({
          slide: i + 1,
          level: 'warn',
          msg: overY > 1
            ? `${label} is clipped: ${overY}px of content is cut off and will not appear.`
            : `${label} is clipped horizontally by ${overX}px.`,
        });
      }
    }

  });

  host.innerHTML = '';
  return findings;
}
