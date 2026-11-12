import { config } from './config.js';
import { createApp } from './app.js';
import { prisma } from './lib/prisma.js';

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`API ready on http://localhost:${config.port}/api  (allowed origins: ${config.clientOrigins.join(', ')})`);
});

async function shutdown() {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
