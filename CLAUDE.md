# Presentation Sage: CLAUDE.md

This file tells Claude how to help create and critique presentations in this project.
The goal: **fewer iterations, faster structure, shorter slides, better flow.**

---

## Your role when working on a presentation

You are a **slide editor and coach**, not just a transcriber.
Your job is to help the user say the same thing in half the words, in the right order.

Before generating YAML, ask:
- What's the **audience**? (technical / non-technical / mixed)
- What's the **outcome**? (inform / convince / get approval / teach)
- What's the **setting**? (live talk / async video / printed handout)

---

## YAML schema

```yaml
presentation:
  title: "..."
  subtitle: "..."         # optional
  author: "..."           # optional
  date: "YYYY-MM"         # optional
  theme: "royal"          # optional deck-wide look — see "Deck themes" below
  pattern: "dots"         # optional background texture: dots, grid, diagonal, rings, orbs — see "Patterns"
  logo: "https://…"       # optional: URL, data: URI (player's ◉ Logo button embeds a local file), self-hosted path, or "placeholder"
  logo_all: true          # optional: stamp the logo on every non-title slide
  logo_pos: "bottom-left" # optional stamp corner: top-left, top-right (default), bottom-left, bottom-right
  logo_size: 96           # optional px height of the title-slide logo (16–240; default 52)
  logo_stamp_size: 44     # optional px height of the stamp on other slides (12–120; default 30)
  footer: "Platform review · Q3"   # optional deck note on the footer rail
  classification: "Internal"       # optional handling label on the footer rail
  audience: exec           # optional: exec | engineering | customer | mixed | learner
  room: meeting            # optional: desk | meeting | classroom | hall, or a viewing ratio
  outcome: approve         # optional: inform | convince | approve | teach
  duration: 20             # optional: minutes for the talk itself, backup slides excluded
  big_idea: "One sentence the room can repeat afterwards."   # optional
  brand:                  # optional brand colors, override the theme — see "Brand colors"
    accent: "#e50914"
    # bg: "#0b0b0f"       # text: / on_accent: also accepted; nothing else is

  slides:
    - type: title
      heading: "..."
      subtitle: "..."

    - type: bullets
      heading: "..."
      bullets:
        - "..."
      note: "..."          # speaker note, not shown on slide

    - type: split
      heading: "..."
      left:
        heading: "..."
        bullets:
          - "..."
      right:
        heading: "..."
        bullets:
          - "..."

    - type: code
      heading: "..."
      language: python     # js, bash, yaml, go, etc.
      code: |
        ...

    - type: quote
      text: "..."
      source: "..."

    - type: divider        # section break — separates major topics
      heading: "..."
      subtitle: "..."

    - type: qa             # pause for interaction
      heading: "Questions?"
      subtext: "..."

    - type: cta            # last slide — one clear action
      heading: "..."
      action: "..."        # the single thing to do
      subtext: "..."

    - type: image          # full image with optional caption
      heading: "..."       # optional
      src: "./diagram.png"
      alt: "description"
      caption: "..."       # optional
      fit: contain         # contain (default) or cover

    - type: stats          # big numbers / KPIs
      heading: "..."
      stats:
        - value: "42%"
          label: "Reduction in API calls"

    - type: timeline       # horizontal step sequence
      heading: "..."
      steps:
        - label: "Phase 1"
          text: "Description"

    - type: columns        # two-column free text (not bullets)
      heading: "..."
      left:
        heading: "..."
        text: "Paragraph text..."
      right:
        heading: "..."
        text: "Paragraph text..."

    - type: agenda         # what the talk covers
      heading: "Agenda"    # optional, defaults to "Agenda"
      auto: true           # derive items from the deck's divider headings
      current: 2           # optional, marks the section about to start
      items:               # optional, overrides auto
        - "Where the time goes"
        - label: "What it costs"
          text: "optional second line"

    - type: table          # small comparison grid
      heading: "..."
      columns: ["Option", "Cost", "Risk"]
      align: [left, right, center]   # optional, per column
      highlight: 2                   # optional, 1-based row to mark
      rows:
        - ["Keep as is", "$0", "High"]
        - ["Rebuild", "$40k", "Low"]
      caption: "..."                 # optional

    - type: grid           # 2 to 4 parallel points
      heading: "..."
      subtitle: "..."      # optional
      columns: 3           # optional, 2 to 4; derived from item count otherwise
      style: cards         # cards (default) or plain
      items:
        - icon: "◆"        # optional glyph or emoji
          heading: "..."
          text: "..."
          bullets: ["...", "..."]    # optional, instead of or besides text

    - type: matrix         # which option wins, scanned down a column
      heading: "..."
      columns: ["Keep", "Rebuild", "Patch"]
      highlight: 2                   # optional, 1-based column to emphasise
      rows:
        - label: "Runs offline"
          cells: [no, yes, partial]  # yes / no / partial, or any text
      caption: "..."                 # optional

    - type: people         # introducing a team
      heading: "..."
      columns: 3           # optional, 2 to 5
      people:
        - name: "Jane Smith"
          role: "Platform lead"
          src: "./jane.jpg"          # optional; initials render without it

    - type: checklist      # status, not a to-do list
      heading: "..."
      items:
        - label: "..."
          state: done      # done | doing | blocked | todo
          note: "..."      # optional second line

    - type: compare        # two images sharing one frame
      heading: "..."
      before: { src: "./before.png", alt: "...", label: "Before" }
      after:  { src: "./after.png",  alt: "...", label: "After" }
      fit: cover           # cover (default) or contain
      caption: "..."       # optional

    - type: appendix       # ends the talk; everything after is backup
      heading: "Backup Slides"
      subtitle: "..."      # optional

    - type: media          # copy beside a full-bleed image
      heading: "..."
      subtitle: "..."      # optional
      src: "./shot.png"    # omit to render a labelled placeholder frame
      alt: "description"
      side: right          # right (default) or left
      fit: cover           # cover (default) or contain
      bullets: ["..."]     # or text: "Paragraph..."
      caption: "..."       # optional
```

