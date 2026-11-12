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

router.delete('/:id', requireAdmin, async (req, res) => {
  await prisma.monthlyTheme.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

export default router;
