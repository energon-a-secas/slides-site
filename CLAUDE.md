# Presentation Sage — CLAUDE.md

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

### Deck themes

`presentation.theme:` sets the whole deck's default look — background, accent, text, and code
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
| `graphite` | dark | Neutral charcoal, silver accent — the understated one |
| `minimal` | light | Cool slate white, royal-blue accent |
| `azure` | light | Blue-tinted white, bright blue accent |
| `meadow` | light | Green-tinted white, leaf-green accent |
| `dawn` | light | Warm cream, burnt-orange accent |

Theme names are **colors, never brands or clients** — the name travels inside every exported
YAML, so pick the palette that matches the room, not the customer. Canonical definitions:
`THEMES` in `js/state.js` (key order there = dropdown order). All export paths follow the
active theme: PPTX derives its colors from it, standalone HTML and Reveal render with it, and
Marp front-matter carries its background/text colors.

---

## Slide density rules (enforce these every time)

| Rule | Limit | Why |
|------|-------|-----|
| Bullets per slide | **≤ 5** | More = nobody reads them |
| Words per bullet | **≤ 10** | Fragments > sentences on slides |
| Code lines per slide | **≤ 15** | Show the point, not the file |
| Columns per split slide | **2 max** | 3 columns = unreadable |
| Ideas per slide | **1** | If you have two ideas, make two slides |

These rules are mechanically checkable without opening the player:

```bash
node validate.mjs deck.yaml    # exit 0 clean · 1 warnings with slide numbers · 2 unreadable
```

`validate.mjs` is a thin CLI over the player's own `js/parser.js`, so it cannot disagree with
the audit bar. It is published at `https://slides.neorgon.com/validate.mjs` and runs standalone
from any repo (it fetches the player's rules when no checkout is beside it) — validate before a
human opens the deck. It checks density, not geometry: a passing deck can still overflow a
slide, so the player click-through remains the final check.

---

## Per-slide coaching checklist

Before writing each slide, ask yourself — and flag if the answer is "no":

1. **One idea?** Can you write the slide's point in a single sentence?
2. **Does the heading tell the whole story?** Someone skimming should get the gist from headings alone.
3. **Is every bullet earning its place?** Remove any bullet that doesn't change what the audience thinks or does.
4. **Too wordy?** If a bullet is a full sentence with a subject + verb + object, trim it.
5. **Does this slide connect to the central topic?** If you have to think for more than 3 seconds, it probably doesn't.

---

## Flow audit questions (run at the end)

After the full deck is written, check:

- [ ] Does **slide 1** define the problem or context — not just announce the topic?
- [ ] Is the order **problem → solution → proof → ask**? Or are you leading with the solution before the audience understands the pain?
- [ ] Are you **getting ahead of yourself** — referencing things the audience doesn't know yet?
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

## Slide type guide — when to use what

| Type | Use when |
|------|----------|
| `title` | First slide only |
| `bullets` | Listing 2–5 parallel points with no comparison needed |
| `split` | Comparing two things side-by-side (before/after, option A/B) |
| `code` | Showing a concrete snippet — prefer small, focused examples |
| `quote` | A principle, a user quote, or a striking stat |
| `divider` | Transitioning between major sections (acts as a chapter marker) |
| `qa` | Planned interaction points — don't wait until the end |
| `cta` | Final slide — one action, stated directly |
| `image` | Showing a screenshot, diagram, or photo — optional heading + caption |
| `stats` | Big numbers / KPIs — up to 4 metrics side by side |
| `timeline` | Step sequence — roadmaps, migration phases, project milestones |
| `columns` | Two-column free text — pros/cons narratives, before/after descriptions |

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

Six export paths: PPTX (app), PDF/HTML via Marp CLI, standalone HTML, Reveal.js HTML, GitHub Pages bundle, gallery manager.

**📖 Read `docs/references/export-workflow.md` when** the user wants to export a deck — it holds the exact toolbar buttons, the `marp` CLI commands, and the GitHub Pages multi-talk repo layout.

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