### Per-slide background

Any slide can override its background with `background:`. Supports preset names or raw CSS:

```yaml
    - type: stats
      background: ocean          # preset gradient
      heading: "Impact"

    - type: divider
      background: "linear-gradient(135deg, #1a0030, #0a0020)"  # raw CSS
      heading: "Section Two"
```

**Presets:** `aurora` (purple-teal) · `sunset` (orange-pink) · `ocean` (deep blue-cyan) · `ember` (red-amber) · `midnight` (indigo-black) · `forest` (green) · `storm` (blue-grey)

**All seven presets are dark, and a background does not change the theme's text colour.**
Put one on a light theme (`minimal`, `azure`, `meadow`, `dawn`) and the slide renders dark ink
on a dark slide. The audit measures this: a slide `background:` whose average luminance gives
under 4.5:1 against the deck's text colour warns with the ratio. Raw CSS backgrounds are
checked the same way whenever they contain hex stops.

Use gradients sparingly, on a section divider, a title, or the closing CTA. A gradient on every
slide is noise, and the eye stops reading it as emphasis after the second one.

### Deck themes

`presentation.theme:` sets the whole deck's default look: background, accent, text, and code
colors on every slide. The viewer's Theme dropdown still overrides it for that session; without
either, the visitor's saved preference (then `neorgon`) applies. An unknown name warns in the
audit bar and keeps the current theme.

| Theme | Tone | Look |
|---|---|---|
| `neorgon` | dark | Near-black navy, electric-blue accent (site default) |
| `royal` | dark | Saturated deep blue, bright blue accent |
| `midnight` | dark | Indigo-violet |
| `forest` | dark | Deep green, mint accent |
| `ember` | dark | Warm black, amber accent |
| `graphite` | dark | Neutral charcoal, silver accent: the understated one |
| `minimal` | light | Cool slate white, royal-blue accent |
| `azure` | light | Blue-tinted white, bright blue accent |
| `meadow` | light | Green-tinted white, leaf-green accent |
| `dawn` | light | Warm cream, burnt-orange accent |

Theme names are **colors, never brands or clients**. The name travels inside every exported
YAML, so pick the palette that matches the room, not the customer. Canonical definitions:
`THEMES` in `js/state.js` (key order there = dropdown order). All export paths follow the
active theme: PPTX derives its colors from it, standalone HTML and Reveal render with it, and
Marp front-matter carries its background/text colors.

