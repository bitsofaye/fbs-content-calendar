import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { badRequest, notFound } from '../lib/http.js';
import { pillarCreate, pillarUpdate } from '../lib/schemas.js';
import { requireAdmin, resolveClientId } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.get('/', async (req, res) => {
  const clientId = resolveClientId(req.user, req.query.clientId);
  if (!clientId) throw badRequest('clientId is required');
  const pillars = await prisma.pillar.findMany({
    where: { clientId },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { posts: true } } },
  });
  res.json({ pillars });
});

router.post('/', requireAdmin, validate(pillarCreate), async (req, res) => {
  const pillar = await prisma.pillar.create({ data: req.valid.body });
  res.status(201).json({ pillar });
});

router.patch('/:id', requireAdmin, validate(pillarUpdate), async (req, res) => {
  const pillar = await prisma.pillar.update({ where: { id: req.params.id }, data: req.valid.body });
  res.json({ pillar });
});

router.delete('/:id', requireAdmin, async (req, res) => {
  const pillar = await prisma.pillar.findUnique({ where: { id: req.params.id } });
  if (!pillar) throw notFound('Pillar not found');
  await prisma.pillar.delete({ where: { id: pillar.id } }); // posts keep existing, pillar set to null
  res.json({ ok: true });
});

export default router;
