/* ═══════════════════════════════════════════════════════════════════════════
   Export receipt: checks on the exported FILE, not the deck.

   One implementation, two callers. The browser runs it on the PPTX blob it is
   about to hand the visitor (Export → PowerPoint shows the result as a
   receipt); check-exports.mjs runs the same functions from Node over `unzip`.
   They share this module so the receipt a visitor sees and the CLI a build
   runs cannot disagree, the same invariant validate.mjs keeps with parser.js.

   DOM-free on purpose. The zip comes in through a tiny adapter:
     { names(): string[],                     every member path in the archive
       text(member): Promise<string>,         member decoded as text
       head(member, n): Promise<string> }     first n BYTES as a latin1 string
   Findings use validate.mjs levels: `warn` is a defect in the file, `info` is
   an observation a human should judge.
═══════════════════════════════════════════════════════════════════════════ */

const EMU = 914400;

/* ── Strings the author typed. If it is in the deck it must be in the file. ──
   Configuration keys name a renderer, a file or a knob and are never echoed as
   text, so they are skipped. */
export function deckStrings(node, out = []) {
  if (typeof node === 'string') {
    const t = node.trim();
    // Skip paths, URLs and anything too short to be distinctive
    if (t.length >= 4 && !/^[.\/]|^https?:|^data:|^#[0-9a-f]{3,8}$/i.test(t)) out.push(t);
  } else if (Array.isArray(node)) {
    node.forEach(n => deckStrings(n, out));
  } else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (k.startsWith('logo')) continue;
      if (['type', 'src', 'background', 'pattern', 'theme', 'language',
           'fit', 'side', 'style', 'state', 'align', 'classification',
           /* deck metadata: recorded for the audit, never rendered on a slide */
           'audience', 'outcome', 'duration', 'big_idea'].includes(k)) continue;
      deckStrings(v, out);
    }
  }
  return out;
}

/* `yes` / `no` / `partial` are a matrix vocabulary that renders as ✓ ✕ –, so
   the literal word is absent by design. */
const GLYPH_WORDS = new Set(['yes', 'no', 'partial', 'true', 'false']);
// XML escapes and splits runs, so compare on letters and digits only
const flat = (s) => s.replace(/&[a-z]+;/g, ' ').replace(/[^a-z0-9]/gi, '').toLowerCase();

/**
 * Inspect one PPTX. `deck` is the YAML's `presentation` object (or null to
 * skip the strings check). Returns { findings: [{file, msg, level}], facts }.
 */
