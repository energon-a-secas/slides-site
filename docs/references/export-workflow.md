# Export Workflow (Level 2 reference)

> Moved verbatim from `CLAUDE.md` during a progressive-disclosure pass. Read this when
> the user wants to export a deck (PPTX, PDF, HTML, Reveal.js, GitHub Pages bundle, or gallery).

### PPTX (directly from the app)
Click **↓ PPTX** in the toolbar. Downloads a `.pptx` file you can open in Keynote or PowerPoint.

### PDF or hosted HTML (via Marp CLI)
1. Click **↓ Marp MD** to download the Markdown file.
2. Install once: `npm install -g @marp-team/marp-cli`
3. Export:
   ```bash
   marp slides.md --pdf          # PDF
   marp slides.md --html         # self-contained HTML
   marp slides.md --pptx         # PPTX via Marp (alternative to app export)
   ```

### Standalone HTML (from the app)
Click **↓ HTML**: downloads a self-contained HTML slideshow with keyboard navigation.

### Reveal.js HTML (for hosting)
Click **↓ Reveal.js**: downloads a polished HTML presentation using Reveal.js (CDN).
Features: transitions, touch/swipe, progress bar, slide numbers, speaker notes.

### GitHub Pages bundle
Click **↓ Bundle**: downloads a ZIP with `talk-slug/index.html` ready to unzip into a presentations repo.
Multiple talks live in one repo:
```
presentations/
├── index.html              ← gallery (export from Gallery panel)
├── quarterly-update/
│   └── index.html
└── product-launch/
    └── index.html
```
URLs become `you.github.io/presentations/quarterly-update/` etc.

### Gallery manager
Click **Gallery**: manage a registry of published talks (stored in localStorage).
Export a gallery `index.html` that links to all published presentations.
