import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { prisma } from '../lib/prisma.js';
import { forbidden, unauthorized } from '../lib/http.js';

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, clientId: user.clientId ?? null }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

export async function requireAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw unauthorized();

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    throw unauthorized('Session expired or invalid — please sign in again');
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: { client: { select: { id: true, name: true, slug: true, brandColor: true } } },
  });
  if (!user || !user.active) throw unauthorized('Account not found or disabled');

  req.user = user;
  next();
}

export const requireRole =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) throw forbidden();
    next();
  };

export const requireAdmin = requireRole('ADMIN');

/** Throws 403 unless the user may see data of this client. Admins see everything. */
export function assertClientAccess(user, clientId) {
  if (user.role === 'ADMIN') return;
  if (!clientId || user.clientId !== clientId) throw forbidden('You do not have access to this client');
}

/** CLIENT users are always pinned to their own client; admins may pass any (or none). */
export function resolveClientId(user, requested) {
  if (user.role === 'CLIENT') {
    if (requested && requested !== user.clientId) throw forbidden('You do not have access to this client');
    return user.clientId;
  }
  return requested || null;
}
