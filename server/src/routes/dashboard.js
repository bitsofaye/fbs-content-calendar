import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { addDaysISO, dateFromISO, notFound, todayISO } from '../lib/http.js';
import { postListInclude, serializePosts } from '../lib/serialize.js';
import { assertClientAccess, requireAdmin } from '../middleware/auth.js';

const router = Router();
const clientMini = { select: { id: true, name: true, slug: true, brandColor: true } };

function monthRange(iso) {
  const [y, m] = iso.split('-').map(Number);
  const from = `${y}-${String(m).padStart(2, '0')}-01`;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from, to: `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}` };
}

const isISO = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

// Admin: every client at a glance + approval queues
router.get('/overview', requireAdmin, async (req, res) => {
  const today = todayISO();
  const { from, to } = monthRange(today);
  const [clients, monthCounts, awaiting, toEdit, upcoming, requests, flaggedIdeas] = await Promise.all([
    prisma.client.findMany({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, slug: true, brandColor: true, logoUrl: true, industry: true } }),
    prisma.post.groupBy({
      by: ['clientId', 'status'],
      where: { archivedAt: null, date: { gte: dateFromISO(from), lte: dateFromISO(to) } },
      _count: { _all: true },
    }),
    prisma.post.findMany({
      where: { archivedAt: null, status: 'FOR_APPROVAL' },
      include: { ...postListInclude, client: clientMini },
      orderBy: [{ date: 'asc' }],
      take: 100,
    }),
    prisma.post.findMany({
      where: { archivedAt: null, status: { in: ['TO_EDIT', 'REJECTED'] } },
      include: { ...postListInclude, client: clientMini },
      orderBy: [{ date: 'asc' }],
      take: 100,
    }),
    prisma.post.findMany({
      where: { archivedAt: null, date: { gte: dateFromISO(today), lte: dateFromISO(addDaysISO(today, 7)) }, status: { not: 'IDEA' } },
      include: { ...postListInclude, client: clientMini },
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
      take: 200,
    }),
    // posts a client added themselves that FBS hasn't picked up yet
    prisma.post.findMany({
      where: { archivedAt: null, createdBy: { role: 'CLIENT' }, status: { in: ['IDEA', 'IN_PROGRESS'] } },
      include: { ...postListInclude, client: clientMini, createdBy: { select: { id: true, name: true } } },
      orderBy: [{ createdAt: 'desc' }],
      take: 100,
    }),
    // ideas someone flagged for the team's attention
    prisma.post.findMany({
      where: { archivedAt: null, needsAttention: true },
      include: { ...postListInclude, client: clientMini },
      orderBy: [{ createdAt: 'desc' }],
      take: 100,
    }),
  ]);

  const perClient = Object.fromEntries(clients.map((c) => [c.id, { total: 0, byStatus: {} }]));
  for (const row of monthCounts) {
    const entry = perClient[row.clientId];
    if (!entry) continue;
    entry.byStatus[row.status] = row._count._all;
    entry.total += row._count._all;
  }

  res.json({
    today,
    month: { from, to },
    clients: clients.map((c) => ({ ...c, month: perClient[c.id] })),
    awaitingApproval: serializePosts(awaiting),
    myApprovals: serializePosts(awaiting.filter((p) => p.approverId === req.user.id)),
    needsEdits: serializePosts(toEdit),
    upcoming: serializePosts(upcoming),
    clientRequests: serializePosts(requests),
    ideasNeedingAttention: serializePosts(flaggedIdeas),
  });
});

