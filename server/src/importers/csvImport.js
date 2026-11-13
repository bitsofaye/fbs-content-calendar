// Reads a CSV of content (one post per row) into normalized post objects.
// Pure: no database access, so it can run as a preview before anything is saved.
//
// The first row must have the REQUIRED_FIELDS headings (cells may be empty, except Topic). Headings are
// matched by name (case, spaces and punctuation don't matter); extra columns are ignored, so the Content plan's
// "Export CSV" file can be imported back as is.

import { canonicalPillar, mapPlacements, mapStatus, splitCaption, toISODate } from './fbsWorkbook.js';

const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const clean = (s) => String(s ?? '').replace(/\r\n?/g, '\n').trim();

// field -> header names that are accepted for it (compared with norm())
export const CSV_COLUMNS = [
  { field: 'title', required: true, label: 'Topic', aliases: ['topic', 'title', 'topic/title', 'topic / post', 'post', 'post title', 'content', 'content idea', 'subject'] },
  { field: 'date', label: 'Date', aliases: ['date', 'posting date', 'post date', 'publish date', 'schedule', 'scheduled date'] },
  { field: 'time', label: 'Time', aliases: ['time', 'posting time', 'post time'] },
  { field: 'pillar', label: 'Pillar / Service', aliases: ['pillar / service', 'pillar', 'service', 'category', 'content pillar', 'service/pillar'] },
  { field: 'platforms', label: 'Platforms', aliases: ['platforms', 'platform', 'placements', 'placement', 'channels', 'channel', 'channel 1', 'channel 2', 'channel 3', 'channel 4'], multi: true },
  { field: 'status', label: 'Status', aliases: ['status'] },
  { field: 'type', label: 'Type', aliases: ['type', 'post type', 'kind', 'organic / ad'] },
  { field: 'approver', label: 'Approver', aliases: ['approver', 'approved by', 'reviewer'] },
  { field: 'format', label: 'Format', aliases: ['format', 'pubmat type', 'pubmats type', 'pubmats', 'content type'] },
  { field: 'storyboard', label: 'Story board', aliases: ['story board', 'storyboard', 'content story board', 'description'] },
  { field: 'graphicsIdea', label: 'Graphics idea', aliases: ['graphics idea', 'graphic idea', 'visual'] },
  { field: 'titleDraft', label: 'Title draft', aliases: ['title draft', 'thumbnail', 'title / thumbnail', 'headline'] },
  { field: 'caption', label: 'Caption', aliases: ['caption', 'caption + hashtags', 'copy', 'post copy'] },
  { field: 'hashtags', label: 'Hashtags', aliases: ['hashtags', 'hashtag'] },
  { field: 'pubmatLinks', label: 'Pubmat links', aliases: ['pubmat links', 'pubmat link', 'pubmats link', 'pubmat', 'link', 'links', 'file link'] },
  { field: 'referenceLink', label: 'Reference link', aliases: ['reference link', 'reference', 'inspiration'] },
  { field: 'remarks', label: 'Remarks', aliases: ['remarks', 'notes', 'note', 'comments / remarks'] },
  { field: 'reacts', label: 'Reacts', aliases: ['reacts', 'reactions', 'likes'] },
  { field: 'comments', label: 'Comments', aliases: ['comments'] },
  { field: 'shares', label: 'Shares', aliases: ['shares', 'share'] },
  { field: 'reach', label: 'Reach', aliases: ['reach'] },
  { field: 'engagement', label: 'Engagement', aliases: ['engagement', 'engagements'] },
  { field: 'linkClicks', label: 'Link clicks', aliases: ['link clicks', 'clicks'] },
  { field: 'feedback', label: 'Feedback', aliases: ['feedback', 'rating'] },
];
// headings every file must have (the cells may be empty, except Topic)
export const REQUIRED_FIELDS = ['date', 'time', 'pillar', 'title', 'type', 'platforms', 'status', 'approver', 'format', 'storyboard', 'caption', 'hashtags', 'pubmatLinks', 'remarks'];
const IGNORED = new Set(['day', 'weekday', 'week', 'no', '#']);

