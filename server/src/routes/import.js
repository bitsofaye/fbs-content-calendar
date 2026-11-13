// Import posts from a CSV file (Manage → Import CSV).
// The old FBS workbook (.xlsx) import is still available from the command line: npm run import -w server
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { badRequest, notFound } from '../lib/http.js';
import { postFields } from '../lib/schemas.js';
import { parseContentCsv } from '../importers/csvImport.js';
import { commitImport, matchApprover } from '../importers/commitImport.js';
import { requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();
router.use(requireAdmin);

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Step 1: the CSV text → preview rows (nothing is written)
const csvPreviewSchema = z.object({ clientId: z.string().min(1), csv: z.string().min(1, 'The file is empty').max(4_500_000) });

router.post('/preview-csv', validate(csvPreviewSchema), async (req, res) => {
  const { clientId, csv } = req.valid.body;
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) throw notFound('Choose the client to import into');

  let parsed;
  try {
    parsed = parseContentCsv(csv);
  } catch (e) {
    throw badRequest(e.message);
  }
  if (parsed.posts.length > 5000) throw badRequest('Import at most 5,000 rows at a time. Split the file and import each part.');

  const dates = [...new Set(parsed.posts.map((p) => p.date).filter(Boolean))].map((d) => new Date(`${d}T00:00:00.000Z`));
  const [pillars, users, bySource, sameDay] = await Promise.all([
    prisma.pillar.findMany({ where: { clientId }, select: { name: true } }),
    prisma.user.findMany({ where: { active: true, OR: [{ role: 'ADMIN' }, { clientId }] }, select: { id: true, name: true, role: true } }),
    prisma.post.findMany({ where: { clientId, importSource: { in: parsed.posts.map((p) => p.importSource) } }, select: { importSource: true } }),
    // posts typed in by hand on the same day with the same topic also count as "already there"
    dates.length
      ? prisma.post.findMany({ where: { clientId, archivedAt: null, date: { in: dates } }, select: { date: true, title: true } })
      : [],
  ]);
  const existingPillars = new Set(pillars.map((p) => norm(p.name)));
  const already = new Set(bySource.map((p) => p.importSource));
  const sameDayKeys = new Set(sameDay.map((p) => `${p.date.toISOString().slice(0, 10)}|${norm(p.title)}`));
  const approvers = {};
  for (const p of parsed.posts) {
    if (p.approverName && !(p.approverName in approvers)) approvers[p.approverName] = matchApprover(p.approverName, users)?.name ?? null;
  }
  const posts = parsed.posts.map((p) => ({
    ...p,
    alreadyImported: already.has(p.importSource) || (p.date && sameDayKeys.has(`${p.date}|${norm(p.title)}`)),
  }));

  res.json({
    ...parsed,
    posts,
    pillarsToCreate: [...new Set(posts.map((p) => p.pillarName).filter((n) => n && !existingPillars.has(norm(n))))],
    approvers,
    alreadyImported: posts.filter((p) => p.alreadyImported).length,
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
