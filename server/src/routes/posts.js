import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { badRequest, dateFromISO, forbidden, notFound } from '../lib/http.js';
import { postListInclude, serializePost, serializePosts } from '../lib/serialize.js';
import { dateStr, id, PLACEMENTS, postCreate, postListQuery, postUpdate, STATUSES } from '../lib/schemas.js';
import { assertClientAccess, requireAdmin, resolveClientId } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

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
    include: { ...postListInclude, ...(clientId ? {} : { client: { select: { id: true, name: true, slug: true, brandColor: true } } }) },
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
      activities: { include: { user: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' }, take: 100 },
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
  const post = await prisma.post.create({
    data: { ...data, clientId, createdById: req.user.id, activities: { create: { userId: req.user.id, action: 'CREATED' } } },
    include: postListInclude,
  });
  res.status(201).json({ post: serializePost(post) });
});

router.patch('/:id', validate(postUpdate), async (req, res) => {
  const before = await loadPost(req.params.id, req.user);
  assertCanEdit(before, req.user);
  const fields = clientSafe(req.valid.body, req.user);
  await checkRefs(before.clientId, fields);
  const data = toDbData(fields);
  if (data.approverId) data.approverName = null;
  // once FBS starts working on a flagged idea, the "needs attention" flag has done its job
  if (data.status && data.status !== "IDEA" && before.needsAttention && !("needsAttention" in data)) data.needsAttention = false;
  const logs = activityFor(before, data, req.user.id);
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
    if (data.approverId) data.approverName = null;
    if (data.status && data.status !== "IDEA" && before.needsAttention && !("needsAttention" in data)) data.needsAttention = false;
    ops.push(prisma.post.update({ where: { id: u.id }, data, include: postListInclude }));
    const logs = activityFor(before, data, req.user.id);
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

// ---------- approval workflow ----------

const submitSchema = z.object({ approverId: id.nullable().optional(), comment: z.string().trim().max(5000).optional() });

router.post('/:id/submit', requireAdmin, validate(submitSchema), async (req, res) => {
  const before = await loadPost(req.params.id, req.user);
  const { approverId, comment } = req.valid.body;
  if (approverId) await checkRefs(before.clientId, { approverId });
  const [post] = await prisma.$transaction([
    prisma.post.update({
      where: { id: before.id },
      data: { status: 'FOR_APPROVAL', ...(approverId ? { approverId, approverName: null } : {}) },
      include: postListInclude,
    }),
    prisma.activityLog.create({ data: { postId: before.id, userId: req.user.id, action: 'SUBMITTED', meta: { from: before.status, approverId: approverId ?? before.approverId } } }),
    ...(comment ? [prisma.comment.create({ data: { postId: before.id, userId: req.user.id, body: comment } })] : []),
  ]);
  res.json({ post: serializePost(post) });
});

const REVIEW = {
  APPROVE: { status: 'APPROVED', action: 'APPROVED' },
  REQUEST_CHANGES: { status: 'TO_EDIT', action: 'CHANGES_REQUESTED' },
  REJECT: { status: 'REJECTED', action: 'REJECTED' },
};
const reviewSchema = z.object({ action: z.enum(['APPROVE', 'REQUEST_CHANGES', 'REJECT']), comment: z.string().trim().max(5000).optional() });

// Admins (incl. the assigned approver) and the client's own users can review
router.post('/:id/review', validate(reviewSchema), async (req, res) => {
  const before = await loadPost(req.params.id, req.user); // enforces client scope
  const { action, comment } = req.valid.body;
  if (action !== 'APPROVE' && !comment) throw badRequest('Please add a comment explaining what should change');
  if (req.user.role === 'CLIENT' && before.status === 'IDEA') throw forbidden('Ideas cannot be reviewed yet');
  const r = REVIEW[action];
  const [post] = await prisma.$transaction([
    prisma.post.update({ where: { id: before.id }, data: { status: r.status }, include: postListInclude }),
    prisma.activityLog.create({ data: { postId: before.id, userId: req.user.id, action: r.action, meta: { from: before.status, to: r.status } } }),
    ...(comment ? [prisma.comment.create({ data: { postId: before.id, userId: req.user.id, body: comment } })] : []),
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

router.post('/:id/comments', validate(z.object({ body: z.string().trim().min(1).max(5000) })), async (req, res) => {
  const post = await loadPost(req.params.id, req.user);
  const comment = await prisma.comment.create({
    data: { postId: post.id, userId: req.user.id, body: req.valid.body.body },
    include: { user: { select: { id: true, name: true, role: true } } },
  });
  res.status(201).json({ comment });
});

export default router;
