// Writes parsed workbook posts into the database for one client.
// Idempotent: rows are keyed by (clientId, importSource), so re-running skips rows already imported.

const PALETTE = ['#e11d48', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16', '#0ea5e9', '#a855f7'];

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const HONORIFICS = /^(sir|ms|mr|mrs|maam|ma'am|madam|miss|dr|engr|atty)\.?\s+/i;

export function approverToken(name) {
  return String(name || '').trim().replace(HONORIFICS, '').split(/\s+/)[0]?.toLowerCase() || '';
}

export function matchApprover(name, users) {
  const token = approverToken(name);
  if (!token) return null;
  const hits = users.filter((u) =>
    u.name
      .toLowerCase()
      .split(/\s+/)
      .some((part) => part === token),
  );
  return hits.length === 1 ? hits[0] : hits.find((u) => u.role === 'ADMIN') || hits[0] || null;
}

export async function commitImport(prisma, { clientId, posts, userId = null }) {
  // 1. pillars: reuse by name, create the missing ones
  const existing = await prisma.pillar.findMany({ where: { clientId } });
  const pillarByKey = new Map(existing.map((p) => [norm(p.name), p]));
  const createdPillars = [];
  let colorIdx = existing.length;
  for (const name of new Set(posts.map((p) => p.pillarName).filter(Boolean))) {
    if (pillarByKey.has(norm(name))) continue;
    const pillar = await prisma.pillar.create({
      data: { clientId, name, color: PALETTE[colorIdx++ % PALETTE.length], sortOrder: 100 + colorIdx },
    });
    pillarByKey.set(norm(name), pillar);
    createdPillars.push(name);
  }

  // 2. approvers: match "Sir Carlo" → a user whose name contains "Carlo"
  const users = await prisma.user.findMany({
    where: { active: true, OR: [{ role: 'ADMIN' }, { clientId }] },
    select: { id: true, name: true, role: true },
  });
  const matched = {};
  const unmatched = new Set();

  const data = posts.map((p) => {
    let approverId = null;
    if (p.approverName) {
      const u = matchApprover(p.approverName, users);
      if (u) {
        approverId = u.id;
        matched[p.approverName] = u.name;
      } else unmatched.add(p.approverName);
    }
    return {
      clientId,
      kind: p.kind,
      date: p.date ? new Date(`${p.date}T00:00:00.000Z`) : null,
      title: p.title,
      status: p.status,
      boost: p.boost || 'ORGANIC',
      pillarId: p.pillarName ? pillarByKey.get(norm(p.pillarName))?.id ?? null : null,
      placements: p.placements || [],
      format: p.format ?? null,
      storyboard: p.storyboard ?? null,
      graphicsIdea: p.graphicsIdea ?? null,
      titleDraft: p.titleDraft ?? null,
      caption: p.caption ?? null,
      hashtags: p.hashtags ?? null,
      pubmatLinks: p.pubmatLinks || [],
      referenceLink: p.referenceLink ?? null,
      remarks: p.remarks ?? null,
      approverId,
      approverName: approverId ? null : p.approverName ?? null,
      reacts: p.reacts ?? null,
      comments: p.comments ?? null,
      shares: p.shares ?? null,
      reach: p.reach ?? null,
      engagement: p.engagement ?? null,
      linkClicks: p.linkClicks ?? null,
      feedback: p.feedback ?? null,
      adDetails: p.adDetails ?? undefined,
      importSource: p.importSource,
      createdById: userId,
    };
  });

  const result = await prisma.post.createMany({ data, skipDuplicates: true });

  return {
    received: posts.length,
    created: result.count,
    alreadyImported: posts.length - result.count,
    pillarsCreated: createdPillars,
    approversMatched: matched,
    approversUnmatched: [...unmatched],
  };
}
