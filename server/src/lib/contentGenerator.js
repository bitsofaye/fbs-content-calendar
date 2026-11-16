// Drafts social media posts for a client's calendar with Claude.
// Needs ANTHROPIC_API_KEY in the server's environment (Render → Environment).
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod/v4';
import { prisma } from './prisma.js';
import { addDaysISO, dateFromISO, HttpError } from './http.js';
import { PLACEMENTS } from './schemas.js';

const MODEL = 'claude-opus-5-5';
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const DraftSchema = z.object({
  posts: z.array(
    z.object({
      date: z.string().describe('YYYY-MM-DD, one of the dates you were given'),
      pillar: z.string().nullable().describe('Exact name of one of the content pillars, or null if none fits'),
      placements: z.array(z.enum(PLACEMENTS)),
      format: z.string().describe('e.g. Graphic, Carousel, Infographic, Short Video, Reel, Story, Text post'),
      title: z.string().describe('Short internal title for the calendar, under 70 characters'),
      caption: z.string().describe('The full ready-to-post caption'),
      hashtags: z.string().describe('Space-separated hashtags, or an empty string'),
      graphicsIdea: z.string().describe('What the designer should make: layout, on-image text, visuals'),
      storyboard: z.string().describe('For videos: scene-by-scene outline. Empty string for non-video posts'),
    }),
  ),
});

let client;
function anthropic() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new HttpError(503, 'AI content generation is not set up yet: add ANTHROPIC_API_KEY to the server settings on Render.');
  }
  client ??= new Anthropic({ timeout: 10 * 60 * 1000 });
  return client;
}

// Every date from..to (inclusive) that should get posts
export function targetDates({ from, to, days, pillars }) {
  const pillarDays = new Set(pillars.filter((p) => p.weekday !== null).map((p) => p.weekday));
  const out = [];
  for (let d = from; d <= to; d = addDaysISO(d, 1)) {
    const wd = new Date(`${d}T00:00:00Z`).getUTCDay();
    if (days === 'weekdays' && (wd === 0 || wd === 6)) continue;
    if (days === 'pillar' && !pillarDays.has(wd)) continue;
    out.push(d);
  }
  return out;
}

const SYSTEM = `You are a senior social media content strategist at Frontline Business Solutions (FBS), a Christian-owned business solutions company in the Philippines that manages social media for its own brand and for client businesses.

You draft posts for one client's content calendar. The team will review, edit and get approval for every post before it goes out, so give them complete, usable drafts: a real caption written to be posted as-is, a clear brief for the designer, and a storyboard for videos.

Write for the client's audience, not for marketers. Keep claims truthful: do not invent prices, promos, statistics, awards, testimonials or events that you were not told about. If a post needs a detail you do not have (a price, a date, a link), write a placeholder in square brackets, like [link] or [price], so the team can fill it in.

Vary topics, hooks and formats across the period; do not repeat a topic that is already on the calendar or in the recent posts you are shown. Follow the content pillars and the monthly theme when they are given. Use each pillar's weekday slot when it has one.`;

function buildPrompt({ client, pillars, themes, dates, existing, recent, opts }) {
  const lines = [];
  lines.push(`# Client\nName: ${client.name}${client.industry ? `\nIndustry: ${client.industry}` : ''}`);

  lines.push('# Brief from the team');
  lines.push(`Goal for this period: ${opts.goal}`);
  if (opts.audience) lines.push(`Target audience: ${opts.audience}`);
  lines.push(`Tone of voice: ${opts.tone}`);
  lines.push(`Language: ${opts.language}`);
  if (opts.cta) lines.push(`Main call to action: ${opts.cta}`);
  if (opts.notes) lines.push(`Products, promos, events or key messages to include:\n${opts.notes}`);
  if (opts.avoid) lines.push(`Avoid: ${opts.avoid}`);
  lines.push(`Hashtags: ${opts.hashtags ? 'include 3 to 8 relevant hashtags' : 'leave the hashtags field empty'}`);

  if (pillars.length) {
    lines.push('# Content pillars (use the exact name)');
    for (const p of pillars) lines.push(`- ${p.name}${p.weekday !== null ? ` (weekday slot: ${WEEKDAYS[p.weekday]})` : ''}`);
  }
  if (themes.length) {
    lines.push('# Monthly themes');
    for (const t of themes) {
      const weeks = Array.isArray(t.weeklyFocus) ? t.weeklyFocus.map((w) => `  - Week ${w.week}: ${w.focus}`).join('\n') : '';
      lines.push(`- ${t.year}-${String(t.month).padStart(2, '0')}: ${t.title}${t.notes ? ` (${t.notes})` : ''}${weeks ? `\n${weeks}` : ''}`);
    }
  }
  if (existing.length) {
    lines.push('# Already on the calendar in this period (do not duplicate these topics)');
    for (const p of existing) lines.push(`- ${p.date}: ${p.title}`);
  }
  if (recent.length) {
    lines.push('# Recent posts before this period (vary from these)');
    for (const p of recent) lines.push(`- ${p.date}: ${p.title}`);
  }

  lines.push('# What to make');
  lines.push(`Exactly ${opts.postsPerDay} post${opts.postsPerDay > 1 ? 's' : ''} for each of these dates:`);
  for (const d of dates) lines.push(`- ${d} (${WEEKDAYS[new Date(`${d}T00:00:00Z`).getUTCDay()]})`);
  lines.push(`Platforms to use: ${opts.placements.join(', ')}. Pick the subset that fits each post (videos go to reels, shorts or TikTok; graphics to feed posts).`);
  return lines.join('\n\n');
}