// Anyone: posts where you were recently made the approver or the assignee (newest first, last 30 days)
router.get('/notifications', async (req, res) => {
  const since = new Date(Date.now() - 30 * 86400000);
  const logs = await prisma.activityLog.findMany({
    where: {
      action: 'ASSIGNED',
      createdAt: { gte: since },
      meta: { path: ['userId'], equals: req.user.id },
      post: { archivedAt: null, ...(req.user.role === 'CLIENT' ? { clientId: req.user.clientId } : {}) },
    },
    include: {
      user: { select: { id: true, name: true } },
      post: { select: { id: true, title: true, date: true, status: true, client: clientMini } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json({
    assigned: logs.map((l) => ({
      id: l.id,
      as: l.meta?.as,
      at: l.createdAt,
      by: l.user?.name || null,
      post: { ...l.post, date: l.post.date ? l.post.date.toISOString().slice(0, 10) : null },
    })),
  });
});

// One client's dashboard (admins, or that client's own users)
router.get('/client/:clientId', async (req, res) => {
  const client = await prisma.client.findFirst({ where: { OR: [{ id: req.params.clientId }, { slug: req.params.clientId }] } });
  if (!client) throw notFound('Client not found');
  assertClientAccess(req.user, client.id);

  const today = todayISO();
  const range = isISO(req.query.from) && isISO(req.query.to) ? { from: req.query.from, to: req.query.to } : monthRange(today);
  const dateWhere = { gte: dateFromISO(range.from), lte: dateFromISO(range.to) };
  const base = { clientId: client.id };

  const [statusGroups, pillarGroups, rangePosts, awaiting, next7, metrics, ideas, pillars] = await Promise.all([
    prisma.post.groupBy({ by: ['status'], where: { ...base, archivedAt: null, date: dateWhere }, _count: { _all: true } }),
    prisma.post.groupBy({ by: ['pillarId'], where: { ...base, archivedAt: null, date: dateWhere }, _count: { _all: true } }),
    prisma.post.findMany({ where: { ...base, archivedAt: null, date: dateWhere }, select: { placements: true, kind: true } }),
    prisma.post.findMany({ where: { ...base, archivedAt: null, status: 'FOR_APPROVAL' }, include: postListInclude, orderBy: { date: 'asc' }, take: 50 }),
    prisma.post.findMany({
      where: { ...base, archivedAt: null, date: { gte: dateFromISO(today), lte: dateFromISO(addDaysISO(today, 7)) }, status: { not: 'IDEA' } },
      include: postListInclude,
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
    }),
    prisma.post.aggregate({
      where: { ...base, archivedAt: null, date: dateWhere },
      _sum: { reach: true, engagement: true, reacts: true, comments: true, shares: true, linkClicks: true },
    }),
    prisma.post.count({ where: { ...base, archivedAt: null, date: null } }),
    prisma.pillar.findMany({ where: base, select: { id: true, name: true, color: true } }),
  ]);

  const byStatus = Object.fromEntries(statusGroups.map((g) => [g.status, g._count._all]));
  const pillarById = new Map(pillars.map((p) => [p.id, p]));
  const pillarMix = pillarGroups
    .map((g) => ({
      pillarId: g.pillarId,
      name: g.pillarId ? pillarById.get(g.pillarId)?.name ?? 'Unknown' : 'Uncategorized',
      color: g.pillarId ? pillarById.get(g.pillarId)?.color ?? '#94a3b8' : '#94a3b8',
      count: g._count._all,
    }))
    .sort((a, b) => b.count - a.count);
  const placementMix = {};
  for (const p of rangePosts) for (const pl of p.placements) placementMix[pl] = (placementMix[pl] || 0) + 1;

  const total = rangePosts.length;
  const live = (byStatus.PUBLISHED || 0) + (byStatus.BOOSTED || 0);

  res.json({
    client,
    today,
    range,
    totals: {
      total,
      published: live,
      awaitingApproval: awaiting.length,
      needsEdits: (byStatus.TO_EDIT || 0) + (byStatus.REJECTED || 0),
      ads: rangePosts.filter((p) => p.kind === 'AD').length,
      ideas,
    },
    byStatus,
    pillarMix,
    placementMix,
    metrics: metrics._sum,
    awaiting: serializePosts(awaiting),
    next7: serializePosts(next7),
  });
});

export default router;
