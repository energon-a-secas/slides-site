# Brief: Round 8: logo stamp/size/placeholder

Started 2026-08-12 18:24. Maintained by the `task` skill; read by `debrief` and `writeup`.

## Problem

Round 8: logo stamp/size/placeholder

<!-- What was wrong *before*. The symptom someone actually experienced, not the
     absence of the solution. debrief opens its deck on this, so vagueness here
     costs a slide later. -->

## Approach

<!-- What you are doing, in a paragraph. -->

## Rejected

<!-- The alternative you considered and why it lost. Usually the most interesting
     thing in the brief, and the first thing forgotten. -->

## Decisions

<!-- Appended by: brief.sh note "<what you learned>" -->

- `2026-08-12 18:24` logo_pos/logo_size/placeholder shipped + verified (110px monogram on title, bottom-left stamp via computed styles, both bad-value warnings fire); pushed to slides-site

- `2026-08-12 23:02` stream **slides-contrast** done: WCAG check in parser.js validate(); verified CLI+browser; pushed as c6215cd via https workaround

- `2026-08-19 21:27` stream **deck-rail** done: footer:rail renders on every non-title slide; verified in player + Reveal fixed rail + Marp footer directive + PPTX bottom text. Decks that declare neither key are byte-identical to before.

- `2026-08-19 21:27` stream **agenda** done: agenda auto derives from divider headings; verified it read 2 dividers in the smoke deck and 2 in the starter template. Section eyebrow shows 1 of 2 / 2 of 2.

- `2026-08-19 21:27` stream **placeholder** done: image and media with no src render a labelled dashed frame; Marp emitted an empty ![]() until it was fixed to write the gap in words.

- `2026-08-19 21:27` stream **table** done: columns/rows/align/highlight/caption; PPTX uses a real a:tbl (verified by unzipping the generated file). Two CSS defects found by screenshot and fixed: the highlight bar repeated on every cell, and the caption floated away from the table.

- `2026-08-19 21:27` stream **grid** done: 2-4 columns, cards or plain, optional glyph; columns derived from item count when unset.

- `2026-08-19 21:27` stream **media** done: copy column beside a full-bleed figure, either side; rail padding handled per-type since the slide drops its own padding.

- `2026-08-19 21:27` PPTX could not be byte-verified through the browser: pptxgenjs writeFile never resolves in the preview sandbox and does not route its blob through URL.createObjectURL, so the intercept caught nothing. Verified instead by replaying the exact option shapes (addTable cell fills, dashed-line shapes, transparency) under node, which produced a 70,262-byte valid zip with 4 slide parts and a real <a:tbl> holding the cell text. The in-app export completes with no console error, but its toast fires without awaiting writeFile, so the toast alone is not evidence.

- `2026-08-19 21:27` House writing rule applied to new source strings: no em dashes in the audit messages or the Marp placeholder text, even though the surrounding parser.js messages use them. Deviating from the local file convention deliberately; smoke check 12 only scans Markdown, so nothing would have caught it.

- `2026-08-19 21:27` The agenda auto guard tripped on the starter template itself, which had a single divider. Fixed the template by giving it a real second section rather than weakening the check.

- `2026-08-19 21:51` stream **examples** done: 7 decks now live as files under deck-library/decks/, so 'node validate.mjs deck-library/decks' checks every example the library hands out (all 7 clean). 4 are new bases: exec review, design review, workshop (light theme), launch (the gradient one). Library page fetches them instead of holding escaped strings; added Copy YAML with an execCommand fallback after the Clipboard API refused on an unfocused document. 3 demo SVGs so image/media/logo show something real.

- `2026-08-19 21:51` stream **backgrounds** done: llms.txt hand-authored (marker removed; generator dry-run now lists it under 'hand-authored, left untouched') with a three-layer explanation of theme vs background vs pattern. The trap it documents is enforced: a slide background whose average hex luminance falls under 4.5:1 against the deck's text colour now warns with the ratio. Tripped it on a meadow deck with 'background: ocean' (1.1:1); launch.yaml with four gradients on a dark theme stays clean.

