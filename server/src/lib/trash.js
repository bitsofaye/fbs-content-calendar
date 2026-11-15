import { prisma } from './prisma.js';

// Clients stay in the Trash for this many days, then they are deleted for good
export const TRASH_DAYS = 30;

/** Deletes one client for good: its posts, pillars, themes and Drive links (cascade) and its own logins. */
export async function deleteClientForever(clientId) {
  await prisma.$transaction([
    prisma.user.deleteMany({ where: { clientId, role: 'CLIENT' } }),
    prisma.client.delete({ where: { id: clientId } }),
  ]);
}

/** Removes clients that have been in the Trash longer than TRASH_DAYS. Returns how many were removed. */
export async function purgeTrash() {
  const cutoff = new Date(Date.now() - TRASH_DAYS * 86400000);
  const old = await prisma.client.findMany({ where: { deletedAt: { lt: cutoff } }, select: { id: true } });
  for (const c of old) await deleteClientForever(c.id);
  return old.length;
}

/** Runs purgeTrash now and then every few hours while the server is up. */
export function scheduleTrashPurge(everyHours = 6) {
  const run = () =>
    purgeTrash()
      .then((n) => n && console.log(`Trash: ${n} client(s) older than ${TRASH_DAYS} days deleted`))
      .catch((e) => console.error('Trash purge failed:', e.message));
  run();
  return setInterval(run, everyHours * 3600000).unref();
}
