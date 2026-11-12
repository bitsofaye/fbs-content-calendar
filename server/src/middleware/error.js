import { Prisma } from '@prisma/client';
import multer from 'multer';
import { HttpError } from '../lib/http.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'A record with that value already exists', details: err.meta });
    if (err.code === 'P2025') return res.status(404).json({ error: 'Record not found' });
    if (err.code === 'P2003') return res.status(400).json({ error: 'Related record does not exist', details: err.meta });
  }
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Request body too large' });

  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server' });
}
