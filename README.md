<div align="center">

# Presentation Sage

Write slides as YAML, export to PPTX, HTML, or Marp. Includes a live flow auditor that flags pacing and density issues before you present.

[![Live][badge-site]][url-site]
[![HTML5][badge-html]][url-html]
[![CSS3][badge-css]][url-css]
[![JavaScript][badge-js]][url-js]
[![Claude Code][badge-claude]][url-claude]
[![License][badge-license]](LICENSE)

[badge-site]:    https://img.shields.io/badge/live_site-0063e5?style=for-the-badge&logo=googlechrome&logoColor=white
[badge-html]:    https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white
[badge-css]:     https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white
[badge-js]:      https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black
[badge-claude]:  https://img.shields.io/badge/Claude_Code-CC785C?style=for-the-badge&logo=anthropic&logoColor=white
[badge-license]: https://img.shields.io/badge/license-MIT-404040?style=for-the-badge

[url-site]:   https://slides.neorgon.com/
[url-html]:   #
[url-css]:    #
[url-js]:     #
[url-claude]: https://claude.ai/code

</div>

---

You write your deck as structured YAML. The editor renders a live preview as you type, flags density and flow issues in a coaching panel, and exports directly to PPTX, standalone HTML, or Marp Markdown. No install, no build step, no account.

---

## Usage

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Or open `index.html` directly in a browser.

---

## Slide types

| Type | Use when |
|---|---|
| `title` | First slide only |
| `bullets` | Listing 2 to 5 parallel points |
| `split` | Comparing two things side by side |
| `code` | Showing a focused code snippet |
| `quote` | A principle, stat, or user quote |
| `divider` | Section transition (chapter marker) |
| `qa` | Planned interaction point |
| `cta` | Final slide, one clear action |
| `image` | A screenshot, diagram, or photo |
| `stats` | Up to 4 big numbers side by side |
| `timeline` | A step sequence: roadmap, phases, milestones |
| `columns` | Two columns of free text rather than bullets |
| `agenda` | What the talk covers, optionally read from the dividers |
| `table` | A small comparison the audience reads across |
| `grid` | 2 to 4 parallel points as cards |
| `media` | A screenshot with a few lines of interpretation beside it |
| `matrix` | Which option wins: criteria down, options across |
| `people` | A team, with headshots or generated initials |
| `checklist` | Status: done, doing, blocked, to do |
| `compare` | Two images sharing one frame |
| `appendix` | Ends the talk; slides after it are backup |

---

## Starting points

- **Catalog** (toolbar, or `C`): decks to start from, whole deck structures, every slide type as
  a live preview, and swatches for gradients, patterns, themes, brand colours and glyphs. Click
  to insert the YAML or apply the style to the current slide or the whole deck.
- **[Deck library](deck-library/)**: twelve complete decks to fork, from a daily standup to an
  incident postmortem. They live as real files in `deck-library/decks/`, so
  `node validate.mjs deck-library/decks` checks all of them.

---

## Building a deck from the command line

```bash
npm install js-yaml pptxgenjs @marp-team/marp-cli
node render-deck.mjs deck.yaml --pptx --pdf --out dist/
```

PPTX comes from the same serializer the app uses, so the file matches what the browser exports.
PDF and HTML go through Marp CLI, which needs headless Chrome. `node render-deck.mjs --help`
lists every flag.

---

## YAML schema

```yaml
presentation:
  title: "Your Deck Title"
  subtitle: "Optional subtitle"
  author: "Name"
  date: "2025-01"

  slides:
    - type: title
      heading: "Opening slide heading"
      subtitle: "Supporting line"

    - type: bullets
      heading: "What we're solving"
      bullets:
        - "Short fragment, not a full sentence"
        - "Each bullet earns its place"
      note: "Speaker note, not shown on slide"

    - type: split
      heading: "Before vs after"
      left:
        heading: "Before"
        bullets: ["Slow deploys", "Manual rollbacks"]
      right:
        heading: "After"
        bullets: ["One command", "Auto rollback on failure"]

    - type: code
      heading: "The fix"
      language: yaml
      code: |
        on:
          push:
            branches: [main]

    - type: quote
      text: "If you can't explain it simply, you don't understand it."
      source: "Einstein (probably)"

    - type: cta
      heading: "Next step"
      action: "Open a PR against the infra repo"
      subtext: "Link in the channel"
```

---

## Exports

| Format | How |
|---|---|
| PPTX | Click **PPTX** in the toolbar. Downloads a `.pptx` you can open in Keynote or PowerPoint. |
| Standalone HTML | Click **HTML**. Self-contained file with keyboard navigation, ready to host or share. |
| Marp Markdown | Click **Marp MD**. Run through Marp CLI to produce PDF, HTML, or PPTX. |
| YAML source | Click **YAML**. Downloads the raw source for version control or backup. |

To export PDF via Marp CLI:

```bash
npm install -g @marp-team/marp-cli
marp slides.md --pdf
```

---

## Architecture

![Architecture](docs/architecture.svg)

```
slides-site/
├── index.html    # App shell
├── css/
│   └── style.css # All styles
└── js/
    ├── app.js    # Entry point
    ├── state.js  # Slide state + localStorage
    ├── parser.js # YAML → slide model
    ├── render.js # Live preview rendering
    ├── preview.js# Preview interactions
    ├── audit.js  # Flow coaching
    ├── export.js # YAML / HTML / Marp / PPTX
    ├── events.js # Toolbar + editor events
    └── utils.js  # Helpers
```

State autosaves to `localStorage` key `presentation-sage`.

---

## Flow auditor

The coaching panel (click **Audit** in the toolbar) checks:

- Bullet count per slide (flags anything over 5)
- Word count per bullet (flags bullets over 10 words)
- Slides with no pause or interaction point in a long run
- Missing CTA on the final slide
- First slide not of type `title`

Warnings appear inline. Fix them or dismiss them — the deck still exports either way.

---

<div align="center">
  <sub>Part of <a href="https://neorgon.com">Neorgon</a></sub>
</div>
