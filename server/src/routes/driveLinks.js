import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { badRequest, forbidden, notFound } from '../lib/http.js';
import { assertClientAccess, resolveClientId } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

// Shared links of a client:
//   DRIVE — Google Drive folders / files (pubmats, brand kit, photos)
//   FILE  — any useful file, website, reference or online document
// FBS and the client's own users can add links. FBS can change any link; a client user only the ones they added.
const router = Router();

const KINDS = ['DRIVE', 'FILE'];
const url = z.string().trim().max(2000).regex(/^https?:\/\/\S+$/i, 'The link must start with https://');
const title = z.string().trim().min(1, 'Give the link a title').max(200);
const createSchema = z.object({ clientId: z.string().min(1), kind: z.enum(KINDS).default('DRIVE'), title, url });
const updateSchema = z.object({ title, url, sortOrder: z.number().int() }).partial();
const include = { createdBy: { select: { id: true, name: true, role: true } } };

async function loadLink(id, user) {
  const link = await prisma.driveLink.findUnique({ where: { id } });
  if (!link) throw notFound('Link not found');
  assertClientAccess(user, link.clientId);
  if (user.role !== 'ADMIN' && link.createdById !== user.id) throw forbidden('You can only change links you added');
  return link;
}

router.get('/', async (req, res) => {
  const clientId = resolveClientId(req.user, req.query.clientId);
  if (!clientId) throw badRequest('clientId is required');
  const kind = KINDS.includes(req.query.kind) ? req.query.kind : undefined;
  const links = await prisma.driveLink.findMany({
    where: { clientId, ...(kind ? { kind } : {}) },
    include,
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  res.json({ links });
});

router.post('/', validate(createSchema), async (req, res) => {
  const { clientId, kind, ...data } = req.valid.body;
  assertClientAccess(req.user, clientId);
  const client = await prisma.client.findFirst({ where: { id: clientId, deletedAt: null } });
  if (!client) throw badRequest('Client not found');
  const count = await prisma.driveLink.count({ where: { clientId, kind } });
  const link = await prisma.driveLink.create({
    data: { clientId, kind, ...data, sortOrder: count, createdById: req.user.id },
    include,
  });
  res.status(201).json({ link });
});

router.patch('/:id', validate(updateSchema), async (req, res) => {
  const existing = await loadLink(req.params.id, req.user);
  const link = await prisma.driveLink.update({ where: { id: existing.id }, data: req.valid.body, include });
  res.json({ link });
});

router.delete('/:id', async (req, res) => {
  const existing = await loadLink(req.params.id, req.user);
  await prisma.driveLink.delete({ where: { id: existing.id } });
  res.json({ ok: true });
});

export default router;