- `2026-08-19 21:51` Catalog panel added (js/catalog.js): live previews drawn by renderSlide itself so they cannot go stale, plus real gradient and pattern swatches that write the YAML key on click, scoped to the slide or the deck. Two defects found while building it: 'background: none' would have made a slide transparent rather than clearing the override, so 'clear' deletes the key; and one-shot rAF scaling left every preview unscaled when the panel opened in a zero-width viewport, so it observes the frames instead.

- `2026-08-19 21:59` Removed the crossed diagonals from the media placeholder at the user's request: they read as a callback to the source template's mockup frames. The frame is now a plain dashed panel with its label.

- `2026-08-19 22:18` stream **types-r10** done: matrix, people, checklist, compare, appendix across player + audit + Marp + PPTX + Reveal. Appendix is the structural one: page numbers switch to an A-series, the main count stops at the marker, and density plus flow checks read the main deck only. Verified by a 6-bullet backup slide in postmortem.yaml that passes clean and would warn in the talk.

- `2026-08-19 22:18` stream **cat-setup** done: Catalog now has nine sections: start from a deck, structures, types, gradients, patterns, theme, setup, brand, glyphs. Theme swatches switch the live preview and write theme:; setup fields write or clear deck keys; brand pickers write a nested brand: block and show the live ratio, red below threshold (caught 2.9:1 on text-on-accent during testing); glyphs insert at the cursor.

- `2026-08-19 22:18` stream **decks-r10** done: postmortem, onboarding, all-hands, qbr, conf-talk. All 12 decks validate clean and now live behind decks/index.json, a manifest shared by the library page and the Catalog so the two lists cannot disagree.

- `2026-08-19 22:18` Toolbar restructured at the user's request: 13 flat buttons became Theme, Catalog, Export menu, Publish menu, Audit/Overview/Present, and an overflow menu, on one delegated click handler so a new group needs no JS. The + Slide dropdown and the Sample button were the two places that duplicated lists; both now route through the Catalog and deck-library/decks, and the hardcoded sample deck in events.js is gone.

- `2026-08-19 22:18` Two export probes read false and were my test strings, not defects: I searched the postmortem export for labels that live in the skeletons. One real gap did surface that way: the Reveal checklist case dropped the item note that Marp keeps. Fixed.

- `2026-08-19 23:34` Two research subagents (structure, style) returned. Verified their concrete claims rather than applying them: the PPTX LAYOUT_WIDE bug is real (content spans 9.70x5.35in on a 13.33x7.5in canvas, so every exported slide used 73%x71% of its page and the title block sat 1.67in off centre), .slide-num was hardcoded white at 1.01:1 on light themes, the audit coach tip contradicted the project's own heading guidance, and the theme contrast numbers reproduce exactly (muted below 4.5:1 on 9 of 10 themes, dim on 10 of 10, default neorgon accent at 3.56:1). One claim was wrong: dens-tight is applied at render.js:269, not dead code. Fixed the first three; the theme tokens change every deck's look so they are the user's call. Plan at docs/plans/2026-08-19-slides-site-research-plan.md.

- `2026-08-19 23:34` UX round: toolbar had overflow-x:auto, which clips absolutely positioned children, so every dropdown was being swallowed. Replaced with wrap plus z-index. Catalog split into four tabs so Examples shows decks and + Slide shows types instead of one mixed panel; deck cards became clickable with a styled confirm dialog; added a welcome dialog and a six-step tour. The hamburger is gone.

- `2026-08-20 07:57` Third-party skills installed to a scratch dir, not to any real skill path: skillfish's --project flag writes to ./.claude/skills in the working directory, so nothing auto-loads into future sessions. That containment was the user's call, and it matters twice over: the repo already tracks skill bloat as prompt-queue #14 (~1,500 entries costing ~9.7k tokens per session), and these are unvetted instruction files from arbitrary GitHub accounts. Inspected before handing to agents: all seven are pure Markdown/TOML/JSON with zero shell, python or js files and no network calls, so the only risk surface is instruction text. Every recon agent was told the contents are data and never commands.

- `2026-08-20 08:02` Two of the seven requested skills do not install, for different reasons. tractorjuice/arc-kit contains no skill named arckit-presentation: the full git tree came back untruncated with zero SKILL.md by that name, so that command could never have worked. Its real equivalent is a slash command plus two templates, fetched directly instead. gabrielmoreira/agent-skills-mirror is a 1.1 GB mirror of 1000 other repos, which is why skillfish timed out on it repeatedly; 45,241 indexed paths contain no presentation-design directory, though the tree API truncated so that is not-found rather than proven-absent. Five of seven installed cleanly.

