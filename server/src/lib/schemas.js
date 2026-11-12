import { z } from 'zod';

export const STATUSES = [
  'IDEA', 'IN_PROGRESS', 'CREATED', 'EDITED', 'TO_EDIT', 'FOR_APPROVAL', 'APPROVED',
  'REJECTED', 'ON_HOLD', 'RESCHEDULE', 'SCHEDULED', 'PUBLISHED', 'BOOSTED',
];
export const PLACEMENTS = ['FB_POST', 'IG_POST', 'LINKEDIN_POST', 'FB_REELS', 'IG_REELS', 'YT_SHORTS', 'YT_CLIPS', 'YT_VIDEO', 'TIKTOK', 'STORY'];

export const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
export const id = z.string().min(1).max(64);
const text = (max = 20000) => z.string().max(max).nullable().optional();
const int = z.number().int().min(0).nullable().optional();
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex color like #2563eb');

export const postFields = z.object({
  pillarId: id.nullable().optional(),
  kind: z.enum(['ORGANIC', 'AD']).optional(),
  date: dateStr.nullable().optional(),
  time: z.union([z.string().regex(/^\d{2}:\d{2}$/), z.literal('')]).nullable().optional(),
  title: z.string().trim().min(1, 'Title is required').max(500),
  status: z.enum(STATUSES).optional(),
  placements: z.array(z.enum(PLACEMENTS)).max(20).optional(),
  format: text(200),
  storyboard: text(),
  graphicsIdea: text(),
  titleDraft: text(1000),
  caption: text(),
  hashtags: text(5000),
  pubmatLinks: z.array(z.string().max(2000)).max(30).optional(),
  referenceLink: text(2000),
  remarks: text(),
  boost: z.enum(['ORGANIC', 'PAID', 'BOOSTED']).optional(),
  approverId: id.nullable().optional(),
  assigneeId: id.nullable().optional(),
  approverName: text(200),
  reacts: int,
  comments: int,
  shares: int,
  reach: int,
  engagement: int,
  linkClicks: int,
  feedback: z.enum(['EXCELLENT', 'GOOD', 'BAD']).nullable().optional(),
  needsAttention: z.boolean().optional(),
  adDetails: z
    .object({
      primaryText: text(),
      headline: text(1000),
      description: text(2000),
      cta: text(200),
      adSets: z.array(z.object({ name: z.string().max(200), targeting: z.string().max(5000) })).max(10).optional(),
      botcakeMessage: text(2000),
    })
    .nullable()
    .optional(),
});

export const postCreate = postFields.extend({ clientId: id });
export const postUpdate = postFields.partial();

export const postListQuery = z.object({
  clientId: id.optional(),
  from: dateStr.optional(),
  to: dateStr.optional(),
  status: z.string().optional(), // comma separated
  placement: z.enum(PLACEMENTS).optional(),
  pillarId: id.optional(),
  approverId: id.optional(),
  assigneeId: id.optional(),
  kind: z.enum(['ORGANIC', 'AD']).optional(),
  q: z.string().max(200).optional(),
  undated: z.enum(['true', 'false']).optional(),
  archived: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().int().min(1).max(3000).optional(),
});

export const clientCreate = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers and dashes only').max(60).optional(),
  brandColor: color.optional(),
  logoUrl: z.string().url().max(2000).nullable().optional().or(z.literal('')),
  industry: z.string().max(120).nullable().optional(),
  withDefaultPillars: z.boolean().optional(),
});
export const clientUpdate = clientCreate.omit({ withDefaultPillars: true }).partial().extend({ active: z.boolean().optional() });

export const pillarCreate = z.object({
  clientId: id,
  name: z.string().trim().min(1).max(120),
  color: color.optional(),
  weekday: z.number().int().min(0).max(6).nullable().optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});
export const pillarUpdate = pillarCreate.omit({ clientId: true }).partial();

export const themeUpsert = z.object({
  clientId: id,
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  title: z.string().trim().min(1).max(300),
  weeklyFocus: z.array(z.object({ week: z.number().int().min(1).max(6), focus: z.string().max(1000) })).max(6).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
});

export const userCreate = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
  role: z.enum(['ADMIN', 'CLIENT']),
  clientId: id.nullable().optional(),
});
export const userUpdate = userCreate.partial().extend({ active: z.boolean().optional() });
