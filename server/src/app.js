import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { config } from './config.js';
import { requireAuth } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import authRoutes from './routes/auth.js';
import clientRoutes from './routes/clients.js';
import pillarRoutes from './routes/pillars.js';
import themeRoutes from './routes/themes.js';
import postRoutes from './routes/posts.js';
import userRoutes from './routes/users.js';
import dashboardRoutes from './routes/dashboard.js';
import importRoutes from './routes/import.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1); // Render sits behind a proxy

  app.use(
    cors({
      origin(origin, cb) {
        // allow tools like curl/Postman (no Origin header) and the configured frontends
        if (!origin || config.clientOrigins.includes(origin)) return cb(null, true);
        cb(null, false);
      },
    }),
  );
  app.use(express.json({ limit: '5mb' }));
  if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

  app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

  app.use('/api/auth', authRoutes);
  app.use('/api/clients', requireAuth, clientRoutes);
  app.use('/api/pillars', requireAuth, pillarRoutes);
  app.use('/api/themes', requireAuth, themeRoutes);
  app.use('/api/posts', requireAuth, postRoutes);
  app.use('/api/users', requireAuth, userRoutes);
  app.use('/api/dashboard', requireAuth, dashboardRoutes);
  app.use('/api/import', requireAuth, importRoutes);

  app.use('/api', notFoundHandler);
  app.use(errorHandler);
  return app;
}
