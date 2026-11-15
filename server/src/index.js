import { config } from './config.js';
import { createApp } from './app.js';
import { prisma } from './lib/prisma.js';
import { scheduleTrashPurge } from './lib/trash.js';

const app = createApp();

const server = app.listen(config.port, () => {
  scheduleTrashPurge();
  console.log(`API ready on http://localhost:${config.port}/api  (allowed origins: ${config.clientOrigins.join(', ')})`);
});

async function shutdown() {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
