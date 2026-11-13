import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { badRequest, notFound } from '../lib/http.js';
import { requireAdmin, resolveClientId } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

// Shared Google Drive folders / files of a client. FBS adds them; the client's own logins can see them.
const router = Router();

const url = z.string().trim().max(2000).regex(/^https:\/\/\S+$/i, 'The link must start with https://');
const title = z.string().trim().min(1, 'Give the link a title').max(200);
const createSchema = z.object({ clientId: z.string().min(1), title, url });
const updateSchema = z.object({ title, url, sortOrder: z.number().int() }).partial();

router.get('/', async (req, res) => {
  const clientId = resolveClientId(req.user, req.query.clientId);
  if (!clientId) throw badRequest('clientId is required');
  const links = await prisma.driveLink.findMany({ where: { clientId }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
  res.json({ links });
});

router.post('/', requireAdmin, validate(createSchema), async (req, res) => {
  const { clientId, ...data } = req.valid.body;
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) throw badRequest('Client not found');
  const count = await prisma.driveLink.count({ where: { clientId } });
  const link = await prisma.driveLink.create({ data: { clientId, ...data, sortOrder: count } });
  res.status(201).json({ link });
});

router.patch('/:id', requireAdmin, validate(updateSchema), async (req, res) => {
  const existing = await prisma.driveLink.findUnique({ where: { id: req.params.id } });
  if (!existing) throw notFound('Drive link not found');
  const link = await prisma.driveLink.update({ where: { id: existing.id }, data: req.valid.body });
  res.json({ link });
});

router.delete('/:id', requireAdmin, async (req, res) => {
  const existing = await prisma.driveLink.findUnique({ where: { id: req.params.id } });
  if (!existing) throw notFound('Drive link not found');
  await prisma.driveLink.delete({ where: { id: existing.id } });
  res.json({ ok: true });
});

export default router;
