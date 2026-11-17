import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { badRequest, dateFromISO, forbidden, notFound } from '../lib/http.js';
import { postListInclude, serializePost, serializePosts } from '../lib/serialize.js';
import { dateStr, id, PLACEMENTS, postCreate, postListQuery, postUpdate, STATUSES } from '../lib/schemas.js';
import { assertClientAccess, requireAdmin, resolveClientId } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { assignmentLogs, NEEDS_COMMENT, NOTICE_ACTIONS, NOTIFY_STATUSES, statusBlock, statusNoticeLogs } from '../lib/workflow.js';
import { aiAvailable, buildPasteRequest, draftsFromPaste, generateDrafts } from '../lib/contentGenerator.js';

const router = Router();

/** Bell notices for an Approved / Needs edit / Rejected change (looks up who sent the post for approval). */
async function statusNotices(before, to, actorId) {
  if (!to || to === before.status || !NOTIFY_STATUSES.includes(to)) return [];
  const sent = await prisma.activityLog.findFirst({ where: { postId: before.id, action: 'SUBMITTED' }, orderBy: { createdAt: 'desc' }, select: { userId: true } });
  return statusNoticeLogs(before, to, before.id, actorId, sent?.userId);
}

/** Status changes made by editing (drawer, content plan, board) follow the approver / assignee rules. */
function assertStatusChange(user, before, data) {
  if (!data.status || data.status === before.status) return;
  // the approver/assignee may be changed in the same edit: judge by who is responsible after it
  const block = statusBlock(user, { ...before, ...data }, data.status) || statusBlock(user, before, data.status);
  if (block) throw forbidden(block);
  if (NEEDS_COMMENT.includes(data.status)) throw badRequest('Please use “Request changes” and say what needs to be edited');
}

// ---------- helpers ----------

/** Converts validated API fields into Prisma data. */
function toDbData(input) {
  const data = { ...input };
  if ('date' in data) data.date = data.date ? dateFromISO(data.date) : null;
  if ('time' in data) data.time = data.time || null;
  if ('adDetails' in data) data.adDetails = data.adDetails ?? Prisma.DbNull;
  return data;
}

/** Make sure referenced pillar / users are valid for this client. */
async function checkRefs(clientId, data) {
  if (data.pillarId) {
    const pillar = await prisma.pillar.findUnique({ where: { id: data.pillarId } });
    if (!pillar || pillar.clientId !== clientId) throw badRequest('Pillar does not belong to this client');
  }
  for (const key of ['approverId', 'assigneeId']) {
    if (!data[key]) continue;
    const u = await prisma.user.findUnique({ where: { id: data[key] } });
    if (!u || !u.active || (u.role !== 'ADMIN' && u.clientId !== clientId)) throw badRequest(`Invalid ${key}`);
  }
}

async function loadPost(postId, user) {
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) throw notFound('Post not found');
  assertClientAccess(user, post.clientId);
  return post;
}

// Client users may add posts to their own calendar, and edit/delete the ones they added
// until FBS picks them up (i.e. while still an Idea or In progress).
const CLIENT_EDITABLE = ['IDEA', 'IN_PROGRESS'];
function assertCanEdit(post, user) {
  if (user.role === 'ADMIN') return;
  if (post.createdById !== user.id || !CLIENT_EDITABLE.includes(post.status)) {
    throw forbidden('You can only change posts you added, until FBS has picked them up');
  }
}
// Fields a client user is not allowed to set
function clientSafe(fields, user) {
  if (user.role === 'ADMIN') return fields;
  const { approverId, assigneeId, status, kind, boost, adDetails, ...rest } = fields; // eslint-disable-line no-unused-vars
  return rest;
}

function diff(before, data) {
  const changed = [];
  for (const key of Object.keys(data)) {
    const a = before[key];
    const b = data[key];
    const norm = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : JSON.stringify(v ?? null));
    if (norm(a) !== norm(b)) changed.push(key);
  }
  return changed;
}