// ---------- CSV text -> rows (RFC 4180: quotes, "" escapes, line breaks inside quotes) ----------
export function parseCsvText(text) {
  let s = String(text ?? '');
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1); // Excel's BOM
  // the separator is whichever of , ; or tab appears most in the heading row
  const nl = s.search(/\r?\n/);
  const firstLine = nl === -1 ? s : s.slice(0, nl);
  const counts = { ',': 0, ';': 0, '\t': 0 };
  let inQ = false;
  for (const ch of firstLine) {
    if (ch === '"') inQ = !inQ;
    else if (!inQ && ch in counts) counts[ch]++;
  }
  const [best, bestCount] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  const delim = bestCount > 0 ? best : ',';

  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"') {
        if (s[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

// "February 3, 2026", "3 Feb 2026", "2026-02-03", "02/03/2026" (month first) -> "2026-02-03"
function toDate(raw) {
  const s = clean(raw);
  if (!s) return { date: null };
  const iso = toISODate(s);
  if (iso) return { date: iso };
  const t = Date.parse(s.replace(/(\d)(st|nd|rd|th)\b/gi, '$1'));
  if (!Number.isNaN(t) && /\d{4}/.test(s)) {
    const d = new Date(t);
    return { date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` };
  }
  return { date: null, bad: s };
}

function toTime(raw) {
  const s = clean(raw).toLowerCase();
  if (!s) return null;
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!m) return undefined;
  let h = Number(m[1]);
  if (m[3] === 'pm' && h < 12) h += 12;
  if (m[3] === 'am' && h === 12) h = 0;
  if (h > 23) return undefined;
  return `${String(h).padStart(2, '0')}:${m[2] || '00'}`;
}

function toInt(raw) {
  const s = clean(raw).replace(/,/g, '');
  if (!s) return null;
  return /^\d+(\.\d+)?$/.test(s) ? Math.round(Number(s)) : undefined;
}

const FEEDBACK = { excellent: 'EXCELLENT', verygood: 'GOOD', good: 'GOOD', bad: 'BAD', poor: 'BAD' };

export function parseContentCsv(text) {
  const table = parseCsvText(text);
  if (!table.length) throw new Error('The file is empty.');
  const header = table[0].map((h) => clean(h));

  // match each header to a field
  const colsFor = {};
  const unknownHeaders = [];
  header.forEach((h, i) => {
    const key = norm(h);
    if (!key) return;
    const col = CSV_COLUMNS.find((c) => c.aliases.some((a) => norm(a) === key));
    if (col) {
      if (!colsFor[col.field]) colsFor[col.field] = [];
      if (col.multi || colsFor[col.field].length === 0) colsFor[col.field].push(i);
    } else if (!IGNORED.has(key)) unknownHeaders.push(h);
  });
  const missing = REQUIRED_FIELDS.filter((f) => !colsFor[f]).map((f) => CSV_COLUMNS.find((c) => c.field === f).label);
  if (missing.length) {
    throw new Error(
      `Missing heading${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}. The first row must have: ${REQUIRED_FIELDS.map((f) => CSV_COLUMNS.find((c) => c.field === f).label).join(', ')} (columns may be empty, except Topic).`,
    );
  }

  const posts = [];
  const warnings = [];
  const skipped = [];
  const seen = new Map();
  const get = (r, field) => (colsFor[field] ? clean(r[colsFor[field][0]]) : '');

  table.slice(1).forEach((r, idx) => {
    const line = idx + 2; // spreadsheet row number (header is row 1)
    const warn = (message) => warnings.push({ sheet: 'CSV', row: line, message });
    const title = get(r, 'title');
    if (!title) {
      if (r.some((c) => clean(c))) skipped.push({ row: line, reason: 'no topic' });
      return;
    }

    const { date, bad } = toDate(get(r, 'date'));
    if (bad) warn(`Date "${bad}" was not understood — the post was put in the Idea bank. Use YYYY-MM-DD, e.g. 2026-02-03.`);

    let time = toTime(get(r, 'time'));
    if (time === undefined) { warn(`Time "${get(r, 'time')}" was not understood (use 09:00 or 9:00 AM).`); time = null; }

    const st = mapStatus(get(r, 'status'));
    if (st.unknown) warn(`Unknown status "${st.unknown}" — set to ${date ? 'In progress' : 'Idea'}.`);
    const status = st.status || (date ? 'IN_PROGRESS' : 'IDEA');

    const pl = mapPlacements((colsFor.platforms || []).map((i) => String(r[i] ?? '').replace(/[;|]/g, ',')));
    if (pl.unknown.length) warn(`Unknown platform(s): ${pl.unknown.join(', ')}.`);

    const typeKey = norm(get(r, 'type'));
    const kind = ['ad', 'ads', 'paidad', 'sponsored', 'advertisement'].includes(typeKey) ? 'AD' : 'ORGANIC';
    const boost = typeKey === 'boosted' ? 'BOOSTED' : typeKey === 'paid' ? 'PAID' : 'ORGANIC';

    let caption = get(r, 'caption') || null;
    let hashtags = get(r, 'hashtags') || null;
    if (caption && !hashtags) ({ caption, hashtags } = splitCaption(caption));

    const metrics = {};
    for (const f of ['reacts', 'comments', 'shares', 'reach', 'engagement', 'linkClicks']) {
      const v = toInt(get(r, f));
      if (v === undefined) warn(`"${get(r, f)}" in ${CSV_COLUMNS.find((c) => c.field === f).label} is not a number — left empty.`);
      metrics[f] = v ?? null;
    }
    const fbKey = norm(get(r, 'feedback'));
    const feedback = Object.entries(FEEDBACK).find(([k]) => fbKey.startsWith(k))?.[1] ?? null;

    // key that makes re-importing the same row a no-op
    const base = `csv:${date || 'idea'}:${norm(title).slice(0, 150)}`;
    const n = (seen.get(base) || 0) + 1;
    seen.set(base, n);

    posts.push({
      source: 'CSV',
      importSource: n > 1 ? `${base}#${n}` : base,
      line,
      kind,
      boost,
      date,
      time,
      title: title.slice(0, 500),
      status,
      placements: pl.placements,
      pillarName: canonicalPillar(get(r, 'pillar')),
      approverName: get(r, 'approver') || null,
      format: get(r, 'format') || null,
      storyboard: get(r, 'storyboard') || null,
      graphicsIdea: get(r, 'graphicsIdea') || null,
      titleDraft: get(r, 'titleDraft') || null,
      caption,
      hashtags,
      pubmatLinks: get(r, 'pubmatLinks').split(/[\s,]+/).filter((u) => /^https?:\/\//i.test(u)).slice(0, 30),
      referenceLink: get(r, 'referenceLink') || null,
      remarks: get(r, 'remarks') || null,
      ...metrics,
      feedback,
    });
  });

  return {
    posts,
    warnings,
    skipped,
    columnsFound: CSV_COLUMNS.filter((c) => colsFor[c.field]).map((c) => c.label),
    unknownHeaders,
    summary: { total: posts.length, dated: posts.filter((p) => p.date).length, ideas: posts.filter((p) => !p.date).length },
  };
}
