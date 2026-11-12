import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { badRequest, notFound } from '../lib/http.js';
import { postFields } from '../lib/schemas.js';
import { parseFbsWorkbook } from '../importers/fbsWorkbook.js';
import { commitImport, matchApprover } from '../importers/commitImport.js';
import { requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/\.xlsx$/i.test(file.originalname)) cb(null, true);
    else cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'file'));
  },
});

router.use(requireAdmin);

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Step 1: upload the workbook → parsed preview (nothing is written)
router.post('/preview', upload.single('file'), async (req, res) => {
  if (!req.file) throw badRequest('Attach the .xlsx file in the "file" field');
  const clientId = String(req.body.clientId || req.query.clientId || '');
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) throw notFound('Choose the client to import into');
  const year = Number(req.body.year || req.query.year) || null;
  const includeIdeas = String(req.body.includeIdeas ?? 'true') !== 'false';

  let parsed;
  try {
    parsed = await parseFbsWorkbook(req.file.buffer, { year, includeIdeas });
  } catch (e) {
    throw badRequest(`Could not read the workbook: ${e.message}`);
  }

  const [pillars, users, already] = await Promise.all([
    prisma.pillar.findMany({ where: { clientId }, select: { name: true } }),
    prisma.user.findMany({ where: { active: true, OR: [{ role: 'ADMIN' }, { clientId }] }, select: { id: true, name: true, role: true } }),
    prisma.post.findMany({
      where: { clientId, importSource: { in: parsed.posts.map((p) => p.importSource) } },
      select: { importSource: true },
    }),
  ]);
  const existingPillars = new Set(pillars.map((p) => norm(p.name)));
  const alreadySet = new Set(already.map((p) => p.importSource));
  const approvers = {};
  for (const p of parsed.posts) {
    if (p.approverName && !(p.approverName in approvers)) approvers[p.approverName] = matchApprover(p.approverName, users)?.name ?? null;
  }

  res.json({
    ...parsed,
    posts: parsed.posts.map((p) => ({ ...p, alreadyImported: alreadySet.has(p.importSource) })),
    pillarsToCreate: [...new Set(parsed.posts.map((p) => p.pillarName).filter((n) => n && !existingPillars.has(norm(n))))],
    approvers, // { "Sir Carlo": "Carlo Del Monte" | null }
    alreadyImported: alreadySet.size,
  });
});

// Step 2: send back the (possibly edited) preview rows to write them
const importRow = postFields
  .omit({ pillarId: true, approverId: true, assigneeId: true })
  .extend({
    importSource: z.string().min(1).max(300),
    pillarName: z.string().max(120).nullable().optional(),
    source: z.string().optional(),
    alreadyImported: z.boolean().optional(),
  });
const commitSchema = z.object({ clientId: z.string().min(1), posts: z.array(importRow).min(1).max(5000) });

router.post('/commit', validate(commitSchema), async (req, res) => {
  const { clientId, posts } = req.valid.body;
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) throw notFound('Client not found');
  const result = await commitImport(prisma, { clientId, posts, userId: req.user.id });
  res.status(201).json(result);
});

export default router;