function activityFor(before, data, userId) {
  const changed = diff(before, data);
  if (!changed.length) return [];
  const logs = [];
  if (changed.includes('status')) {
    logs.push({ postId: before.id, userId, action: 'STATUS_CHANGED', meta: { from: before.status, to: data.status } });
  }
  if (changed.includes('date')) {
    logs.push({
      postId: before.id,
      userId,
      action: 'RESCHEDULED',
      meta: { from: before.date ? before.date.toISOString().slice(0, 10) : null, to: data.date ? data.date.toISOString().slice(0, 10) : null },
    });
  }
  const others = changed.filter((k) => k !== 'status' && k !== 'date');
  if (others.length) logs.push({ postId: before.id, userId, action: 'UPDATED', meta: { fields: others } });
  return logs;
}

const fullInclude = {
  ...postListInclude,
  client: { select: { id: true, name: true, slug: true } },
  createdBy: { select: { id: true, name: true } },
};

// ---------- list / read ----------

router.get('/', validate(postListQuery, 'query'), async (req, res) => {
  const q = req.valid.query;
  const clientId = resolveClientId(req.user, q.clientId);
  const where = { archivedAt: q.archived === 'true' ? { not: null } : null };
  if (clientId) where.clientId = clientId;
  else where.client = { deletedAt: null };
  if (q.undated === 'true') where.date = null;
  else if (q.from || q.to) where.date = { ...(q.from ? { gte: dateFromISO(q.from) } : {}), ...(q.to ? { lte: dateFromISO(q.to) } : {}) };
  else if (q.undated === 'false') where.date = { not: null };
  if (q.status) {
    const list = q.status.split(',').map((s) => s.trim()).filter((s) => STATUSES.includes(s));
    if (list.length) where.status = { in: list };
  }
  if (q.placement) where.placements = { has: q.placement };
  if (q.pillarId) where.pillarId = q.pillarId === 'none' ? null : q.pillarId;
  if (q.approverId) where.approverId = q.approverId;
  if (q.assigneeId) where.assigneeId = q.assigneeId;
  if (q.kind) where.kind = q.kind;
  if (q.q) {
    where.OR = ['title', 'caption', 'storyboard', 'hashtags', 'remarks'].map((f) => ({ [f]: { contains: q.q, mode: 'insensitive' } }));
  }

  const posts = await prisma.post.findMany({
    where,
    include: { ...postListInclude, ...(clientId ? {} : { client: { select: { id: true, name: true, slug: true, brandColor: true, secondaryColor: true, logoUrl: true } } }) },
    orderBy: [{ date: 'asc' }, { time: 'asc' }, { createdAt: 'asc' }],
    take: q.limit ?? 2000,
  });
  res.json({ posts: serializePosts(posts) });
});

