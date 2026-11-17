import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { badRequest } from '../lib/http.js';
import { themeUpsert } from '../lib/schemas.js';
import { requireAdmin, resolveClientId } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.get('/', async (req, res) => {
  const clientId = resolveClientId(req.user, req.query.clientId);
  if (!clientId) throw badRequest('clientId is required');
  const year = req.query.year ? Number(req.query.year) : undefined;
  const themes = await prisma.monthlyTheme.findMany({
    where: { clientId, ...(year ? { year } : {}) },
    orderBy: [{ year: 'asc' }, { month: 'asc' }],
  });
  res.json({ themes });
});

router.put('/', requireAdmin, validate(themeUpsert), async (req, res) => {
  const { clientId, year, month, weeklyFocus, ...rest } = req.valid.body;
  const data = { ...rest, weeklyFocus: weeklyFocus ?? Prisma.DbNull };
  const theme = await prisma.monthlyTheme.upsert({
    where: { clientId_year_month: { clientId, year, month } },
    create: { clientId, year, month, ...data },
    update: data,
  });
  res.json({ theme });
});

// Delete all of one client's monthly themes for one year
router.delete('/', requireAdmin, async (req, res) => {
  const clientId = typeof req.query.clientId === 'string' ? req.query.clientId : '';
  const year = Number(req.query.year);
  if (!clientId) throw badRequest('clientId is required');
  if (!Number.isInteger(year)) throw badRequest('year is required');
  const { count } = await prisma.monthlyTheme.deleteMany({ where: { clientId, year } });
  res.json({ ok: true, count });
});

router.delete('/:id', requireAdmin, async (req, res) => {
  await prisma.monthlyTheme.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

export default router;
