import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { badRequest, notFound } from '../lib/http.js';
import { publicUser } from '../lib/serialize.js';
import { userCreate, userUpdate } from '../lib/schemas.js';
import { requireAdmin, resolveClientId } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { matchApprover } from '../importers/commitImport.js';

const router = Router();
const withClient = { client: { select: { id: true, name: true, slug: true, brandColor: true } } };

// People who can be picked as approver / assignee for a client's posts: all admins + that client's users
router.get('/options', async (req, res) => {
  const clientId = resolveClientId(req.user, req.query.clientId);
  const users = await prisma.user.findMany({
    where: { active: true, OR: [{ role: 'ADMIN' }, ...(clientId ? [{ clientId }] : [])] },
    select: { id: true, name: true, role: true },
    orderBy: { name: 'asc' },
  });
  res.json({ users });
});

router.get('/', requireAdmin, async (req, res) => {
  const users = await prisma.user.findMany({
    where: req.query.clientId ? { clientId: String(req.query.clientId) } : {},
    include: withClient,
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
  });
  res.json({ users: users.map(publicUser) });
});

// Imported posts keep the sheet's approver text ("Sir Carlo") until a matching user exists.
// When a user is created/renamed, link those posts to them.
async function relinkImportedApprovers(user) {
  const names = await prisma.post.findMany({
    where: { approverId: null, approverName: { not: null }, ...(user.role === 'CLIENT' ? { clientId: user.clientId } : {}) },
    distinct: ['approverName'],
    select: { approverName: true },
  });
  let linked = 0;
  for (const { approverName } of names) {
    if (!matchApprover(approverName, [user])) continue;
    const r = await prisma.post.updateMany({
      where: { approverId: null, approverName, ...(user.role === 'CLIENT' ? { clientId: user.clientId } : {}) },
      data: { approverId: user.id, approverName: null },
    });
    linked += r.count;
  }
  return linked;
}

function checkRoleClient(role, clientId) {
  if (role === 'CLIENT' && !clientId) throw badRequest('A client login must be linked to a client');
}

router.post('/', requireAdmin, validate(userCreate), async (req, res) => {
  const { password, clientId, ...data } = req.valid.body;
  checkRoleClient(data.role, clientId);
  const user = await prisma.user.create({
    data: { ...data, clientId: data.role === 'CLIENT' ? clientId : null, passwordHash: await bcrypt.hash(password, 10) },
    include: withClient,
  });
  const linkedPosts = await relinkImportedApprovers(user);
  res.status(201).json({ user: publicUser(user), linkedPosts });
});

router.patch('/:id', requireAdmin, validate(userUpdate), async (req, res) => {
  const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!existing) throw notFound('User not found');
  const { password, ...data } = req.valid.body;
  const role = data.role ?? existing.role;
  const clientId = data.clientId !== undefined ? data.clientId : existing.clientId;
  checkRoleClient(role, clientId);
  if (existing.id === req.user.id && (data.active === false || data.role === 'CLIENT')) {
    throw badRequest('You cannot disable or demote your own account');
  }
  const user = await prisma.user.update({
    where: { id: existing.id },
    data: {
      ...data,
      clientId: role === 'CLIENT' ? clientId : null,
      ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
    },
    include: withClient,
  });
  const linkedPosts = user.active ? await relinkImportedApprovers(user) : 0;
  res.json({ user: publicUser(user), linkedPosts });
});

// Deactivate instead of deleting so comments and history keep their author
router.delete('/:id', requireAdmin, async (req, res) => {
  if (req.params.id === req.user.id) throw badRequest('You cannot disable your own account');
  const user = await prisma.user.update({ where: { id: req.params.id }, data: { active: false }, include: withClient });
  res.json({ user: publicUser(user) });
});

export default router;