router.get('/:id', async (req, res) => {
  await loadPost(req.params.id, req.user);
  const post = await prisma.post.findUnique({
    where: { id: req.params.id },
    include: {
      ...fullInclude,
      commentList: { include: { user: { select: { id: true, name: true, role: true } } }, orderBy: { createdAt: 'asc' } },
      activities: { where: { action: { notIn: NOTICE_ACTIONS } }, include: { user: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' }, take: 100 },
    },
  });
  res.json({ post: serializePost(post) });
});

// ---------- create / update / delete (admin) ----------

router.post('/', validate(postCreate), async (req, res) => {
  const { clientId, ...body } = req.valid.body;
  assertClientAccess(req.user, clientId);
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) throw badRequest('Client not found');
  const fields = clientSafe(body, req.user);
  await checkRefs(clientId, fields);
  const data = toDbData(fields);
  if (!data.status) data.status = data.date ? 'IN_PROGRESS' : 'IDEA';
  if (NEEDS_COMMENT.includes(data.status)) data.status = data.date ? 'IN_PROGRESS' : 'IDEA';
  const post = await prisma.post.create({
    data: { ...data, clientId, createdById: req.user.id, activities: { create: { userId: req.user.id, action: 'CREATED' } } },
    include: postListInclude,
  });
  const notify = assignmentLogs(null, data, post.id, req.user.id);
  if (notify.length) await prisma.activityLog.createMany({ data: notify });
  res.status(201).json({ post: serializePost(post) });
});

router.patch('/:id', validate(postUpdate), async (req, res) => {
  const before = await loadPost(req.params.id, req.user);
  assertCanEdit(before, req.user);
  const fields = clientSafe(req.valid.body, req.user);
  await checkRefs(before.clientId, fields);
  const data = toDbData(fields);
  assertStatusChange(req.user, before, data);
  if (data.approverId) data.approverName = null;
  // once FBS starts working on a flagged idea, the "needs attention" flag has done its job
  if (data.status && data.status !== "IDEA" && before.needsAttention && !("needsAttention" in data)) data.needsAttention = false;
  const logs = [
    ...activityFor(before, data, req.user.id),
    ...assignmentLogs(before, data, before.id, req.user.id),
    ...(await statusNotices({ ...before, ...data, status: before.status }, data.status, req.user.id)),
  ];
  const [post] = await prisma.$transaction([
    prisma.post.update({ where: { id: before.id }, data, include: postListInclude }),
    ...(logs.length ? [prisma.activityLog.createMany({ data: logs })] : []),
  ]);
  res.json({ post: serializePost(post) });
});

const bulkSchema = z.object({
  updates: z.array(z.object({ id, data: postUpdate })).min(1).max(500),
});

// Used by the sheet view (inline edits) and drag & drop on the calendar / board
router.post('/bulk', requireAdmin, validate(bulkSchema), async (req, res) => {
  const { updates } = req.valid.body;
  const ids = [...new Set(updates.map((u) => u.id))];
  const existing = await prisma.post.findMany({ where: { id: { in: ids } } });
  const byId = new Map(existing.map((p) => [p.id, p]));
  const ops = [];
  for (const u of updates) {
    const before = byId.get(u.id);
    if (!before) throw notFound(`Post ${u.id} not found`);
    await checkRefs(before.clientId, u.data);
    const data = toDbData(u.data);
    assertStatusChange(req.user, before, data);
    if (data.approverId) data.approverName = null;
    if (data.status && data.status !== "IDEA" && before.needsAttention && !("needsAttention" in data)) data.needsAttention = false;
    ops.push(prisma.post.update({ where: { id: u.id }, data, include: postListInclude }));
    const logs = [
      ...activityFor(before, data, req.user.id),
      ...assignmentLogs(before, data, before.id, req.user.id),
      ...(await statusNotices({ ...before, ...data, status: before.status }, data.status, req.user.id)),
    ];
    if (logs.length) ops.push(prisma.activityLog.createMany({ data: logs }));
  }
  const results = await prisma.$transaction(ops);
  res.json({ posts: serializePosts(results.filter((r) => r && r.id && r.clientId)) });
});

// ---------- bulk archive / restore / delete (Content plan selection) ----------
const idsSchema = z.object({ ids: z.array(id).min(1).max(500) });

async function loadMany(ids) {
  const posts = await prisma.post.findMany({ where: { id: { in: [...new Set(ids)] } }, select: { id: true, clientId: true } });
  if (posts.length !== new Set(ids).size) throw notFound('Some posts were not found');
  return posts;
}

router.post('/bulk-archive', requireAdmin, validate(idsSchema.extend({ archived: z.boolean().default(true) })), async (req, res) => {
  const { ids, archived } = req.valid.body;
  const posts = await loadMany(ids);
  const at = archived ? new Date() : null;
  await prisma.$transaction([
    prisma.post.updateMany({ where: { id: { in: posts.map((p) => p.id) } }, data: { archivedAt: at, ...(archived ? { needsAttention: false } : {}) } }),
    prisma.activityLog.createMany({ data: posts.map((p) => ({ postId: p.id, userId: req.user.id, action: archived ? 'ARCHIVED' : 'RESTORED', meta: {} })) }),
  ]);
  res.json({ ok: true, count: posts.length });
});

router.post('/bulk-delete', requireAdmin, validate(idsSchema), async (req, res) => {
  const posts = await loadMany(req.valid.body.ids);
  const { count } = await prisma.post.deleteMany({ where: { id: { in: posts.map((p) => p.id) } } });
  res.json({ ok: true, count });
});

router.delete('/:id', async (req, res) => {
  const post = await loadPost(req.params.id, req.user);
  assertCanEdit(post, req.user);
  await prisma.post.delete({ where: { id: post.id } });
  res.json({ ok: true });
});

router.post('/:id/duplicate', requireAdmin, validate(z.object({ date: dateStr.nullable().optional() })), async (req, res) => {
  const src = await loadPost(req.params.id, req.user);
  // eslint-disable-next-line no-unused-vars
  const { id: _id, createdAt, updatedAt, importSource, reacts, comments, shares, reach, engagement, linkClicks, feedback, ...copy } = src;
  const post = await prisma.post.create({
    data: {
      ...copy,
      adDetails: copy.adDetails ?? Prisma.DbNull,
      title: `${src.title} (copy)`,
      date: req.valid.body.date !== undefined ? dateFromISO(req.valid.body.date) : src.date,
      status: src.date || req.valid.body.date ? 'IN_PROGRESS' : 'IDEA',
      createdById: req.user.id,
      activities: { create: { userId: req.user.id, action: 'CREATED', meta: { duplicatedFrom: src.id } } },
    },
    include: postListInclude,
  });
  res.status(201).json({ post: serializePost(post) });
});

// ---------- generate a month of empty slots from weekday pillars ----------

const generateSchema = z.object({
  clientId: id,
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  placements: z.array(z.enum(PLACEMENTS)).optional(),
});

router.post('/generate-month', requireAdmin, validate(generateSchema), async (req, res) => {
  const { clientId, year, month, placements } = req.valid.body;
  const pillars = await prisma.pillar.findMany({ where: { clientId, active: true, weekday: { not: null } } });
  if (!pillars.length) throw badRequest('No weekday pillars set up for this client. Give some pillars a weekday first.');

  const first = new Date(Date.UTC(year, month - 1, 1));
  const last = new Date(Date.UTC(year, month, 0));
  const existing = await prisma.post.findMany({
    where: { clientId, archivedAt: null, date: { gte: first, lte: last }, pillarId: { in: pillars.map((p) => p.id) } },
    select: { date: true, pillarId: true },
  });
  const taken = new Set(existing.map((p) => `${p.date.toISOString().slice(0, 10)}|${p.pillarId}`));

  const data = [];
  for (let d = 1; d <= last.getUTCDate(); d++) {
    const date = new Date(Date.UTC(year, month - 1, d));
    const iso = date.toISOString().slice(0, 10);
    for (const p of pillars.filter((x) => x.weekday === date.getUTCDay())) {
      if (taken.has(`${iso}|${p.id}`)) continue;
      data.push({
        clientId,
        pillarId: p.id,
        date,
        title: `${p.name} post`,
        status: 'IN_PROGRESS',
        placements: placements ?? ['FB_POST', 'IG_POST', 'LINKEDIN_POST'],
        createdById: req.user.id,
      });
    }
  }
  const result = data.length ? await prisma.post.createMany({ data }) : { count: 0 };
  res.status(201).json({ created: result.count, skippedExisting: existing.length });
});

// ---------- AI content drafts: generate for review, then save the ones kept ----------

const briefFields = z
  .object({
    clientId: id,
    from: dateStr,
    to: dateStr,
    postsPerDay: z.number().int().min(1).max(3).default(1),
    days: z.enum(['every', 'weekdays', 'pillar']).default('every'),
    placements: z.array(z.enum(PLACEMENTS)).min(1, 'Pick at least one platform'),
    goal: z.string().trim().min(1, 'Choose a goal').max(300),
    audience: z.string().trim().max(500).optional().default(''),
    tone: z.string().trim().min(1).max(200),
    language: z.string().trim().min(1).max(60),
    cta: z.string().trim().max(300).optional().default(''),
    notes: z.string().trim().max(3000).optional().default(''),
    avoid: z.string().trim().max(500).optional().default(''),
    hashtags: z.boolean().default(true),
  });
const checkRange = (schema) =>
  schema
    .refine((b) => b.from <= b.to, { message: 'The start date must be before the end date', path: ['to'] })
    .refine((b) => (dateFromISO(b.to) - dateFromISO(b.from)) / 86400000 <= 31, { message: 'Generate at most one month at a time', path: ['to'] });
const generateContentSchema = checkRange(briefFields);
const readReplySchema = checkRange(briefFields.extend({ reply: z.string().min(1, 'Paste Claude’s reply first').max(500000) }));

// is the one-click (API) way set up on this server?
router.get('/generate-content/status', requireAdmin, (_req, res) => {
  res.json({ api: aiAvailable() });
});

// one click, through the API
router.post('/generate-content', requireAdmin, validate(generateContentSchema), async (req, res) => {
  const result = await generateDrafts(req.valid.body);
  res.json(result);
});

// copy-paste through the person's own Claude subscription: 1) the request to paste into claude.ai
router.post('/generate-content/request', requireAdmin, validate(generateContentSchema), async (req, res) => {
  res.json(await buildPasteRequest(req.valid.body));
});

// 2) read Claude's reply pasted back into drafts for review
router.post('/generate-content/read', requireAdmin, validate(readReplySchema), async (req, res) => {
  const { reply, ...opts } = req.valid.body;
  res.json(await draftsFromPaste(opts, reply));
});

const draftSchema = z.object({
  date: dateStr,
  pillarId: id.nullable().optional(),
  placements: z.array(z.enum(PLACEMENTS)).default([]),
  format: z.string().max(100).nullable().optional(),
  title: z.string().trim().min(1).max(200),
  caption: z.string().max(10000).nullable().optional(),
  hashtags: z.string().max(2000).nullable().optional(),
  graphicsIdea: z.string().max(5000).nullable().optional(),
  storyboard: z.string().max(10000).nullable().optional(),
});
const saveDraftsSchema = z.object({ clientId: id, drafts: z.array(draftSchema).min(1).max(200) });

router.post('/generate-content/save', requireAdmin, validate(saveDraftsSchema), async (req, res) => {
  const { clientId, drafts } = req.valid.body;
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!client) throw notFound('Client not found');
  // only link pillars that really belong to this client
  const pillarIds = new Set((await prisma.pillar.findMany({ where: { clientId }, select: { id: true } })).map((p) => p.id));
  const result = await prisma.post.createMany({
    data: drafts.map((d) => ({
      clientId,
      date: dateFromISO(d.date),
      pillarId: d.pillarId && pillarIds.has(d.pillarId) ? d.pillarId : null,
      title: d.title,
      status: 'IN_PROGRESS',
      placements: d.placements,
      format: d.format || null,
      caption: d.caption || null,
      hashtags: d.hashtags || null,
      graphicsIdea: d.graphicsIdea || null,
      storyboard: d.storyboard || null,
      remarks: 'Drafted with AI: review before sending for approval',
      createdById: req.user.id,
    })),
  });
  res.status(201).json({ created: result.count });
});

