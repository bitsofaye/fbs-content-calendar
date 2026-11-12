// Parses the FBS Social Media Calendar workbook (.xlsx) into normalized post objects.
// Pure: no database access, so it can run as a dry-run preview anywhere.
//
// Sources (sheet names matched case-insensitively, trimmed):
//   "Content proposals"     → ORGANIC posts (main SMM stream)
//   "Contents for Approval" → ORGANIC posts (company / HR / events, with metrics)
//   "Ads for Approval"      → AD posts
//   "Contents"              → undated IDEA posts (idea bank)
// Month-grid sheets are intentionally ignored (they hold no 2026 data).

import ExcelJS from 'exceljs';

// ---------- value helpers ----------

export function isoFromDate(d) {
  return d.toISOString().slice(0, 10);
}

export function cellText(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return isNaN(v) ? '' : isoFromDate(v);
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map((r) => r.text).join('');
    if (v.text !== undefined) return cellText(v.text);
    if (v.result !== undefined) return cellText(v.result);
    if (v.hyperlink) return String(v.hyperlink);
    return '';
  }
  return String(v);
}

const clean = (s) => cellText(s).replace(/\r\n/g, '\n').trim();
const isFiller = (s) => /^-+$/.test(s.trim());

export function toISODate(v) {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return isNaN(v) ? null : isoFromDate(v);
  if (typeof v === 'number') {
    if (v > 20000 && v < 80000) return isoFromDate(new Date(Math.round((v - 25569) * 86400000)));
    return null;
  }
  if (typeof v === 'object') {
    if (v.result !== undefined) return toISODate(v.result);
    return null;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/); // MM/DD/YYYY
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  if (/^\d{5}(\.0+)?$/.test(s)) return toISODate(Number(s));
  return null;
}

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function toInt(v) {
  const s = clean(v).replace(/,/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return Math.round(Number(s));
}

// ---------- vocab mapping ----------

const STATUS_MAP = {
  idea: 'IDEA',
  inprogress: 'IN_PROGRESS',
  created: 'CREATED',
  edited: 'EDITED',
  toedit: 'TO_EDIT',
  forapproval: 'FOR_APPROVAL',
  editedforapproval: 'FOR_APPROVAL',
  approved: 'APPROVED',
  rejected: 'REJECTED',
  onhold: 'ON_HOLD',
  reschedule: 'RESCHEDULE',
  rescheduled: 'RESCHEDULE',
  scheduled: 'SCHEDULED',
  published: 'PUBLISHED',
  posted: 'PUBLISHED',
  completed: 'PUBLISHED',
  boosted: 'BOOSTED',
};

export function mapStatus(raw) {
  const s = clean(raw);
  if (!s || isFiller(s)) return { status: null };
  const key = norm(s);
  if (STATUS_MAP[key]) return { status: STATUS_MAP[key] };
  return { status: null, unknown: s };
}

const PLACEMENT_MAP = {
  facebookpost: 'FB_POST',
  facebook: 'FB_POST',
  facebookads: 'FB_POST',
  fbpost: 'FB_POST',
  instagrampost: 'IG_POST',
  instagram: 'IG_POST',
  igpost: 'IG_POST',
  linkedinpost: 'LINKEDIN_POST',
  linkedin: 'LINKEDIN_POST',
  fbreels: 'FB_REELS',
  facebookreels: 'FB_REELS',
  igreels: 'IG_REELS',
  instagramreels: 'IG_REELS',
  ytshorts: 'YT_SHORTS',
  youtubeshorts: 'YT_SHORTS',
  shorts: 'YT_SHORTS',
  youtubeclips: 'YT_CLIPS',
  ytclips: 'YT_CLIPS',
  youtubevideo: 'YT_VIDEO',
  youtube: 'YT_VIDEO',
  tiktok: 'TIKTOK',
  story: 'STORY',
  stories: 'STORY',
};

export function mapPlacements(values) {
  const out = new Set();
  const unknown = [];
  for (const raw of values) {
    for (const part of clean(raw).split(/[,\n/]+/)) {
      const p = part.trim();
      if (!p || isFiller(p)) continue;
      const code = PLACEMENT_MAP[norm(p)];
      if (code) out.add(code);
      else unknown.push(p);
    }
  }
  return { placements: [...out], unknown };
}

const FEEDBACK_MAP = { excellent: 'EXCELLENT', verygood: 'GOOD', good: 'GOOD', bad: 'BAD' };
function mapFeedback(raw) {
  const k = norm(raw);
  if (!k) return null;
  for (const [key, val] of Object.entries(FEEDBACK_MAP)) if (k.startsWith(key)) return val;
  return null;
}

// Pillar name aliases so the same pillar isn't created twice
const PILLAR_ALIASES = {
  fbs: 'FBS-Company',
  fbscompany: 'FBS-Company',
  lcss: 'Learning Center Solutions',
  lcs: 'Learning Center Solutions',
  web: 'Web Solutions',
  va: 'Virtual Assistance',
  accounting: 'Local Accounting',
  testimonialslcs: 'Testimonials-LCS',
};
export function canonicalPillar(name) {
  const s = clean(name);
  if (!s || isFiller(s)) return null;
  return PILLAR_ALIASES[norm(s)] || s;
}

// Guess an HR/E&A legend category for "Contents for Approval" rows
export function guessCompanyPillar(title) {
  const t = title.toLowerCase();
  if (/birthday|anniversary/.test(t)) return 'Birthday/Work Anniversary Postings';
  if (/fellowship/.test(t)) return 'Company Fellowships';
  if (/^lcs\b|lcs:|ojt|trainee|immersion|intern/.test(t)) return 'LCS Activities';
  if (/seminar|webinar|expo|job fair|career fest|jobfest|retreat|team ?building|outing|training|event|summit|conference/.test(t))
    return 'Company Events';
  if (/announcement|holiday|new year|christmas|greeting/.test(t)) return 'Company Announcements';
  if (/quote|devotion|motivation|engagement/.test(t)) return 'Marketing Engagement';
  if (/accounting|bookkeeping|tax/.test(t)) return 'Accounting';
  return null;
}

// "caption text ... #a #b #c" → { caption, hashtags }
export function splitCaption(text) {
  const s = clean(text);
  if (!s) return { caption: null, hashtags: null };
  const tokens = s.split(/(\s+)/); // keep whitespace tokens
  let i = tokens.length;
  while (i > 0) {
    const tok = tokens[i - 1];
    if (/^\s+$/.test(tok) || /^#[\p{L}\p{N}_]+$/u.test(tok)) i--;
    else break;
  }
  const tail = tokens.slice(i).join('').trim();
  const head = tokens.slice(0, i).join('').trim();
  if (!tail) return { caption: s, hashtags: null };
  return { caption: head || null, hashtags: tail };
}

function firstLine(text, max = 120) {
  const s = clean(text);
  if (!s) return '';
  const line = s.split('\n').map((l) => l.trim()).find(Boolean) || '';
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

function splitLinks(cellValue, hyperlink) {
  const out = [];
  if (hyperlink) out.push(String(hyperlink));
  const text = clean(cellValue);
  if (text && !isFiller(text)) {
    const urls = text.match(/https?:\/\/[^\s,]+/g);
    if (urls) urls.forEach((u) => out.push(u));
    else out.push(text);
  }
  return [...new Set(out)];
}

function joinNotes(parts) {
  const s = parts
    .map(([label, v]) => {
      const t = clean(v);
      if (!t || isFiller(t)) return null;
      return label ? `${label}: ${t}` : t;
    })
    .filter(Boolean)
    .join('\n\n');
  return s || null;
}

// ---------- sheet reading ----------

function findSheet(workbook, name) {
  const target = norm(name);
  return workbook.worksheets.find((ws) => norm(ws.name) === target) || null;
}

function rowValues(row, maxCol) {
  const vals = [];
  for (let c = 1; c <= maxCol; c++) {
    const cell = row.getCell(c);
    vals[c] = { value: cell.value, hyperlink: cell.hyperlink || (cell.value && cell.value.hyperlink) || null };
  }
  return vals;
}

/**
 * Generic table reader: detects (repeated) header rows, maps columns by label (falling back to defaults),
 * and calls onRow for every non-header row.
 */
function readTable(ws, { defaults, labels, isHeader, relative = {}, maxCol = 30 }, onRow) {
  let map = { ...defaults };
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const vals = rowValues(row, maxCol);
    const normed = vals.map((v) => (v ? norm(cellText(v.value)) : ''));
    if (isHeader(normed)) {
      const found = {};
      normed.forEach((h, col) => {
        if (!h) return;
        for (const [field, prefixes] of Object.entries(labels)) {
          if (found[field]) continue;
          if (prefixes.some((p) => h === p || h.startsWith(p))) {
            found[field] = col;
            break;
          }
        }
      });
      // unlabeled columns: position them next to a labeled neighbour (e.g. approver = status + 1)
      for (const [field, [anchor, offset]] of Object.entries(relative)) {
        if (!found[field] && found[anchor]) found[field] = found[anchor] + offset;
      }
      // remaining fields fall back to their default column, unless a detected field already owns it
      const used = new Set(Object.values(found));
      map = { ...found };
      for (const [field, col] of Object.entries(defaults)) {
        if (!(field in map) && !used.has(col)) map[field] = col;
      }
      return;
    }
    const get = (field) => (map[field] ? vals[map[field]] : { value: null, hyperlink: null });
    onRow({ get, rowNumber });
  });
}

function parseContentProposals(ws, ctx) {
  const sheet = ws.name.trim();
  readTable(
    ws,
    {
      defaults: {
        service: 2, date: 3, topic: 4, platforms: 5, status: 6, approver: 7, storyboard: 8, ideas: 9,
        pubmatLinks: 10, remarks: 11, format: 12, reference: 13, titleDraft: 14, caption: 15, notes: 16, finalContent: 17,
      },
      labels: {
        service: ['service'],
        date: ['date'],
        topic: ['topic'],
        platforms: ['platforms', 'platform'],
        status: ['status'],
        approver: ['approver'],
        storyboard: ['contentstoryboard', 'storyboard'],
        ideas: ['pubmatsideas'],
        pubmatLinks: ['pubmatslink', 'pubmatlink'],
        remarks: ['remarks'],
        format: ['pubmats'],
        reference: ['referencelink'],
        titleDraft: ['titledraft'],
        caption: ['captionandhastagsdraft', 'captionandhashtagsdraft'],
        finalContent: ['finalcontent'],
      },
      isHeader: (h) => h.includes('service') && h.includes('date') && h.includes('topic'),
      relative: { approver: ['status', 1], ideas: ['storyboard', 1], notes: ['caption', 1] },
    },
    ({ get, rowNumber }) => {
      const date = toISODate(get('date').value);
      if (!date) return;
      ctx.stats.rowsWithDate++;
      if (ctx.year && Number(date.slice(0, 4)) !== ctx.year) return;

      const topic = clean(get('topic').value);
      let storyboard = clean(get('storyboard').value);
      const captionRaw = clean(get('caption').value);
      const service = clean(get('service').value);
      let approver = clean(get('approver').value);
      // approver typed one column too far right (e.g. "Sir Carlo" in the Story Board column)
      if (!approver && /^(sir|ms\.?|mr\.?|mrs\.?|ma'?am)\s+[\p{L}]+$/iu.test(storyboard)) {
        approver = storyboard;
        storyboard = '';
      }
      const { status, unknown } = mapStatus(get('status').value);
      const links = splitLinks(get('pubmatLinks').value, get('pubmatLinks').hyperlink);
      if (!topic && !storyboard && !captionRaw && !status && !service && links.length === 0) {
        ctx.skip(sheet, rowNumber, 'empty row (only a date)');
        return;
      }
      if (unknown) ctx.warn(sheet, rowNumber, `Unknown status "${unknown}" → In progress`);
      const pl = mapPlacements([get('platforms').value]);
      if (pl.unknown.length) ctx.warn(sheet, rowNumber, `Unknown platform(s): ${pl.unknown.join(', ')}`);
      const { caption, hashtags } = splitCaption(captionRaw);
      const pillarName = canonicalPillar(service);
      const title = topic ? firstLine(topic, 200) : firstLine(storyboard) || firstLine(caption) || `${pillarName || 'Untitled'} post`;
      const format = clean(get('format').value);

      ctx.push({
        source: sheet,
        importSource: `${sheet}!r${rowNumber}`,
        kind: 'ORGANIC',
        date,
        title,
        status: status || 'IN_PROGRESS',
        boost: status === 'BOOSTED' ? 'BOOSTED' : 'ORGANIC',
        pillarName,
        placements: pl.placements,
        format: format && !isFiller(format) ? format : null,
        storyboard: storyboard || (topic.length > 200 ? topic : null),
        graphicsIdea: clean(get('ideas').value) || null,
        titleDraft: clean(get('titleDraft').value) || null,
        caption,
        hashtags,
        pubmatLinks: links,
        referenceLink: clean(get('reference').value) || null,
        remarks: joinNotes([
          ['', get('remarks').value],
          ['Reviewer notes', get('notes').value],
          ['Final content feedback', get('finalContent').value],
        ]),
        approverName: approver && !isFiller(approver) ? approver : null,
      });
    },
  );
}

function parseContentsForApproval(ws, ctx) {
  const sheet = ws.name.trim();
  readTable(
    ws,
    {
      defaults: {
        ch1: 2, ch2: 3, ch3: 4, ch4: 5, date: 6, status: 8, approver: 9, topic: 10, pubmat: 11, caption: 12, hashtags: 13,
        reacts: 14, comments: 15, shares: 16, reach: 17, engagement: 18, linkClicks: 19, feedback: 20, remarks: 21,
      },
      labels: {
        ch1: ['channel1'], ch2: ['channel2'], ch3: ['channel3'], ch4: ['channel4'],
        date: ['date'], status: ['status'], approver: ['approver'], topic: ['topicpost', 'topic'],
        pubmat: ['pubmat'], caption: ['caption'], hashtags: ['hashtags'], reacts: ['reacts'], comments: ['comments'],
        shares: ['share'], reach: ['reach'], engagement: ['engagement'], linkClicks: ['linkclicks'],
        feedback: ['feedback'], remarks: ['remarks'],
      },
      isHeader: (h) => h.includes('date') && h.includes('status') && h.some((x) => x.startsWith('topic')),
    },
    ({ get, rowNumber }) => {
      const date = toISODate(get('date').value);
      if (!date) return;
      ctx.stats.rowsWithDate++;
      if (ctx.year && Number(date.slice(0, 4)) !== ctx.year) return;

      const topic = clean(get('topic').value);
      const captionRaw = clean(get('caption').value);
      const { status, unknown } = mapStatus(get('status').value);
      const links = splitLinks(get('pubmat').value, get('pubmat').hyperlink);
      if (!topic && !captionRaw && !status && links.length === 0) {
        ctx.skip(sheet, rowNumber, 'empty row (only a date and channels)');
        return;
      }
      if (unknown) ctx.warn(sheet, rowNumber, `Unknown status "${unknown}" → In progress`);
      const pl = mapPlacements(['ch1', 'ch2', 'ch3', 'ch4'].map((k) => get(k).value));
      if (pl.unknown.length) ctx.warn(sheet, rowNumber, `Unmapped channel(s): ${pl.unknown.join(', ')}`);
      const split = splitCaption(captionRaw);
      const hashtags = clean(get('hashtags').value) || split.hashtags;
      const title = topic ? firstLine(topic, 200) : firstLine(split.caption) || 'Untitled company post';
      const pillarName = guessCompanyPillar(title) || guessCompanyPillar(captionRaw);
      if (!pillarName) ctx.warn(sheet, rowNumber, `No category guessed for "${title}" — set it after import`);
      const approver = clean(get('approver').value);

      ctx.push({
        source: sheet,
        importSource: `${sheet}!r${rowNumber}`,
        kind: 'ORGANIC',
        date,
        title,
        status: status || 'IN_PROGRESS',
        boost: status === 'BOOSTED' ? 'BOOSTED' : 'ORGANIC',
        pillarName,
        placements: pl.placements,
        format: null,
        storyboard: null,
        graphicsIdea: null,
        titleDraft: null,
        caption: split.caption,
        hashtags: hashtags || null,
        pubmatLinks: links,
        referenceLink: null,
        remarks: joinNotes([['', get('remarks').value]]),
        approverName: approver && !isFiller(approver) ? approver : null,
        reacts: toInt(get('reacts').value),
        comments: toInt(get('comments').value),
        shares: toInt(get('shares').value),
        reach: toInt(get('reach').value),
        engagement: toInt(get('engagement').value),
        linkClicks: toInt(get('linkClicks').value),
        feedback: mapFeedback(get('feedback').value),
      });
    },
  );
}

function parseAdCopy(text) {
  const s = clean(text);
  const pick = (label) => {
    const m = s.match(new RegExp(`${label}\\s*:\\s*([\\s\\S]*?)(?=\\n?\\s*(Headline|Description|CTA)\\s*:|$)`, 'i'));
    return m ? m[1].trim() : null;
  };
  return { headline: pick('Headline'), description: pick('Description'), cta: pick('CTA') };
}

function parseAds(ws, ctx) {
  const sheet = ws.name.trim();
  let adSetLabels = {};
  readTable(
    ws,
    {
      defaults: {
        service: 2, date: 3, topic: 4, platforms: 5, status: 6, approver: 7, pubmatLinks: 10, remarks: 11, format: 12,
        primaryText: 13, adCopy: 14, adSet1: 15, adSet2: 16, adSet3: 17, botcake: 18,
      },
      labels: {
        service: ['service'], date: ['date'], topic: ['topic'], platforms: ['platforms'], status: ['status'],
        approver: ['approver'], pubmatLinks: ['pubmatslink'], remarks: ['remarks'], format: ['pubmats'],
        primaryText: ['primarytext'], adSet1: ['targetingadset1'], adSet2: ['targetingadset2'], adSet3: ['targetingadset3'],
        botcake: ['botcake'],
      },
      isHeader: (h) => {
        const yes = h.includes('service') && h.includes('date') && h.includes('topic');
        if (yes) adSetLabels = {};
        return yes;
      },
      relative: { adCopy: ['primaryText', 1], adSet2: ['adSet1', 1], adSet3: ['adSet1', 2], approver: ['status', 1] },
    },
    ({ get, rowNumber }) => {
      const date = toISODate(get('date').value);
      const topic = clean(get('topic').value);
      const primaryText = clean(get('primaryText').value);
      if (!date && !topic && !primaryText) return; // empty template rows
      if (date) {
        ctx.stats.rowsWithDate++;
        if (ctx.year && Number(date.slice(0, 4)) !== ctx.year) return;
      }
      const { status, unknown } = mapStatus(get('status').value);
      if (unknown) ctx.warn(sheet, rowNumber, `Unknown status "${unknown}" → In progress`);
      const pl = mapPlacements([get('platforms').value]);
      const service = canonicalPillar(get('service').value);
      const copy = parseAdCopy(get('adCopy').value);
      const adSets = ['adSet1', 'adSet2', 'adSet3']
        .map((k, i) => ({ name: adSetLabels[k] || `Ad set ${i + 1}`, targeting: clean(get(k).value) }))
        .filter((a) => a.targeting);
      const approver = clean(get('approver').value);
      const title = topic ? firstLine(topic, 200) : firstLine(primaryText) || `${service || 'Ad'} campaign`;

      ctx.push({
        source: sheet,
        importSource: `${sheet}!r${rowNumber}`,
        kind: 'AD',
        date,
        title,
        status: status || 'IN_PROGRESS',
        boost: 'PAID',
        pillarName: service,
        placements: pl.placements,
        format: clean(get('format').value) || null,
        storyboard: null,
        graphicsIdea: null,
        titleDraft: null,
        caption: primaryText || null,
        hashtags: null,
        pubmatLinks: splitLinks(get('pubmatLinks').value, get('pubmatLinks').hyperlink),
        referenceLink: null,
        remarks: joinNotes([['', get('remarks').value]]),
        approverName: approver && !isFiller(approver) ? approver : null,
        adDetails: {
          primaryText: primaryText || null,
          headline: copy.headline,
          description: copy.description,
          cta: copy.cta,
          adSets,
          botcakeMessage: clean(get('botcake').value) || null,
        },
      });
    },
  );
}

function parseIdeaBank(ws, ctx) {
  const sheet = ws.name.trim();
  const headerRow = ws.getRow(1);
  const pillarsByCol = {};
  headerRow.eachCell((cell, col) => {
    const h = clean(cell.value);
    if (h && !/^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i.test(h)) pillarsByCol[col] = canonicalPillar(h);
  });
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    row.eachCell((cell, col) => {
      if (!pillarsByCol[col]) return;
      if (cell.isMerged && cell.master && cell.master.address !== cell.address) return; // merged copy
      const text = clean(cell.value).replace(/^"+|"+$/g, '').trim();
      if (!text || isFiller(text)) return;
      ctx.push({
        source: sheet,
        importSource: `${sheet}!${col}:${rowNumber}`,
        kind: 'ORGANIC',
        date: null,
        title: firstLine(text, 200),
        status: 'IDEA',
        boost: 'ORGANIC',
        pillarName: pillarsByCol[col],
        placements: [],
        format: null,
        storyboard: text.length > 200 ? text : null,
        graphicsIdea: null,
        titleDraft: null,
        caption: null,
        hashtags: null,
        pubmatLinks: [],
        referenceLink: null,
        remarks: null,
        approverName: null,
      });
    });
  });
}

