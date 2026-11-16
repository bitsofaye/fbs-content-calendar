import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { notFound, slugify } from '../lib/http.js';
import { clientCreate, clientUpdate } from '../lib/schemas.js';
import { assertClientAccess, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { deleteClientForever, purgeTrash, TRASH_DAYS } from '../lib/trash.js';

const router = Router();

export const DEFAULT_PILLARS = [
  { name: 'Promotional', color: '#3b82f6' },
  { name: 'Educational / Tips', color: '#10b981' },
  { name: 'Engagement', color: '#f59e0b' },
  { name: 'Testimonials', color: '#8b5cf6' },
  { name: 'Announcements', color: '#f97316' },
  { name: 'Holiday', color: '#e11d48' },
];

async function uniqueSlug(base, excludeId) {
  let slug = slugify(base);
  for (let i = 2; ; i++) {
    const hit = await prisma.client.findUnique({ where: { slug } });
    if (!hit || hit.id === excludeId) return slug;
    slug = `${slugify(base)}-${i}`;
  }
}

// clients in the Trash are hidden everywhere except the Trash list
async function findClient(key) {
  return prisma.client.findFirst({ where: { deletedAt: null, OR: [{ id: key }, { slug: key }] } });
}

router.get('/', async (req, res) => {
  const where =
    req.user.role === 'ADMIN'
      ? req.query.includeArchived === 'true'
        ? { deletedAt: null }
        : { active: true, deletedAt: null }
      : { id: req.user.clientId ?? '__none__' };
  const clients = await prisma.client.findMany({
    where,
    orderBy: { name: 'asc' },
    include: { _count: { select: { posts: true, users: true, pillars: true } } },
  });
  res.json({ clients });
});

// ---------- Trash: deleted clients are kept for 30 days, then removed for good ----------

router.get('/trash', requireAdmin, async (_req, res) => {
  await purgeTrash();
  const clients = await prisma.client.findMany({
    where: { deletedAt: { not: null } },
    orderBy: { deletedAt: 'desc' },
    include: { _count: { select: { posts: true, users: true, pillars: true } } },
  });
  res.json({
    days: TRASH_DAYS,
    clients: clients.map((c) => ({ ...c, purgeAt: new Date(c.deletedAt.getTime() + TRASH_DAYS * 86400000) })),
  });
});

router.post('/:id/trash', requireAdmin, async (req, res) => {
  const existing = await prisma.client.findFirst({ where: { id: req.params.id, deletedAt: null } });
  if (!existing) throw notFound('Client not found');
  const client = await prisma.client.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });
  res.json({ client });
});

router.post('/:id/restore', requireAdmin, async (req, res) => {
  const existing = await prisma.client.findFirst({ where: { id: req.params.id, deletedAt: { not: null } } });
  if (!existing) throw notFound('This client is not in the Trash');
  const client = await prisma.client.update({ where: { id: existing.id }, data: { deletedAt: null } });
  res.json({ client });
});

// Delete for good, right away (only from the Trash)
router.delete('/:id/permanent', requireAdmin, async (req, res) => {
  const existing = await prisma.client.findFirst({ where: { id: req.params.id, deletedAt: { not: null } } });
  if (!existing) throw notFound('Only clients in the Trash can be deleted for good');
  await deleteClientForever(existing.id);
  res.json({ ok: true });
});

router.get('/:key', async (req, res) => {
  const client = await findClient(req.params.key);
  if (!client) throw notFound('Client not found');
  assertClientAccess(req.user, client.id);
  const pillars = await prisma.pillar.findMany({
    where: { clientId: client.id },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
  res.json({ client: { ...client, pillars } });
});

router.post('/', requireAdmin, validate(clientCreate), async (req, res) => {
  const { withDefaultPillars, slug, logoUrl, secondaryColor, ...data } = req.valid.body;
  const client = await prisma.client.create({
    data: {
      ...data,
      logoUrl: logoUrl || null,
      secondaryColor: secondaryColor || null,
      slug: await uniqueSlug(slug || data.name),
      pillars: withDefaultPillars ? { create: DEFAULT_PILLARS.map((p, i) => ({ ...p, sortOrder: i })) } : undefined,
    },
  });
  res.status(201).json({ client });
});

router.patch('/:id', requireAdmin, validate(clientUpdate), async (req, res) => {
  const existing = await prisma.client.findUnique({ where: { id: req.params.id } });
  if (!existing) throw notFound('Client not found');
  const { slug, logoUrl, secondaryColor, ...data } = req.valid.body;
  const client = await prisma.client.update({
    where: { id: existing.id },
    data: {
      ...data,
      ...(logoUrl !== undefined ? { logoUrl: logoUrl || null } : {}),
      ...(secondaryColor !== undefined ? { secondaryColor: secondaryColor || null } : {}),
      ...(slug ? { slug: await uniqueSlug(slug, existing.id) } : {}),
    },
  });
  res.json({ client });
});

// Archive (soft delete) — keeps the client's history
router.delete('/:id', requireAdmin, async (req, res) => {
  const client = await prisma.client.update({ where: { id: req.params.id }, data: { active: false } });
  res.json({ client });
});

export default router;