export async function inspectPptx(zip, deck, fileName = 'deck.pptx') {
  const findings = [];
  const note = (msg) => findings.push({ file: fileName, msg, level: 'warn' });
  const observe = (msg) => findings.push({ file: fileName, msg, level: 'info' });
  const names = zip.names();
  const slideXml = names.filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => +a.match(/(\d+)/)[1] - +b.match(/(\d+)/)[1]);
  const noteXml = names.filter(n => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(n));
  const media = names.filter(n => /^ppt\/media\/\S+\.(png|jpe?g|svg)$/i.test(n));

  const facts = {
    slides: slideXml.length, textRuns: 0, notes: 0, media: media.length,
    mediaOk: 0, strings: 0, missing: 0, pageIn: null,
  };

  /* ── The bytes are what the extension claims, and nothing personal ───── */
  for (const member of media) {
    const head = await zip.head(member, 8);
    const isPng = head.startsWith('\x89PNG');
    const isJpg = head.charCodeAt(0) === 0xff && head.charCodeAt(1) === 0xd8;
    const isSvg = /^\s*<(\?xml|svg)/.test(head);
    const ext = member.split('.').pop().toLowerCase();
    let ok = true;
    if (ext === 'png' && !isPng) { ok = false; note(`${member} is not a PNG (starts "${head.trim().slice(0, 12)}"). PowerPoint 2013, Keynote, LibreOffice and Google Slides will draw a broken image.`); }
    if ((ext === 'jpg' || ext === 'jpeg') && !isJpg) { ok = false; note(`${member} is not a JPEG.`); }
    if (ext === 'svg' && !isSvg) { ok = false; note(`${member} is not an SVG.`); }
    if (ok) facts.mediaOk++;
  }

  const slides = [];
  for (const member of slideXml) {
    const xml = await zip.text(member);
    slides.push({ member, xml });
    const leak = xml.match(/(\/Users\/[^"<\s]+|\/home\/[^"<\s]+|[A-Z]:\\\\[^"<\s]+)/);
    if (leak) note(`${member} contains a local filesystem path: ${leak[1].slice(0, 60)}. It discloses the author's machine and is not portable.`);
    facts.textRuns += (xml.match(/<a:t>[^<]/g) || []).length;
  }
  const notes = [];
  for (const member of noteXml) {
    const xml = await zip.text(member);
    notes.push(xml);
    /* A notes part that holds only the slide number is the bug that shipped
       for months; count a note only when a run carries real text. */
    const runs = (xml.match(/<a:t>([^<]+)<\/a:t>/g) || []).map(r => r.replace(/<\/?a:t>/g, '').trim());
    if (runs.some(r => r && !/^\d+$/.test(r))) facts.notes++;
  }

  /* ── Box arithmetic: nothing off the page, no two text runs on one band ── */
  const pres = names.includes('ppt/presentation.xml') ? await zip.text('ppt/presentation.xml') : '';
  const size = pres.match(/sldSz\s+cx="(\d+)"\s+cy="(\d+)"/);
  if (size) {
    const pageW = +size[1] / EMU, pageH = +size[2] / EMU;
    facts.pageIn = `${+pageW.toFixed(2)} x ${+pageH.toFixed(3)}`;
    const sparse = [], overlaps = [];
    for (const { member, xml } of slides) {
      const boxes = [];
      for (const sp of xml.matchAll(/<p:(sp|pic)>([\s\S]*?)<\/p:\1>/g)) {
        const inner = sp[2];
        const off = inner.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/>/);
        if (!off) continue;
        boxes.push({
          x: +off[1] / EMU, y: +off[2] / EMU, w: +off[3] / EMU, h: +off[4] / EMU,
          hasText: /<a:t>[^<]/.test(inner), isPic: sp[1] === 'pic',
        });
      }
      if (!boxes.length) continue;
      for (const b of boxes) {
        const right = b.x + b.w, bottom = b.y + b.h;
        if (b.x < -0.01 || b.y < -0.01 || right > pageW + 0.01 || bottom > pageH + 0.01) {
          note(`${member}: a shape runs off the page (${b.x.toFixed(2)},${b.y.toFixed(2)} ${b.w.toFixed(2)}x${b.h.toFixed(2)} on ${pageW}x${pageH}in).`);
          break;
        }
      }
      for (let a = 0; a < boxes.length; a++) {
        for (let b = a + 1; b < boxes.length; b++) {
          const A = boxes[a], B = boxes[b];
          // Only two pieces of text colliding; text over a shape is deliberate.
          if (!A.hasText || !B.hasText) continue;
          const ox = Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x);
          const oy = Math.min(A.y + A.h, B.y + B.h) - Math.max(A.y, B.y);
          if (ox > 0.05 && oy > 0.05) {
            overlaps.push(`${member.match(/slide(\d+)/)[1]} (${oy.toFixed(2)}in)`);
            a = boxes.length;   // one report per slide is enough
            break;
          }
        }
      }
      // How much of the page the content actually uses. A deck that stops
      // two-thirds up reads as unfinished rather than spacious.
      const content = boxes.filter(b => b.y + b.h < pageH - 0.35);   // exclude the rail band
      if (content.length > 2) {
        const maxBottom = Math.max(...content.map(b => b.y + b.h));
        if (maxBottom < pageH * 0.70) sparse.push(member.match(/slide(\d+)/)[1]);
      }
    }
    if (overlaps.length) note(`text boxes overlap on slide(s) ${overlaps.join(', ')}. Two runs printed on the same band read as one smudged line.`);
    if (sparse.length) observe(`${sparse.length} slide(s) use less than 70% of the page height (${sparse.join(', ')}). Layouts are top-anchored at a fixed pitch, so a slide with fewer items than the maximum leaves the rest blank.`);
  }

  /* ── No string left behind ───────────────────────────────────────────── */
  if (deck) {
    const wanted = [...new Set(deckStrings(deck))];
    const hay = [...slides.map(s => s.xml), ...notes].join('\n');
    if (hay) {
      const flatHay = flat(hay);
      const checked = wanted.filter(w => w.length >= 6 && !GLYPH_WORDS.has(w.toLowerCase()));
      const missing = checked.filter(w => !flatHay.includes(flat(w)));
      facts.strings = checked.length;
      facts.missing = missing.length;
      if (missing.length) {
        const shown = missing.slice(0, 6).map(m => `"${m.slice(0, 48)}"`).join(', ');
        note(`${missing.length} authored string(s) never reach the PPTX: ${shown}${missing.length > 6 ? ' …' : ''}`);
      }
    }
  }

  return { findings, facts };
}

/** Adapter over a JSZip instance (browser). */
export function zipFromJSZip(z) {
  const names = Object.keys(z.files).filter(n => !z.files[n].dir);
  return {
    names: () => names,
    text: (m) => z.file(m).async('string'),
    head: async (m, n) => {
      const bytes = new Uint8Array(await z.file(m).async('arraybuffer')).slice(0, n);
      return String.fromCharCode(...bytes);
    },
  };
}