// ---------- approval workflow ----------

const submitSchema = z.object({ approverId: id.nullable().optional(), comment: z.string().trim().max(5000).optional() });

router.post('/:id/submit', requireAdmin, validate(submitSchema), async (req, res) => {
  const before = await loadPost(req.params.id, req.user);
  const { approverId, comment } = req.valid.body;
  if (approverId) await checkRefs(before.clientId, { approverId });
  const block = statusBlock(req.user, before, 'FOR_APPROVAL');
  if (block) throw forbidden(block);
  const notify = assignmentLogs(before, { approverId }, before.id, req.user.id);
  const [post] = await prisma.$transaction([
    prisma.post.update({
      where: { id: before.id },
      data: { status: 'FOR_APPROVAL', ...(approverId ? { approverId, approverName: null } : {}) },
      include: postListInclude,
    }),
    prisma.activityLog.create({ data: { postId: before.id, userId: req.user.id, action: 'SUBMITTED', meta: { from: before.status, approverId: approverId ?? before.approverId } } }),
    ...(comment ? [prisma.comment.create({ data: { postId: before.id, userId: req.user.id, body: comment } })] : []),
    ...(notify.length ? [prisma.activityLog.createMany({ data: notify })] : []),
  ]);
  res.json({ post: serializePost(post) });
});

