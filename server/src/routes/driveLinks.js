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

// Browse the files inside a shared Drive folder ("Anyone with the link"), through the Google Drive API.
// Needs GOOGLE_API_KEY on the server (Google Cloud → APIs & Services → Credentials, with the Drive API enabled).
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const driveId = z.string().regex(/^[\w-]{10,200}$/, 'Not a Drive folder');
const browseQuery = z.object({ clientId: z.string().optional(), folderId: driveId, pageToken: z.string().max(2000).optional() });

async function drive(path, params) {
  const url = new URL(`https://www.googleapis.com/drive/v3/${path}`);
  for (const [k, v] of Object.entries({ ...params, key: process.env.GOOGLE_API_KEY })) if (v !== undefined) url.searchParams.set(k, v);
  const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (r.status === 404) throw notFound('This folder is not shared as “Anyone with the link”, or it no longer exists.');
    if (r.status === 403) throw badRequest('Google refused to list this folder. Check that it is shared as “Anyone with the link” and that the Drive API is enabled for the server’s Google key.');
    throw badRequest(`Google Drive did not answer (${r.status}). Try again.`);
  }
  return body;
}

router.get('/browse', validate(browseQuery, 'query'), async (req, res) => {
  resolveClientId(req.user, req.valid.query.clientId); // client logins only browse for their own calendar
  if (!process.env.GOOGLE_API_KEY) return res.json({ configured: false });
  const { folderId, pageToken } = req.valid.query;
  const [folder, list] = await Promise.all([
    drive(`files/${folderId}`, { fields: 'id,name,mimeType', supportsAllDrives: 'true' }),
    drive('files', {
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken,files(id,name,mimeType,thumbnailLink,iconLink,webViewLink,modifiedTime,size,videoMediaMetadata(durationMillis))',
      orderBy: 'folder,name_natural',
      pageSize: '200',
      pageToken,
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
    }),
  ]);
  if (folder.mimeType !== FOLDER_MIME) throw badRequest('That link is a file, not a folder.');
  res.json({
    configured: true,
    folder: { id: folder.id, name: folder.name },
    nextPageToken: list.nextPageToken || null,
    files: (list.files || []).map((f) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      isFolder: f.mimeType === FOLDER_MIME,
      thumbnail: f.thumbnailLink || null,
      icon: f.iconLink || null,
      url: f.webViewLink || (f.mimeType === FOLDER_MIME ? `https://drive.google.com/drive/folders/${f.id}` : `https://drive.google.com/file/d/${f.id}/view`),
      modifiedTime: f.modifiedTime || null,
      size: f.size ? Number(f.size) : null,
      durationMs: f.videoMediaMetadata?.durationMillis ? Number(f.videoMediaMetadata.durationMillis) : null,
    })),
  });
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