### Brand colors

The place brand identity *does* belong is the deck's own YAML. It travels with the deck
instead of polluting the shared theme list. `presentation.brand:` overrides the active theme's
colors, whatever theme the viewer picks, so every deck for the same brand stays consistent:

```yaml
  brand:
    accent: "#e50914"     # bar, pills, timeline dots, stat values
    bg: "#0b0b0f"         # slide background (optional)
    text: "#f5f5f1"       # main text (optional)
    on_accent: "#ffffff"  # text sitting on the accent color (optional)
```

Only those four keys are accepted; anything else warns in the audit and is ignored. Brand
colors carry into PPTX/HTML/Reveal exports the same way the theme does. The audit also
checks the **contrast** of brand pairs (resolved against the deck's theme, or the default):
`text` on `bg` below 4.5:1 warns, `on_accent` on `accent` below 3:1 warns, `accent` on
`bg` below 3:1 notes. Hex colors only. A non-hex brand color is flagged as unchecked,
never assumed fine. Fully theme-derived pairs are exempt; the curated themes already pass.

### Logo

`logo:` accepts four forms: a **full URL** (`https://…`), a **`data:` URI**. The toolbar's
**◉ Logo** button embeds a local image file as one, keeping the deck a single self-contained
file: a **relative path**, which only resolves when the deck is self-hosted beside the image
(the audit flags this case), or **`placeholder`**, a generated monogram (the title's first
letter on the accent color) for drafts written before brand assets exist.

Placement and size: `logo_all: true` stamps the logo on every non-title slide, subtle and
persistent; `logo_pos:` picks its corner (`bottom-left` for the classic stamp; `top-right` is
the default, and `bottom-right` sits above the slide number, which owns that corner).
`logo_size:` sets the **title-slide** logo height in px (16–240, default 52) for decks where
the brand should lead the first screen. It never affects the stamp. That is
`logo_stamp_size:` (12–120, default 30), a separate knob so growing the opening logo cannot
quietly make every slide shout.

### Patterns

`presentation.pattern:` lays a subtle texture over the theme background on every slide; a
per-slide `pattern:` overrides it, and `pattern: none` opts one slide out. The ink color is
derived from the background's luminance, so every pattern works on dark and light themes.

| Pattern | Texture |
|---|---|
| `dots` | Fine dot grid |
| `grid` | Thin ruled grid |
| `diagonal` | 45° hairlines |
| `rings` | Concentric rings from the top-right corner |
| `orbs` | Two soft glow circles: big bottom-right, small upper-left; the non-tiling one |

Patterns are meant to be barely noticed. `grid` or `dots` suit a data-heavy deck, `orbs` suits
a launch or a title-heavy one, and a deck that is mostly screenshots wants none at all, since
the texture fights the images.

Patterns render in the player and the DOM-derived exports (standalone HTML, Reveal); PPTX
and Marp get flat theme/brand colors: say so if someone asks why the PPTX looks plainer.

### Audience, outcome, duration, and the big idea

This file opens by telling you to establish the audience, the outcome and the setting before
writing any YAML. These four optional fields **record the answer**, so a rule can differ by room
instead of judging a standup and a board pitch the same way. A deck that declares none of them
behaves exactly as before.

| Field | Values | What it changes |
|---|---|---|
| `audience` | `exec` · `engineering` · `customer` · `mixed` · `learner` | Recorded for the author and for coaching; no rule keys off it yet |
| `outcome` | `inform` · `convince` · `approve` · `teach` | `convince`/`approve` prefer three claims to five; `approve` expects the deck to lead with its answer |
| `duration` | minutes, a number | Warns when the talk has more slides than minutes |
| `big_idea` | one sentence, 30 words max | The answer, stated once, so the deck can lead with it |
| `room` | `desk` · `meeting` · `classroom` · `hall` | Sets a minimum legible size; the Fit pass flags text under it |

**Minimum size by room.** ISO 9241-303 floors Latin cap height at 16 arcminutes and AVIXA's
DISCAS acuity factor of 200 works out to 17.2, so the two agree within about 7%. The working
rule is **derived** from AVIXA's published table rather than quoted from the standard, which is
paywalled: element height at least the farthest viewing distance over 200. On this canvas that is
2.7px per unit of viewing ratio, so a hall (ratio 8) floors text at **21.6px** and flags captions,
table headers and subtitles. Chrome is exempt, since a page number is not read from the back row.
Leave `room` unset and the rule never fires.

**Minutes per slide.** Alley & Neeley (2005): "Limit the number of slides so that at least 1
minute can be spent on each slide." Only the talk counts; backup slides behind an `appendix`
marker consume no time, so moving detail there is a real fix rather than a dodge.

**Answer first, for a decision.** Army Regulation 25-50 para 1-36 requires the main point at the
beginning, and Minto's pyramid says the same. Duarte's sparkline says the opposite, holding the
resolution to the end, and is right for a conference talk. **Both are correct for different
rooms**, which is exactly why this fires only on `outcome: approve`.

Note what satisfies it: **not** moving the `cta` to the front, because a deck still ends with what
it wants. Declare `big_idea` and state it in the opening slides; the rule looks for it in the
first 40% and goes quiet when it finds it. All three approval decks in the library were
restructured this way, and each opens on a one-line statement of the recommendation before the
agenda.

### Footer rail

`footer:` and `classification:` put a persistent rail along the bottom of every non-title
slide: the deck note on the left, the handling label and the page count on the right. Declaring
neither leaves the bare slide number exactly where it always was, so existing decks do not
change. A single slide opts out with `rail: false`, which is what a full-bleed image slide
usually wants.

```yaml
presentation:
  footer: "Platform review · Q3"
  classification: "Internal"
```

The label is the deck's own claim about handling, not an enforcement mechanism: it travels in
the YAML and renders in the player, standalone HTML, Reveal (a fixed rail), Marp (a real
`footer:` directive) and PPTX (text on the bottom margin). Keep both strings under 60
characters; the rail is one line and the audit says so past that.

### Agenda and section progress

`type: agenda` with `auto: true` builds the list from the deck's own `divider` headings, so the
agenda cannot drift from the talk it announces. Reordering a section reorders the agenda.
Explicit `items:` always win when a deck wants different wording, and `current: 2` marks the
section about to start for decks that show the agenda more than once.

Dividers earn a "Section k of n" eyebrow automatically once a deck has two or more of them.
A divider opts out with `progress: false`.

### Appendix and backup slides

`type: appendix` marks the end of the talk. Everything after it is backup: answers held in
reserve for questions. Three things change behind the marker:

- **Page numbers** switch to their own series (`A1 / A3`), and the main count stops at the
  marker, so a 10-slide talk with 6 backup slides still reads as 10.
- **Density rules stop applying.** A backup slide is allowed the wall of numbers that would be
  wrong in the talk, which is the whole point of holding it back.
- **Flow checks read the main deck only**, so the CTA before the appendix still counts as the
  ending.

The audit warns about more than one marker, or a marker as the first slide.

### The Catalog, and the example decks

Two places to start from instead of an empty file:

- **The Catalog** is the one place anything gets started or styled, split into four tabs so a
  button's label matches what it shows: **Decks** (twelve example decks, four deck structures),
  **Slides** (the slide types), **Design** (gradients, patterns, themes), **Setup** (deck
  fields, brand colours, glyphs). Three entry points open it on their own tab: `⊞ Examples` on
  Decks, `+ Slide` on Slides, `✳ Design` on Design. Every slide-type preview is **rendered by
  the player itself**, so it cannot show a stale picture of a type. Swatches are drawn with the real
  gradient, the real texture, and the real theme colours; clicking one writes the key into the
  current slide or the deck, per the scope toggle. Clicking **clear** removes the key rather
  than writing `background: none`, a CSS keyword that would make the slide transparent. The
  brand pickers show the live contrast ratio and turn red below the threshold, so a failing
  pair is visible while choosing rather than after the audit.
- **The deck library** (`deck-library/`) holds **twelve** complete decks as real files under
  `deck-library/decks/*.yaml`, listed in `decks/index.json`. That manifest is shared: the
  library page and the Catalog both read it, so the two lists cannot disagree. Because the
  decks are files rather than strings in a page, `node validate.mjs deck-library/decks` checks
  every example the site hands out.

Clicking a deck **card** loads it into the editor, after a confirm naming the deck: the card is
the primary action, and its `New tab` and `Copy` buttons are the exceptions. The confirm is a
styled `<dialog>` rather than `window.confirm`, which some embedded contexts suppress entirely;
losing a draft to a dialog that never appeared is the worst failure available here.

A first visit with no deck opens a **welcome dialog**: start from an example, start from
scratch, or take a six-step tour (`T`, or `? Tour` in the toolbar). It is shown once, keyed on
`pres-sage-seen` in localStorage, and never to someone arriving with a deck in the URL or one
restored from last session, since they have already started.

Demo assets live in `deck-library/assets/` (`demo-logo.svg`, `demo-dashboard.svg`,
`demo-flame.svg`). They exist so the image, media, and logo features show something real in the
examples. Reference them root-absolute (`/deck-library/assets/demo-logo.svg`), because a bare
relative path resolves against wherever the player is served, not against the YAML file.

---

## Slide density rules (enforce these every time)

| Rule | Limit | Why |
|------|-------|-----|
| Bullets per slide | **≤ 5** | More = nobody reads them |
| Words per bullet | **≤ 10** | Fragments > sentences on slides |
| Code lines per slide | **≤ 15** | Show the point, not the file |
| Columns per split slide | **2 max** | 3 columns = unreadable |
| Ideas per slide | **1** | If you have two ideas, make two slides |
| Table rows / columns | **≤ 8 / ≤ 6** | Past that, show the shape and hand out the data |
| Grid items | **≤ 6** | More than six cards is a table, not a grid |
| Agenda items | **≤ 8** | Past eight nobody holds the shape of the talk |

**Headings carry the argument.** A heading either names a subject or makes a claim, and the audit
flags the unambiguous labels by name: `Agenda`, `Problem`, `Rollout`, `Actions`, `Next Steps`,
`The Ask` and about thirty others. Alley, Schreiber, Ramsdell & Muffo (2006) measured 69% vs 79%
recall on facts stated in a sentence headline rather than in the body, p = .001. Read their
control honestly: the claim that survives is "a fact stated in the headline is recalled better
than the same fact in the body", not that assertion headings improve slides in general.

The check is **`info` only and deliberately high-precision**: it names exact topic labels and
counts very short heading phrases, and it says nothing about the rest. Without a parts-of-speech
tagger, guessing whether "Where we landed" is a claim is worse than silence, and a rule that
misfires on a good heading teaches authors to ignore it. For the judgment half, use the
`deckcraft` skill.

The rewrite is usually a promotion, not new writing: in nine of twelve library decks the claim was
already sitting in `subtitle:`, `caption:`, `action:` or `note:`, rendered smaller than the label
above it.
| Matrix options / criteria | **≤ 5 / ≤ 7** | Past that nobody compares, they just look |
| People per slide | **≤ 10** | More faces than that is an org chart |
| Checklist items | **≤ 8** | Show what changed, not the whole backlog |

These rules are mechanically checkable without opening the player:

```bash
node validate.mjs deck.yaml    # exit 0 clean · 1 warnings with slide numbers · 2 unreadable
```

`validate.mjs` is a thin CLI over the player's own `js/parser.js`, so it cannot disagree with
the audit bar. It is published at `https://slides.neorgon.com/validate.mjs` and runs standalone
from any repo (it fetches the player's rules when no checkout is beside it), validate before a
human opens the deck. It checks density, not geometry, and says so on the last line of its own output.

**The geometry is measured in the app.** `js/geometry.js` renders every slide offscreen at its
real 960x540 size, waits for `document.fonts.ready`, and reports any container whose
`scrollHeight` exceeds its `clientHeight`: `.slide` and nineteen inner containers carry
`overflow: hidden`, so content past the box does not spill or scroll, it disappears. The audit
panel shows this as **Fit on the slide (measured)**, and it is the one check that measures what
the density rules only approximate. A deck can pass every density rule and still clip: five
bullets of ten words each, wrapping to three lines, loses the fifth one.

It lives outside `js/parser.js` on purpose, because `validate()` is shared with `validate.mjs`
and must stay DOM-free. The CLI states that geometry was not checked rather than implying a
completeness it does not have.

---

## Per-slide coaching checklist

Before writing each slide, ask yourself: and flag if the answer is "no":

1. **One idea?** Can you write the slide's point in a single sentence?
2. **Does the heading tell the whole story?** Someone skimming should get the gist from headings alone.
3. **Is every bullet earning its place?** Remove any bullet that doesn't change what the audience thinks or does.
4. **Too wordy?** If a bullet is a full sentence with a subject + verb + object, trim it.
5. **Does this slide connect to the central topic?** If you have to think for more than 3 seconds, it probably doesn't.

---

## Flow audit questions (run at the end)

After the full deck is written, check:

- [ ] Does **slide 1** define the problem or context: not just announce the topic?
- [ ] Is the order **problem → solution → proof → ask**? Or are you leading with the solution before the audience understands the pain?
- [ ] Are you **getting ahead of yourself**: referencing things the audience doesn't know yet?
- [ ] Is there a **Q&A or pause slide** at least every 5 slides?
- [ ] Does the **last slide** tell the audience exactly what to do next?
- [ ] Could you remove any slide entirely without losing the argument?
- [ ] If you printed only the headings, do they tell a coherent story?

---

## Presentation structure templates

### Technical proposal (engineering team)
```
title → problem (bullets) → current state vs target (split) →
solution detail (bullets or code) → trade-offs (split) →
migration / rollout (bullets) → qa → cta
```

### Business / stakeholder pitch
```
title → context (1 slide) → problem (1 slide) → impact (quote or stat) →
solution overview (bullets) → proof / demo (1–2 slides) → ask (cta)
```

### Tutorial / walkthrough
```
title → goals (bullets) → concepts (divider + bullets) →
hands-on (code × N) → recap (bullets) → next steps (cta)
```

---

## Slide type guide: when to use what

| Type | Use when |
|------|----------|
| `title` | First slide only |
| `bullets` | Listing 2–5 parallel points with no comparison needed |
| `split` | Comparing two things side-by-side (before/after, option A/B) |
| `code` | Showing a concrete snippet: prefer small, focused examples |
| `quote` | A principle, a user quote, or a striking stat |
| `divider` | Transitioning between major sections (acts as a chapter marker) |
| `qa` | Planned interaction points: don't wait until the end |
| `cta` | Final slide: one action, stated directly |
| `image` | Showing a screenshot, diagram, or photo: optional heading + caption |
| `stats` | Big numbers / KPIs: up to 4 metrics side by side |
| `timeline` | Step sequence: roadmaps, migration phases, project milestones |
| `columns` | Two-column free text: pros/cons narratives, before/after descriptions |
| `agenda` | Second slide of a long talk: what it covers, ideally `auto` from the dividers |
| `table` | A small comparison the audience will read across: options, costs, risks |
| `grid` | 2 to 4 parallel points that are not a sequence and not a comparison of two |
| `media` | A screenshot or photo that needs 2 to 5 lines of interpretation beside it |
| `matrix` | Which option wins: criteria down, options across, marks in the cells |
| `people` | Introducing a team, with headshots or generated initials |
| `checklist` | Status of a set of commitments: done, doing, blocked, to do |
| `compare` | Two images that only mean something next to each other |
| `appendix` | The end of the talk. Slides after it are backup, and play by other rules |

---

## Common mistakes to flag

- **Wall of text on one slide** → split or cut
- **Slide heading that just repeats the section title** → make it specific ("Problem" → "We're losing $12k/month in API costs")
- **Code block that's a whole file** → show only the 5–10 lines that matter
- **CTA that says "Questions?"** → that's a `qa` slide; `cta` should name the action
- **No pause slides in a 15-slide deck** → add at least 2 `qa` slides
- **First bullet restates the heading** → cut it, it's redundant
- **"In conclusion..." slide** → cut it; your `cta` IS the conclusion

---

## Export workflow

Six export paths in the app: PPTX, PDF/HTML via Marp CLI, standalone HTML, Reveal.js HTML,
GitHub Pages bundle, gallery manager.

### Share links (js/share.js)

The deck travels in the URL, mirroring proctor-site's contract: **`#d=<base64url yaml>`**
(built by the toolbar's `⤴ Share` button; refused over ~32 KB of payload, warned over 8 KB),
**`?src=<https url>`** (fetched, CORS permitting), and legacy **`?yaml=`** (pathfinder still
emits it; keep it working). `loadFromUrl()` in `js/share.js` owns all three and app.js falls
back to localStorage only when it returns false. The hash is cleaned with `replaceState`
after a successful load so an edited deck cannot diverge from a stale URL payload. A `?via=`
marker on arrival is counted by the header kit's analytics (when enabled), never read here.
The public contract is documented in `llms.txt`; change one only with the other.

**📖 Read `docs/references/export-workflow.md` when** the user wants to export a deck. It holds the exact toolbar buttons, the `marp` CLI commands, and the GitHub Pages multi-talk repo layout.

### Checking what the export actually contains

`validate.mjs` checks the deck. `check-exports.mjs` checks the **file**, because every defect
that survived longest here was invisible from the browser: a PowerPoint canvas a third too wide,
images that were SVG bytes under a `.png` name, a notes part holding only a page number, and the
author's home directory in the alt-text field. None needed a layout engine to catch, only someone
opening the zip.

```bash
node check-exports.mjs deck.yaml              # build to a temp dir, then check
node check-exports.mjs deck-library/decks     # every deck
node check-exports.mjs --built dist/          # check files that already exist
```

Four checks, all dependency-free:

- **No string left behind.** Every string the author typed must appear in the export. This is the
  general one: it does not need to know what a matrix is to notice that a matrix lost its row
  labels, and it catches any option added to the schema and forgotten in a serializer.
- **Zip sanity.** Every `.png` starts with the PNG magic number, and no artifact contains a local
  filesystem path.
- **Box arithmetic.** Nothing runs off the page, and a slide using under 70% of the page height is
  reported as an observation.
- **Colour ordering.** For all ten themes, `dim < muted < body <= text` after compositing alpha
  against the background. This is arithmetic on the theme table and needs no file at all.

Exit codes match `validate.mjs`: **0** clean or observations only, **1** defects, **2** could not
run. Gate a build with both:

```bash
node validate.mjs deck.yaml && node check-exports.mjs deck.yaml
```

### Building without the app

`render-deck.mjs` produces PPTX, PDF, HTML or Markdown from a deck file, for CI or a batch:

```bash
npm install js-yaml pptxgenjs @marp-team/marp-cli
node render-deck.mjs deck.yaml --pptx --pdf --out dist/
node render-deck.mjs deck-library/decks --pptx --out dist/   # a whole directory
```

`js-yaml` is always needed, `pptxgenjs` only for `--pptx`, and Marp CLI only for `--pdf`,
`--html` and `--marp-pptx` (it drives headless Chrome). A missing package prints its install
line rather than a stack trace.

**The serializers are shared, not reimplemented.** `js/serialize.js` holds `deckToMarp()` and
`deckToPptx()` as pure functions with no DOM; `js/export.js` is a thin browser wrapper around
them and the CLI imports the same module. A change to the PPTX layout reaches both, which is
the whole reason the file exists. `js/state.js` reads `localStorage` through a `typeof` guard
for the same reason: it has to import under Node.

Two traps worth knowing:

- **Root-absolute assets.** `/deck-library/assets/x.svg` means the site root in a browser and
  the filesystem root in Node. The CLI rewrites root-absolute `src:` and `logo:` values against
  `--base` (defaulting to the site root), so one deck builds in both places. URLs and `data:`
  URIs pass through.
- **Two different PPTX files.** `--pptx` (pptxgenjs) gives real editable text boxes with
  gradients flattened to solid colours; `--marp-pptx` gives one rendered image per slide, which
  looks closer to the browser but cannot be edited. Pick by whether anyone will edit it.

---

## Design tokens (for any custom CSS or theming)

These match the neorgon.com design system:

```
Background:   #040714
Surface:      rgba(255,255,255,.03)
Border:       rgba(255,255,255,.10)
Accent:       #0063e5
Text:         #f9f9f9
Text muted:   rgba(255,255,255,.45)
Header grad:  135deg, #B015B0 0%, #3D0080 45%, #080010 100%
Font:         'Avenir Next', system-ui
```