const REVIEW = {
  APPROVE: { status: 'APPROVED', action: 'APPROVED' },
  REQUEST_CHANGES: { status: 'TO_EDIT', action: 'CHANGES_REQUESTED' },
  REJECT: { status: 'REJECTED', action: 'REJECTED' },
};
const reviewSchema = z.object({ action: z.enum(['APPROVE', 'REQUEST_CHANGES', 'REJECT']), comment: z.string().trim().max(5000).optional() });

// The post's approver (any FBS member when none is set) and the client's own users can review
router.post('/:id/review', validate(reviewSchema), async (req, res) => {
  const before = await loadPost(req.params.id, req.user); // enforces client scope
  const { action, comment } = req.valid.body;
  if (action !== 'APPROVE' && !comment) throw badRequest('Please add a comment explaining what should change');
  if (req.user.role === 'CLIENT' && before.status === 'IDEA') throw forbidden('Ideas cannot be reviewed yet');
  const r = REVIEW[action];
  const block = statusBlock(req.user, before, r.status);
  if (block) throw forbidden(block);
  const notices = await statusNotices(before, r.status, req.user.id);
  const [post] = await prisma.$transaction([
    prisma.post.update({ where: { id: before.id }, data: { status: r.status }, include: postListInclude }),
    prisma.activityLog.create({ data: { postId: before.id, userId: req.user.id, action: r.action, meta: { from: before.status, to: r.status } } }),
    ...(comment ? [prisma.comment.create({ data: { postId: before.id, userId: req.user.id, body: comment } })] : []),
    ...(notices.length ? [prisma.activityLog.createMany({ data: notices })] : []),
  ]);
  res.json({ post: serializePost(post) });
});

