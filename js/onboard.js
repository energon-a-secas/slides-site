/* ═══════════════════════════════════════════════════════════════════════════
   Onboarding — the first screen, and a tour of the parts that are not obvious.

   The empty editor was the worst screen in the app: it told a first-time
   visitor the YAML schema existed but not what to type. This gives them three
   doors instead, and remembers that they walked through one.
═══════════════════════════════════════════════════════════════════════════ */

import { update } from './render.js';
import { openCatalog } from './catalog.js';
import { showToast } from './utils.js';
import { typingOrOverlaid } from './events.js';

const SEEN_KEY = 'pres-sage-seen';

const SCRATCH_DECK = `presentation:
  title: "Your Deck Title"
  subtitle: "One line that frames the talk"
  author: "Your Name"

  slides:
    - type: title
      heading: "Your Deck Title"
      subtitle: "One line that frames the talk"
`;

/* ── The tour ─────────────────────────────────────────────────────────── */

/* Anchors are selectors resolved at run time: the tour must not hold
   references to nodes the app re-renders underneath it. */
const STEPS = [
  {
    sel: '#yaml-input',
    text: 'This textarea is the deck. Everything else on the page reads from it, and nothing edits it behind your back.',
  },
  {
    sel: '.preview-pane',
    text: 'The slide renders as you type. What you see here is what every export produces.',
  },
  {
    sel: '[onclick="openCatalog(\'decks\')"]',
    text: 'Examples opens twelve complete decks and four deck structures. Click a card to load it into the editor.',
  },
  {
    sel: '#insert-slide-btn, [onclick="openCatalog(\'slides\')"]',
    text: 'Plus Slide inserts one slide type at the cursor: a table, a matrix, a checklist, a team grid.',
  },
  {
    sel: '[onclick="openCatalog(\'style\')"]',
    text: 'Design holds themes, gradients, patterns and brand colours. Clicking a swatch writes the YAML for you.',
  },
  {
    sel: '[data-action="runAudit"]',
    text: 'Audit reads the deck against density and flow rules: too many bullets, no closing action, unreadable colour pairs.',
  },
];

let stepIndex = 0;

function place(el) {
  const pop = document.getElementById('tour-pop');
  const veil = document.getElementById('tour-veil');
  const r = el.getBoundingClientRect();

  // The veil is a ring, not a sheet: a box-shadow big enough to cover the page
  // leaves the target lit without stacking a second element over it.
  veil.style.top = `${r.top - 6}px`;
  veil.style.left = `${r.left - 6}px`;
  veil.style.width = `${r.width + 12}px`;
  veil.style.height = `${r.height + 12}px`;

  pop.hidden = false;
  const pw = pop.offsetWidth || 320;
  const below = r.bottom + 12;
  const fitsBelow = below + pop.offsetHeight < window.innerHeight;
  pop.style.top = `${fitsBelow ? below : Math.max(12, r.top - pop.offsetHeight - 12)}px`;
  pop.style.left = `${Math.min(Math.max(12, r.left), window.innerWidth - pw - 12)}px`;
}

function renderStep() {
  const step = STEPS[stepIndex];
  const el = step && document.querySelector(step.sel);
  if (!el) { endTour(); return; }

  document.getElementById('tour-veil').hidden = false;
  document.getElementById('tour-step').textContent = `${stepIndex + 1} of ${STEPS.length}`;
  document.getElementById('tour-text').textContent = step.text;
  document.getElementById('tour-next').textContent =
    stepIndex === STEPS.length - 1 ? 'Done' : 'Next';
  place(el);
}

export function startTour() {
  stepIndex = 0;
  renderStep();
}

export function endTour() {
  document.getElementById('tour-veil').hidden = true;
  document.getElementById('tour-pop').hidden = true;
  localStorage.setItem(SEEN_KEY, '1');
}

/* ── The first screen ─────────────────────────────────────────────────── */

async function choose(choice) {
  const dlg = document.getElementById('welcome-dialog');
  dlg.close();
  localStorage.setItem(SEEN_KEY, '1');

  if (choice === 'example') {
    openCatalog('decks');
  } else if (choice === 'scratch') {
    document.getElementById('yaml-input').value = SCRATCH_DECK;
    update();
    showToast('A title slide to build on');
  } else if (choice === 'tour') {
    startTour();
  }
}

export function initOnboarding() {
  window.startTour = startTour;

  // Dismissing with Escape counts as seen: otherwise the dialog returned on
  // every reload, contradicting "shown once".
  document.getElementById('welcome-dialog')?.addEventListener('close', () => {
    localStorage.setItem(SEEN_KEY, '1');
  });

  document.getElementById('welcome-dialog')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-choice]');
    if (b) choose(b.dataset.choice);
  });

  document.getElementById('tour-next')?.addEventListener('click', () => {
    stepIndex += 1;
    if (stepIndex >= STEPS.length) endTour();
    else renderStep();
  });
  document.getElementById('tour-skip')?.addEventListener('click', endTour);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !document.getElementById('tour-pop').hidden) endTour();
    if (e.key.toLowerCase() === 't' && !e.metaKey && !e.ctrlKey
        && !typingOrOverlaid(document.getElementById('yaml-input'))) {
      startTour();
    }
  });

  // Re-place on resize so the ring does not drift off its target
  window.addEventListener('resize', () => {
    if (!document.getElementById('tour-pop').hidden) renderStep();
  });

  /* Only on a genuinely first visit: someone arriving with a deck in the URL
     or a deck restored from last time does not need to be asked where to
     start, they already started. */
  const hasDeck = document.getElementById('yaml-input').value.trim().length > 0;
  if (!hasDeck && !localStorage.getItem(SEEN_KEY)) {
    document.getElementById('welcome-dialog')?.showModal();
  }
}
