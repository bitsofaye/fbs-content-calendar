import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarClock, Clock, Inbox, ListChecks, UserCheck } from 'lucide-react';
import { useOverview } from '../api/hooks';
import { EmptyState, FullPageSpinner } from '../components/ui';
import PostRow from '../components/PostRow';

const TABS = [
  { id: 'mine', label: 'My approvals', icon: UserCheck, key: 'myApprovals', empty: 'Nothing is waiting for you' },
  { id: 'waiting', label: 'Waiting for approval', icon: Clock, key: 'awaitingApproval', empty: 'No posts are waiting for approval' },
  { id: 'edits', label: 'Needs edits', icon: ListChecks, key: 'needsEdits', empty: 'No change requests' },
  { id: 'next7', label: 'Next 7 days', icon: CalendarClock, key: 'upcoming', empty: 'Nothing is scheduled in the next 7 days' },
  { id: 'requests', label: 'From clients', icon: Inbox, key: 'clientRequests', empty: 'No new posts from clients' },
];

// All the work queues across clients, one tab at a time.
export default function ApprovalsPage() {
  const { data, isLoading } = useOverview();
  const [sp, setSp] = useSearchParams();
  const tab = TABS.find((t) => t.id === sp.get('tab')) || TABS[0];
  const clientId = sp.get('client') || '';

  const set = (patch) =>
    setSp((prev) => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k));
      return next;
    }, { replace: true });

  const clientsInLists = useMemo(() => {
    if (!data) return [];
    const m = new Map();
    for (const t of TABS) for (const p of data[t.key] || []) m.set(p.client.id, p.client);
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  if (isLoading || !data) return <FullPageSpinner />;
  const posts = (data[tab.key] || []).filter((p) => !clientId || p.client.id === clientId);

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
      <div>
        <h1 className="page-title">Approvals</h1>
        <p className="text-sm text-slate-500">Everything that needs a decision or a fix, across all clients.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-white p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => set({ tab: t.id === 'mine' ? null : t.id })}
              className={`flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-sm ${tab.id === t.id ? 'bg-brand-700 font-medium text-white shadow-sm' : 'bg-brand-50 text-brand-700 hover:bg-brand-100'}`}
            >
              <t.icon className="h-4 w-4" /> {t.label}
              <span className={`rounded-full px-1.5 text-[11px] tabular-nums ${tab.id === t.id ? 'bg-white/20' : 'bg-slate-100 text-slate-600'}`}>{(data[t.key] || []).length}</span>
            </button>
          ))}
        </div>
        <select className="input ml-auto w-auto" value={clientId} onChange={(e) => set({ client: e.target.value })} aria-label="Client">
          <option value="">All clients</option>
          {clientsInLists.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <section className="card overflow-hidden">
        {posts.length ? (
          <ul className="divide-y divide-slate-100">{posts.map((p) => <PostRow key={p.id} post={p} today={data.today} />)}</ul>
        ) : (
          <EmptyState icon={Inbox} title={tab.empty} />
        )}
      </section>
      <p className="text-xs text-slate-500">Click a post to open it in its client’s calendar.</p>
    </div>
  );
}