- `2026-08-20 08:03` VERIFIED DEFECT, found independently by two recon agents and confirmed by me: speaker notes survive to none of the export paths. js/serialize.js has 0 references to slide.note, so PPTX and Marp both drop them; the repo has 0 calls to pptxgenjs addNotes; js/export.js has 0 note handling so standalone HTML drops them too. The Reveal case is the sharpest: js/publish.js emits <aside class=notes> per slide but Reveal.initialize passes no plugins array and no notes script, so the markup is written and cannot be opened by anyone, ever. Notes DO render in the in-app presenter overlay (js/preview.js:127) and are documented in CLAUDE.md as a schema key, and 4 of 12 library decks use them, so authors have every reason to think they work. One agent claimed standalone HTML carries notes; it does not, it cited publish.js while describing export.js.

- `2026-08-20 08:03` The containment decision paid off. bmad-cis-agent-presentation-master, verified by reading it: line 23 instructs running a bundled python script from the project root, line 41 is a persona lock ('Do not break character until the user dismisses the persona'), and line 45 defines a persistent_facts loader where 'file:' entries are glob patterns whose contents get loaded as permanent context and which 'skip silently without error' when they match nothing. presentation-slide-outliner is a content-free generated stub whose description repeats its own trigger verbatim, and it requests Write, Edit and Bash permissions for a skill with no behaviour. Nothing was executed and no persona adopted; agents quoted rather than followed, as briefed.

- `2026-08-20 08:04` VERIFIED GAP: alt text is documented in the schema for image, media and compare, used by 5 of 12 library decks, and checked by nothing. js/parser.js contains zero occurrences of 'alt'. A deck can ship every image unlabelled and the audit stays silent. Cheap accessibility rule, one of the few concrete wins from the skill recon. Also verified: validate.mjs parses only --fresh, so there is no machine-readable output and no stable warning codes for CI to consume.

- `2026-08-20 08:04` Three recon agents now converge on NOT building a diagram or mermaid slide type, for reasons that survive checking: the one skill that shipped mermaid documents it as rendering blank in its own reference file, Marp has no built-in mermaid so that export path would degrade silently, pptxgenjs would need a raster which forfeits the editable-text property that makes --pptx worth having, and mermaid's parser breaks on accented characters, which matters because this author writes Spanish decks. That is four independent reasons pointing the same way, and it matches the earlier style research recommending against charts until there is a reason. Recorded so a future round does not re-litigate it.

- `2026-08-20 08:05` VERIFIED COUPLING: js/audit.js attaches its coaching tips by regex-matching the prose of js/parser.js's own warning strings, e.g. /bullets.*Aim for 5 or fewer/ and /Bullet d+: d+ words/. Rewording any warning silently unhooks its tip, with nothing failing. That is the strongest argument for giving every finding a stable code field, which also makes the audit greppable in CI. Also verified: stats is documented as 'up to 4 metrics' and timeline steps are documented as a sequence, and neither has a single rule in parser.js; 6 of the 21 slide types have no parser branch at all; and split/columns never validate that their columns are labelled, which is the exact flaw that made a competitor's own example deck unreadable.

