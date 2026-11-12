import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { badRequest, unauthorized } from '../lib/http.js';
import { publicUser } from '../lib/serialize.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

router.post('/login', validate(loginSchema), async (req, res) => {
  const { email, password } = req.valid.body;
  const user = await prisma.user.findUnique({
    where: { email },
    include: { client: { select: { id: true, name: true, slug: true, brandColor: true } } },
  });
  // same message for unknown email and wrong password
  if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
    throw unauthorized('Incorrect email or password');
  }
  res.json({ token: signToken(user), user: publicUser(user) });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'New password must be at least 8 characters').max(200),
});

router.post('/change-password', requireAuth, validate(changePasswordSchema), async (req, res) => {
  const { currentPassword, newPassword } = req.valid.body;
  if (!(await bcrypt.compare(currentPassword, req.user.passwordHash))) throw badRequest('Current password is incorrect');
  await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash: await bcrypt.hash(newPassword, 10) } });
  res.json({ ok: true });
});

export default router;