const PARSERS = [
  { name: 'Content proposals', parse: parseContentProposals },
  { name: 'Contents for Approval', parse: parseContentsForApproval },
  { name: 'Ads for Approval', parse: parseAds },
  { name: 'Contents', parse: parseIdeaBank, ideas: true },
];

/**
 * @param {Buffer|ArrayBuffer} buffer xlsx file contents
 * @param {{ year?: number, includeIdeas?: boolean }} options
 * @returns {{ posts: object[], warnings: object[], skipped: object[], summary: object, sheets: string[] }}
 */
export async function parseFbsWorkbook(buffer, { year = null, includeIdeas = true } = {}) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const posts = [];
  const warnings = [];
  const skipped = [];
  const ctx = {
    year: year ? Number(year) : null,
    stats: { rowsWithDate: 0 },
    push: (p) => posts.push(p),
    warn: (sheet, row, message) => warnings.push({ sheet, row, message }),
    skip: (sheet, row, reason) => skipped.push({ sheet, row, reason }),
  };

  const found = [];
  for (const p of PARSERS) {
    if (p.ideas && !includeIdeas) continue;
    const ws = findSheet(workbook, p.name);
    if (!ws) {
      warnings.push({ sheet: p.name, row: null, message: 'Sheet not found in workbook — skipped' });
      continue;
    }
    found.push(ws.name.trim());
    p.parse(ws, ctx);
  }

  const bySource = {};
  for (const p of posts) bySource[p.source] = (bySource[p.source] || 0) + 1;

  return {
    sheets: workbook.worksheets.map((w) => w.name.trim()),
    posts,
    warnings,
    skipped,
    summary: {
      year: ctx.year,
      total: posts.length,
      bySource,
      ideas: posts.filter((p) => p.status === 'IDEA').length,
      ads: posts.filter((p) => p.kind === 'AD').length,
      parsedSheets: found,
    },
  };
}