- `2026-08-20 08:05` stream **skill-recon** done: 4 agents, 7 skills requested, 5 installed + 1 fetched by hand + 1 unavailable. Yield is low but real: 4 agents independently converged on the speaker-note export loss, 3 independently argued against building a mermaid/diagram type (its own authors document it as rendering blank, Marp has no built-in support, pptxgenjs would forfeit editable text, and mermaid's parser breaks on accented characters, which matters for Spanish decks). New verified gaps: alt text unchecked, audit tips coupled to warning prose by regex, stats/timeline limits documented but unenforced, unlabelled split columns. Two skills were worthless: one is a content-free generated stub requesting Write/Edit/Bash, the other a persona wrapper with a silent glob loader.

- `2026-08-20 08:06` Deck review, all verified by me against the files: standup.yaml presents 'None' and 'Need help with: [blocker]' as two bullets on the same slide, a contradiction a forker would present verbatim. conf-talk.yaml:83 closes with 'the link is on the last slide' while that CTA IS the last main slide and the file contains zero URLs, so the audience photographs a pointer to nothing. type: columns is used in ZERO of 112 slides, a shipped type the shop window never demonstrates. exec-review.yaml:49 labels a media slide 'Cost dashboard by service' over an asset whose own burned-in text reads 'Delivery latency' and 'events / day'. I wrote three of those four.

- `2026-08-20 08:06` BEST PRODUCT FINDING of the review round, verified: auto agendas throw away the sentence that carries the argument. js/render.js:235 maps dividers with .map(s2 => s2.heading || ''), producing bare strings, while the item renderer four lines below at 239-245 already accepts {label, text} and renders text as .agenda-text. In nine of twelve decks the actual claim lives in the divider's subtitle, not its heading. Mapping to { label: s2.heading, text: s2.subtitle } is one line and upgrades every auto agenda in the library from a table of contents to an argument. The capability is already built and simply never fed.

- `2026-08-20 08:06` Measured across the library: 48 content-slide headings produce 2 firm assertions. All 21 dividers, all 9 CTA headings and all 8 agenda headings are topic labels. That independently reproduces the 44-to-47-of-48 count from the two research agents last round, by a third method (hand classification with a stated rule). Three separate passes now agree, so the assertion-heading work is the best-evidenced item in the plan, and the library rewrite it implies is confirmed as its real cost.

- `2026-08-20 08:29` stream **review-agents** done: 3 agents: decks, UI, exports. The UI pass found five blockers I had shipped, all now fixed and verified in a browser: ?yaml= was decoded twice so five of twelve library decks opened an empty editor (URLSearchParams.get already decodes, and any lone % threw URIError); the Catalog sat at z-index 60 under a 200 header so three of four tabs and the close button were unclickable; the standalone HTML export read document.styleSheets[0], which is the cross-origin CDN reset, so it threw SecurityError and produced nothing while a stale toast read as success; every dialog rendered at 0,0 and 6% opaque because the global reset zeroed the margin that centres a modal dialog and --surface-2 is translucent; and the editor was a WCAG 2.1.2 keyboard trap because preventDefault ran before the Shift branch.

- `2026-08-20 08:29` Export integrity fixed and verified by unzipping generated files. E1: images are now real PNGs (file(1) reports 'PNG image data, 1600 x 1000' where it previously reported 'SVG Scalable Vector Graphics image' under a .png name); the serializer takes an optional resolveImage hook so the browser rasterises through a canvas and the CLI shells out to whatever is installed, and with no rasteriser it reports and skips rather than embedding a broken picture. E2: no /Users/ path appears in any of the 12 generated decks, and the PPTX alt-text field now carries the deck's real alt text. E3: dim composites to 3E4451 over the background instead of FFFFFF, so heading F9F9F9 > body CACACA > rail 3E4451 restores the hierarchy that had inverted. E4: notesSlide4.xml now carries the actual speaker note. E6: the Marp table band renders at the deck background instead of pure white, verified by sampling pixels in the rendered PDF.

- `2026-08-20 08:36` E5 done: the options that reached neither export now do. pageLabel moved into js/serialize.js as a pure function that render.js imports, so the player and both serializers cannot disagree about deck length; verified identical output on postmortem, player and PPTX both reading 11/11, Appendix, A1/A2, A2/A2. That also fixed a latent bug: the PPTX numbered pages with slides.indexOf(slide), which matches by object identity, so a deck using YAML anchors would have given every alias the first slide's number. Also wired: table align (14 right-aligned cells where exec-review declares them, and Markdown now emits ---: instead of always ---), matrix highlight, grid icon, agenda current, and the whole logo family including logo_all, logo_pos, logo_size and logo_stamp_size, which produced 12 media parts on design-review where the export previously carried none. Marp additionally suppresses pagination behind the appendix marker.

- `2026-08-20 08:36` Two bugs I introduced and caught before they shipped. A const arrow function (colAlign) was referenced two lines above its definition, which is a temporal dead zone throw rather than a hoisted function; node --check does not catch that, only reading the emitted order did. And render-deck.mjs took inputs[0] only, so passing three deck paths silently built one and ignored two: exactly the quiet failure this project's conventions forbid, found because a verification step looked for files that were never written. Both fixed, and the CLI now honours every input and errors on any missing one.

- `2026-08-20 08:44` check-exports.mjs written: four dependency-free checks over the built file rather than the deck (no string left behind, zip sanity, box arithmetic, theme colour ordering), with validate.mjs's exit convention so 0 covers clean-or-observations and 1 means a defect. It earned itself on first run by catching a miss of mine: checklist ITEM notes still never reached the PPTX after I fixed slide-level notes, which in postmortem.yaml meant 'platform, this sprint' and 'waiting on procurement' vanished two slides before a CTA asking who owns what. It also found the media placeholder label never reaching the export. Both fixed; the library now reports 0 defects.

- `2026-08-20 08:44` The checker's guards were verified by tripping them, not by trusting them: a hand-crafted pptx containing SVG bytes named .png, a /Users path in the slide XML, and a shape 20in wide on a 10in page produced exactly three findings and exit 1. Two of my own bugs surfaced in the process. Every deck was built into one shared temp directory and then checked against whichever export sorted last, which reported whole decks as having lost their own titles; each deck now builds into its own directory. And --help exited 2, so asking a tool for help failed a script. Both fixed.

- `2026-08-20 09:17` Tier 1 item 1 done: js/geometry.js measures whether content actually fits, which every density rule only approximates. It renders each slide offscreen at its real 960x540 size, waits for document.fonts.ready, and reports any of twelve clipping containers whose scrollHeight exceeds clientHeight. Verified by construction: a deck of five bullets under ten words each passes validate.mjs with zero warnings and the geometry pass reports the bullet list clipped by 96px; a 16-row table clips by 127px; a real 14-slide deck returns zero findings, so it does not cry wolf. It sits outside js/parser.js because validate() is shared with the CLI and must stay DOM-free, and validate.mjs now prints that geometry was not checked rather than implying a completeness it lacks.

- `2026-08-20 09:17` Wrote and then deleted a second geometry check in the same pass. The idea was a margin warning, content filling over 94% of the slide will clip on a machine with different font metrics, and the implementation was wrong twice: measured against an inner container it was pinned at 100% because those size to their own content, and measured against the slide it was pinned at 100% again because scrollHeight on a fixed-height flex box never falls below clientHeight. It called a two-bullet title slide full both times. Removed rather than tuned: a check that cries wolf gets switched off, and the real clip finding would go with it. The reasoning is recorded in the module header so nobody rebuilds it the same way.

- `2026-08-20 09:31` Assertion headings shipped, and the library rewritten in the same pass so the site does not hand out twelve examples that fail its own audit. 27 headings rewritten across 9 decks using only facts already on each slide: 'The quarter in three numbers' became 'Spend fell 31% while we served 4.2m requests a day', 'Timeline' became 'Eight minutes to detect, sixteen more to decide'. The three skeletons got their own placeholders promoted into the heading ('Problem' to '[Who] cannot [do what] today') so a template teaches the pattern rather than the filing system. Library now reports zero heading findings, and a deliberately label-headed deck still trips the rule on all five headings plus the aggregate.

- `2026-08-20 09:31` The verb heuristic misfired on my own improved headings before it ever reached a user: 'Spend fell 31%' and 'Two services account for most of the bill' were both counted as topic labels because my finite-verb list had 'falls' but not 'fell', and no entry for 'account'. Expanding the list is whack-a-mole, so the rule was narrowed instead: exact stoplist matches are named per slide, and the fuzzy half now only counts headings of three words or fewer with nothing verb-shaped in them. Lower recall, and honest about it: the research pass predicted this exact misfire, and a rule that is wrong about a good heading teaches the author to switch it off.

- `2026-08-20 09:40` Tier 1 items 3 and 4 shipped together, because BLUF is unenforceable without the fields. audience, outcome, duration and big_idea are optional deck keys; a deck declaring none behaves exactly as before. Three rules ride on them: minutes-per-slide (Alley 2005, counts the talk only since appendix slides consume no time), three-claims-not-five on a persuasion slide (Shu and Carlson 2014, shipped as info because it was tested on advertising claims rather than bullets), and answer-first for outcome: approve. Nine library decks now declare their room. The BLUF rule immediately fired on all three approval decks, exactly as the research predicted, with the ask landing at 89 to 91 percent.

- `2026-08-20 09:40` The BLUF rule is satisfied by stating the answer early, NOT by moving the cta forward: a deck still ends with what it wants, so a rule demanding the ask up front would be wrong. It looks for the declared big_idea in the first 40 percent of the talk and goes quiet when it finds it. exec-review, design-review and qbr were each restructured to open on a one-line statement of the recommendation before the agenda. Verified the guard is not toothless by rebuilding exec-review with that slide stripped out: the finding returns, naming 90 percent. Two of my own tools needed teaching afterwards: check-exports.mjs flagged the new metadata keys as content missing from the export, and the Catalog wrote duration as a quoted string that the parser's own type check would reject.

- `2026-08-20 09:50` Tier 2 partly done. relLuminance now parses rgba and composites over the background, which was the single line that made the muted and dim theme tokens unmeasurable and left CLAUDE.md's claim that the curated themes pass true only of text on bg. Theme token VALUES deliberately unchanged: altering them changes how every existing deck looks and that is the user's call. Storyline view added as a pure parser export, shown in the audit panel and behind validate.mjs --storyline; on exec-review it now reads as an argument rather than a table of contents, which is the clearest demonstration of the heading rewrite. Two cross-field rules added: a heading asserting a number absent from its own slide, and a section holding fewer than two slides. Chrome moved into the EBU R 95 graphics-safe band, 5 percent per edge, so the page number, logo stamp and rail no longer sit where a keystoned projector eats them.

- `2026-08-20 09:50` Three false positives in the new rules, each caught by running them over the library rather than trusting them. The number check split 14:02 into 14 and 02 so it missed the very value on the slide; times and decimals are now kept whole and bare one or two digit numbers dropped. It then fired on a divider whose evidence sits on the slides it introduces, so dividers, titles and appendix markers are exempt. And validate.mjs filtered only the flags it knew about, so --storyline was read as a file path: any leading dash is now a flag. Also queued iterator as prompt #26, the refinement-campaign skill distilled from this session.

- `2026-08-20 10:12` Tier 2 finished. Theme tokens raised after all: muted from 3.38-4.51 to 4.63-4.71 and dim from 1.65-2.00 to 3.11-3.19, computed per theme by binary search on the alpha rather than picked by hand, so each is the smallest change that clears the target. dim deliberately stops at 3:1 rather than 4.5 so the chrome stays quieter than the body, which is the hierarchy the PPTX export had inverted. Room-aware sizing added as an optional room key: unset fires nothing, desk clears everything, hall floors text at 21.6px and flags captions and subtitles. Chrome is exempt because a page number is not read from the back row.

- `2026-08-20 10:12` Corrupted js/state.js while applying the theme change and restored it from git. The bug: I computed regex match offsets against the original string, then sliced and reassembled that same string inside the loop, so every edit after the first wrote at a stale position and merged the tail of one theme into the head of the next. node --check still passed on the wreckage, which is why the real check was rereading the file. Redone line-wise with no offset arithmetic. The revert also cost the localStorage guard that makes state.js importable under Node, which had to be reapplied: nothing in this session is committed, so git checkout is a blunt instrument.

- `2026-08-20 10:27` Worked the remaining reviewer defects. D13 was my own regression: the documented Logo button lost its only caller in the toolbar restructure, so CLAUDE.md described a control that did not exist; it now lives in the Catalog's Setup tab beside the other deck identity fields. D14: the audit claimed to flag relative logo paths and did not, because the regex accepted a leading ./ which has exactly the problem the message describes. D12: the CSP blocked every remote image while the schema documents URL src and logo, so img-src now allows https while script-src stays untouched. D7: the caption band ran 0.15in into the footer rail on five slides, the title's date box ran under the page number, the rail's own classification overlapped the page number, and a quote slide's decorative mark overlapped its text by 0.60in. All four found by a new text-on-text overlap check in check-exports.mjs and all four fixed in the layout rather than by relaxing the check.

- `2026-08-20 10:27` The overlap check needed narrowing before it was worth anything. A naive box-intersection test fired on almost every slide, because pptxgenjs draws text on top of shapes by design: a timeline dot, a grid card, an initials circle are all a rect or ellipse with a run centred over it. Parsing per p:sp and requiring BOTH boxes to contain an a:t element cut it to four real collisions, every one of which was a genuine defect. Verified it still has teeth afterwards with a hand-built pptx containing two overlapping text runs.

- `2026-08-20 11:26` Lower-severity review items fixed and everything pushed. Filmstrip thumbnails are now buttons with role, tabindex, aria-label and Enter/Space; warnings, counter and stage carry live regions; the warnings bar gained a sticky count and scrolls instead of hiding findings silently; the workspace stacks below 900px, where the two panes had been 195px each; and Marp stats render as a side-by-side table row rather than a vertical list of small headings. One regression caught in a mobile screenshot before pushing: moving .slide-num into the graphics-safe band put it exactly where the title slide's date sat, so the two printed over each other in the player, the same collision class just fixed in PPTX. Three scoped commits, one per repo, staging only this session's files: the forge's in-progress penname work and the root repo's untracked screenshots were deliberately left alone.

## Measured

<!-- Numbers you actually observed, with how you got them. An estimate recorded
     here becomes a false claim on a slide, so mark estimates as estimates. -->

## Open

<!-- Deferred work, defects that shipped anyway, decisions left to the user.
     Never empty without a deliberate "nothing open" line. -->

---

## Run: 2026-08-19 21:11

**Problem.** Round 9: deck chrome (footer rail, classification, agenda, section progress) + three layout types (table, grid, media)

**Approach.**

Nine rounds in, the player renders 13 slide types and nothing that carries a deck's
identity across slides. Two gaps show up in every real work deck: there is no persistent
chrome (a deck-level note, a handling label, a page rail), and three of the most common
professional layouts have no type at all, so authors fake a table with a code block and a
comparison grid with a two-column split.

This round adds four pieces of deck chrome and three layout types:

- `footer:` and `classification:` render a bottom rail on every non-title slide, carrying
  the deck note on the left and the handling label plus slide number on the right. Per-slide
  `rail: false` opts out.
- `type: agenda`, either explicit `items:` or `auto: true`, which derives the agenda from the
  deck's own `divider` headings so it cannot drift from the deck it describes.
- Dividers gain an automatic "Section k of n" eyebrow when a deck has two or more of them.
- An `image` or `media` slide with no `src` renders a labelled placeholder frame instead of a
  broken image, so a deck can be structured before the assets exist.
- `type: table` (columns/rows/caption), `type: grid` (2 to 4 cards or plain columns with an
  optional glyph), and `type: media` (copy beside a full-bleed image, either side).

Parity: the player, standalone HTML and the Pages bundle all run through `renderSlide`, so
they come free. Reveal and Marp and PPTX are hand-mapped per type and get a correct but
simplified rendering, the same way patterns already degrade.

**Rejected.**

A generic `layout:` engine with author-defined regions instead of named types. It would
cover every future case in one feature, and it was rejected for the same reason the density
audit exists: the value of this player is that a type carries an opinion, and `validate()`
can only coach a deck it understands. A free-form region grid is a slide editor with extra
steps, and every audit rule would have to become a guess.

Also rejected: rendering the handling label as a corner watermark. A label that overlaps
content gets moved by the author, and a label that moves is one nobody trusts. The rail
gives it a fixed home.

**Measured.**

- 13 slide types before, 17 after. 868 insertions across 12 files.
- Starter template: 14 slides, 0 warnings, 0 notes from `node validate.mjs`, and every slide
  measured `scrollHeight - clientHeight <= 2` in the player, which is the geometry check the
  CLI explicitly cannot do.
- PPTX option shapes replayed under node: 70,262-byte zip, 4 slide parts, real `<a:tbl>`.
- Root `make smoke`: 32 passed, 0 failed, including check 12 (em dashes) and check 18
  (instruction files under 40k: CLAUDE.md is now the largest in the fleet at 37,917 chars,
  2,083 short of the warning).

**Open.**

- The in-app PPTX download was not byte-verified; see the decision note above for what was
  verified instead and why.
- Parked as prompt-queue #21 to #25: process/step cards, chart slides, org chart, timeline
  dates plus a milestone marker, and a print/handout stylesheet.
- Nothing is committed. The working tree holds the change.


_Closed 2026-08-19 21:31._

_Closed 2026-08-20 11:26._
