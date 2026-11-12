// Turns the admin overview data into a simple health check per client:
// what (if anything) needs attention, and an overall label.

export const HEALTH = {
  BEHIND: { label: 'Behind', rank: 0, cls: 'bg-red-50 text-red-700 ring-red-200' },
  ATTENTION: { label: 'Needs attention', rank: 1, cls: 'bg-amber-50 text-amber-800 ring-amber-300' },
  OK: { label: 'On track', rank: 2, cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
};

export function clientHealth(data) {
  const today = data.today;
  const byClient = (list) => {
    const m = {};
    for (const p of list) (m[p.client.id] ||= []).push(p);
    return m;
  };
  const waiting = byClient(data.awaitingApproval);
  const edits = byClient(data.needsEdits);
  const next7 = byClient(data.upcoming);
  const requests = byClient(data.clientRequests || []);
  const flagged = byClient(data.ideasNeedingAttention || []);

  return data.clients.map((c) => {
    const m = c.month || { total: 0, byStatus: {} };
    const published = (m.byStatus.PUBLISHED || 0) + (m.byStatus.BOOSTED || 0);
    const w = waiting[c.id] || [];
    const e = edits[c.id] || [];
    const n = next7[c.id] || [];
    const overdue = [...w, ...e].filter((p) => p.date && p.date < today).length;

    // "waiting for approval" on its own is a normal step, not a problem — it shows in the table, not as a warning
    const reasons = [];
    if (overdue) reasons.push({ tone: 'red', text: `${overdue} past their date and not approved` });
    if (!n.length) reasons.push({ tone: 'red', text: 'Nothing planned for the next 7 days' });
    if (e.length) reasons.push({ tone: 'amber', text: `${e.length} need${e.length === 1 ? 's' : ''} edits` });
    const r = requests[c.id] || [];
    if (r.length) reasons.push({ tone: 'amber', text: `${r.length} new from the client` });
    const f = flagged[c.id] || [];
    if (f.length) reasons.push({ tone: 'amber', text: `${f.length} idea${f.length === 1 ? '' : 's'} need${f.length === 1 ? 's' : ''} attention` });

    const health = reasons.some((r) => r.tone === 'red') ? 'BEHIND' : reasons.length ? 'ATTENTION' : 'OK';
    return {
      ...c,
      total: m.total,
      published,
      pct: m.total ? Math.round((published / m.total) * 100) : 0,
      waiting: w.length,
      edits: e.length,
      next7: n.length,
      overdue,
      reasons,
      health,
    };
  });
}