// ---------- comments ----------

router.get('/:id/comments', async (req, res) => {
  const post = await loadPost(req.params.id, req.user);
  const comments = await prisma.comment.findMany({
    where: { postId: post.id },
    include: { user: { select: { id: true, name: true, role: true } } },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ comments });
});

const commentSchema = z.object({ body: z.string().trim().min(1).max(5000), mentions: z.array(id).max(30).optional() });

// A comment can @mention people who can see the post (FBS team, and this client's own users); each gets a bell notice
router.post('/:id/comments', validate(commentSchema), async (req, res) => {
  const post = await loadPost(req.params.id, req.user);
  const { body, mentions = [] } = req.valid.body;
  const wanted = [...new Set(mentions)].filter((u) => u !== req.user.id);
  const people = wanted.length
    ? await prisma.user.findMany({ where: { id: { in: wanted }, active: true, OR: [{ role: 'ADMIN' }, { clientId: post.clientId }] }, select: { id: true } })
    : [];
  const excerpt = body.length > 140 ? `${body.slice(0, 137)}…` : body;
  const [comment] = await prisma.$transaction([
    prisma.comment.create({ data: { postId: post.id, userId: req.user.id, body }, include: { user: { select: { id: true, name: true, role: true } } } }),
    ...(people.length
      ? [prisma.activityLog.createMany({ data: people.map((u) => ({ postId: post.id, userId: req.user.id, action: 'MENTIONED', meta: { userId: u.id, excerpt } })) })]
      : []),
  ]);
  res.status(201).json({ comment, mentioned: people.length });
});

export default router;