// Everything Claude needs to know, read from the database: shared by the API and the copy-paste ways
async function prepare(opts) {
  const { clientId, from, to } = opts;
  const [clientRow, pillars, existingRows, recentRows] = await Promise.all([
    prisma.client.findUnique({ where: { id: clientId }, select: { id: true, name: true, industry: true } }),
    prisma.pillar.findMany({ where: { clientId, active: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    prisma.post.findMany({
      where: { clientId, archivedAt: null, date: { gte: dateFromISO(from), lte: dateFromISO(to) } },
      select: { date: true, title: true },
      orderBy: { date: 'asc' },
      take: 200,
    }),
    prisma.post.findMany({
      where: { clientId, archivedAt: null, date: { gte: dateFromISO(addDaysISO(from, -60)), lt: dateFromISO(from) } },
      select: { date: true, title: true },
      orderBy: { date: 'desc' },
      take: 60,
    }),
  ]);
  if (!clientRow) throw new HttpError(404, 'Client not found');

  const months = new Set([from.slice(0, 7), to.slice(0, 7)]);
  const themes = (
    await prisma.monthlyTheme.findMany({ where: { clientId, year: { in: [...months].map((m) => Number(m.slice(0, 4))) } } })
  ).filter((t) => months.has(`${t.year}-${String(t.month).padStart(2, '0')}`));

  const dates = targetDates({ from, to, days: opts.days, pillars });
  if (!dates.length) throw new HttpError(400, 'No days match your choice. Try “Every day”, or give some pillars a weekday.');

  const iso = (d) => d.toISOString().slice(0, 10);
  const prompt = buildPrompt({
    client: clientRow,
    pillars,
    themes,
    dates,
    existing: existingRows.map((p) => ({ date: iso(p.date), title: p.title })),
    recent: recentRows.map((p) => ({ date: iso(p.date), title: p.title })),
    opts,
  });
  return { pillars, dates, prompt };
}

export const aiAvailable = () => Boolean(process.env.ANTHROPIC_API_KEY);

// One click: the server asks Claude through the API (needs ANTHROPIC_API_KEY)
export async function generateDrafts(opts) {
  const ai = anthropic();
  const { pillars, dates, prompt } = await prepare(opts);
  const format = betaZodOutputFormat(DraftSchema);
  let message;
  try {
    const stream = ai.beta.messages.stream({
      model: MODEL,
      max_tokens: 64000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format },
      system: SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    });
    message = await stream.finalMessage();
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new HttpError(503, 'The AI key on the server is not valid. Check ANTHROPIC_API_KEY on Render.');
    if (err instanceof Anthropic.RateLimitError) throw new HttpError(429, 'The AI is busy right now. Wait a minute and try again.');
    if (err instanceof Anthropic.APIError) throw new HttpError(502, `The AI could not generate content (${err.status ?? 'network error'}). Try again.`);
    throw err;
  }

  if (message.stop_reason === 'refusal') throw new HttpError(422, 'The AI declined this request. Try changing the brief.');
  if (message.stop_reason === 'max_tokens') throw new HttpError(422, 'That was too much to write at once. Try a shorter period or fewer posts per day.');
  const text = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  let parsed;
  try {
    parsed = format.parse(text);
  } catch {
    throw new HttpError(502, 'The AI reply could not be read. Try again.');
  }
  return { drafts: toDrafts(parsed, { pillars, dates, opts }), dates };
}

// Copy-paste (uses the person's own Claude subscription): the request to paste into claude.ai
const REPLY_FORMAT = `# How to reply
Reply with only one JSON code block and nothing else, in exactly this shape:

\`\`\`json
{
  "posts": [
    {
      "date": "YYYY-MM-DD",
      "pillar": "exact pillar name, or null",
      "placements": ["FB_POST", "IG_POST"],
      "format": "Graphic | Carousel | Infographic | Short Video | Reel | Story | Text post",
      "title": "short internal title, under 70 characters",
      "caption": "the full ready-to-post caption",
      "hashtags": "space-separated hashtags, or an empty string",
      "graphicsIdea": "what the designer should make",
      "storyboard": "scene-by-scene outline for videos, or an empty string"
    }
  ]
}
\`\`\`

Allowed placements: ${PLACEMENTS.join(', ')}.`;

export async function buildPasteRequest(opts) {
  const { dates, prompt } = await prepare(opts);
  return { text: `${SYSTEM}\n\n${prompt}\n\n${REPLY_FORMAT}`, dates };
}

// Read the reply pasted back from claude.ai
export function readPastedReply(text) {
  const raw = String(text || '').trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  let body = fenced ? fenced[1] : raw;
  // the JSON starts at the first { or [ (whichever comes first) and ends at its matching kind of bracket
  const obj = body.indexOf('{');
  const arr = body.indexOf('[');
  const isArray = arr !== -1 && (obj === -1 || arr < obj);
  const start = isArray ? arr : obj;
  const end = body.lastIndexOf(isArray ? ']' : '}');
  if (start === -1 || end <= start) throw new HttpError(400, 'Could not find the posts in what you pasted. Copy Claude’s whole reply, including the code block.');
  body = body.slice(start, end + 1);
  let json;
  try {
    json = JSON.parse(body);
  } catch {
    throw new HttpError(400, 'The pasted reply is incomplete or changed. Copy Claude’s whole reply again (use the copy button under the code block).');
  }
  // be forgiving with what a chat reply may leave out
  const Loose = z.object({
    posts: z.array(
      z.object({
        date: z.string(),
        pillar: z.string().nullable().optional(),
        placements: z.array(z.string()).optional().default([]),
        format: z.string().optional().default(''),
        title: z.string().min(1),
        caption: z.string().optional().default(''),
        hashtags: z.string().optional().default(''),
        graphicsIdea: z.string().optional().default(''),
        storyboard: z.string().optional().default(''),
      }),
    ),
  });
  const parsed = Loose.safeParse(Array.isArray(json) ? { posts: json } : json);
  if (!parsed.success) throw new HttpError(400, 'The pasted reply is missing parts of the posts (each needs at least a date and a title). Ask Claude to answer again in the JSON format.');
  return parsed.data;
}

export async function draftsFromPaste(opts, text) {
  const parsed = readPastedReply(text);
  const pillars = await prisma.pillar.findMany({ where: { clientId: opts.clientId, active: true } });
  const dates = targetDates({ from: opts.from, to: opts.to, days: opts.days, pillars });
  return { drafts: toDrafts(parsed, { pillars, dates, opts }), dates };
}

// Keep only drafts for the dates asked for, link pillars by name, and tidy the fields
export function toDrafts(parsed, { pillars, dates, opts }) {
  const wanted = new Set(dates);
  const byName = new Map(pillars.map((p) => [p.name.trim().toLowerCase(), p]));
  return parsed.posts
    .filter((p) => wanted.has(p.date))
    .map((p) => {
      const pillar = p.pillar ? byName.get(p.pillar.trim().toLowerCase()) : null;
      const placements = [...new Set(p.placements || [])].filter((x) => opts.placements.includes(x));
      return {
        date: p.date,
        pillarId: pillar?.id ?? null,
        pillarName: pillar?.name ?? null,
        placements: placements.length ? placements : opts.placements,
        format: (p.format || '').slice(0, 100) || null,
        title: p.title.slice(0, 200),
        caption: p.caption || null,
        hashtags: p.hashtags || null,
        graphicsIdea: p.graphicsIdea || null,
        storyboard: p.storyboard || null,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}
