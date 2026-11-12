// Dates are stored as @db.Date; send them as plain "YYYY-MM-DD" strings so browsers in any
// timezone show the same calendar day.
export function serializePost(p) {
  if (!p) return p;
  return { ...p, date: p.date ? p.date.toISOString().slice(0, 10) : null };
}

export const serializePosts = (list) => list.map(serializePost);

export function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    clientId: u.clientId,
    active: u.active,
    client: u.client ? { id: u.client.id, name: u.client.name, slug: u.client.slug, brandColor: u.client.brandColor } : null,
    createdAt: u.createdAt,
  };
}

export const postListInclude = {
  pillar: { select: { id: true, name: true, color: true } },
  approver: { select: { id: true, name: true } },
  assignee: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true, role: true } },
  _count: { select: { commentList: true } },
};
