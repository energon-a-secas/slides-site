/* ═══════════════════════════════════════════════════════════════════════════
   markdown-import.js: Marp / CommonMark markdown into the deck object.

   The front door for "markdown to powerpoint": paste a Marp or CommonMark
   deck, get the YAML contract the player already renders, exports and audits.
   The audit still runs afterward, so a weak heading is caught the same way it
   is for a hand-written deck; conversion is mechanical, judgement stays with
   deckcraft.

   Pure and DOM-free: returns { deck, warnings }. The browser dumps `deck` to
   YAML with the global js-yaml; the Node test imports js-yaml itself. Slides
   split on a line of --- (Marp's page break), which is also YAML front-matter's
   delimiter, so the leading ---...--- block is read as front matter first.
═══════════════════════════════════════════════════════════════════════════ */

const HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const BULLET  = /^\s*[-*+]\s+(.+)$/;
const ORDERED = /^\s*\d+[.)]\s+(.+)$/;
const IMAGE   = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/;
const FENCE   = /^\s*```(\w*)\s*$/;

function splitFrontMatter(md) {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  return m ? [m[1], md.slice(m[0].length)] : [null, md];
}

function parseFrontMatter(text) {
  const meta = {};
  if (!text) return meta;
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim().replace(/^["']|["']$/g, '');
    if (['title', 'subtitle', 'author', 'date'].includes(key) && val) meta[key] = val;
  }
  return meta;
}

function splitSlides(body) {
  const slides = [[]];
  for (const line of body.split(/\r?\n/)) {
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) slides.push([]);
    else slides[slides.length - 1].push(line);
  }
  return slides.map(s => s.join('\n').trim()).filter(Boolean);
}

function parseTable(lines) {
  const i = lines.findIndex(l => l.includes('|'));
  if (i === -1) return null;
  const sep = lines[i + 1];
  if (!sep || !/-/.test(sep) || !/^\s*\|?[\s:|-]+\|?\s*$/.test(sep)) return null;
  const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
  const columns = cells(lines[i]);
  const rows = [];
  for (let j = i + 2; j < lines.length && lines[j].includes('|'); j++) rows.push(cells(lines[j]));
  return rows.length ? { columns, rows } : null;
}

function classify(text, warnings, isFirst) {
  const lines = text.split(/\r?\n/);
  let heading = null;
  const rest = [];
  for (const line of lines) {
    const h = line.match(HEADING);
    if (h && heading === null) heading = h[2].trim();
    else rest.push(line);
  }
  const body = rest.join('\n').trim();

  // Fenced code
  const fi = rest.findIndex(l => FENCE.test(l));
  if (fi !== -1) {
    const lang = (rest[fi].match(FENCE) || [])[1] || '';
    const code = [];
    for (let i = fi + 1; i < rest.length && !FENCE.test(rest[i]); i++) code.push(rest[i]);
    const s = { type: 'code', code: code.join('\n') };
    if (heading) s.heading = heading;
    if (lang) s.language = lang;
    return s;
  }

  // Table
  const tbl = parseTable(rest);
  if (tbl) {
    const s = { type: 'table', columns: tbl.columns, rows: tbl.rows };
    if (heading) s.heading = heading;
    return s;
  }

  // Blockquote
  if (rest.some(l => /^\s*>/.test(l))) {
    const q = rest.filter(l => /^\s*>/.test(l)).map(l => l.replace(/^\s*>\s?/, '')).join(' ').trim();
    let quote = q, source;
    const sm = q.match(/\s+(?:—|--?)\s+([^—]+)$/);
    if (sm) { source = sm[1].trim(); quote = q.slice(0, sm.index).trim(); }
    const s = { type: 'quote', text: quote };
    if (source) s.source = source;
    if (heading) warnings.push(`Quote slide dropped its heading "${heading}"; quote slides carry no heading.`);
    return s;
  }

  // Image-only slide
  const imgLine = rest.find(l => IMAGE.test(l) && l.trim().replace(IMAGE, '').trim() === '');
  if (imgLine) {
    const im = imgLine.match(IMAGE);
    const s = { type: 'image', src: im[2], alt: im[1] || 'image' };
    if (heading) s.heading = heading;
    const caption = rest.filter(l => l.trim() && l !== imgLine && !HEADING.test(l)).join(' ').trim();
    if (caption) s.caption = caption;
    return s;
  }

  // Bullets
  const bullets = [];
  for (const l of rest) {
    const b = l.match(BULLET) || l.match(ORDERED);
    if (b) bullets.push(b[1].trim());
  }
  if (bullets.length) {
    const s = { type: 'bullets', bullets };
    if (heading) s.heading = heading;
    else { s.heading = 'Slide'; warnings.push('A bullets slide had no heading; used "Slide". Give it a claim.'); }
    return s;
  }

  // First slide with only a heading (+ maybe one line): a title
  if (isFirst && heading) {
    const s = { type: 'title', heading };
    const sub = body.split('\n').map(l => l.trim()).find(Boolean);
    if (sub) s.subtitle = sub;
    return s;
  }

  // Heading + prose: paragraphs become bullets
  if (heading && body) {
    const paras = body.split(/\n{2,}/).map(p => p.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
    return { type: 'bullets', heading, bullets: paras };
  }
  if (heading) return { type: 'divider', heading };
  warnings.push('A slide had no heading or usable content and was skipped.');
  return null;
}

export function markdownToDeck(md) {
  const warnings = [];
  const [fm, body] = splitFrontMatter(md || '');
  const meta = parseFrontMatter(fm);
  const slides = [];
  splitSlides(body).forEach((t, i) => {
    const s = classify(t, warnings, i === 0);
    if (s) slides.push(s);
  });
  if (!slides.length) warnings.push('No slides found. Separate slides with a line of --- as Marp does.');

  let title = meta.title;
  if (!title) {
    const t = slides.find(s => s.type === 'title');
    title = (t && t.heading) || (slides[0] && slides[0].heading) || 'Imported deck';
  }
  const presentation = { title };
  if (meta.subtitle) presentation.subtitle = meta.subtitle;
  if (meta.author) presentation.author = meta.author;
  if (meta.date) presentation.date = meta.date;
  presentation.slides = slides;
  return { deck: { presentation }, warnings };
}
