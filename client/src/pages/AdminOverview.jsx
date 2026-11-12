import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, CalendarClock, CalendarRange, CheckCircle2, ChevronRight, Clock, ListChecks, Plus, Search, Star } from 'lucide-react';
import { useOverview } from '../api/hooks';
import { useAuth } from '../context/AuthContext';
import { monthLabel } from '../lib/dates';
import { clientHealth, HEALTH } from '../lib/health';
import { usePins } from '../lib/pins';
import { EmptyState, FullPageSpinner, KpiTile, PageHeader } from '../components/ui';

function HealthPill({ health }) {
  const h = HEALTH[health];
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ring-1 ring-inset ${h.cls}`}>{h.label}</span>;
}

const SORTS = {
  attention: { label: 'Needs attention first', fn: (a, b) => HEALTH[a.health].rank - HEALTH[b.health].rank || b.waiting + b.edits - (a.waiting + a.edits) || a.name.localeCompare(b.name) },
  name: { label: 'Name (A–Z)', fn: (a, b) => a.name.localeCompare(b.name) },
  posts: { label: 'Most posts this month', fn: (a, b) => b.total - a.total || a.name.localeCompare(b.name) },
};

export default function AdminOverview() {
  const { user } = useAuth();
  const { data, isLoading } = useOverview();
  const { isPinned, toggle } = usePins(user?.id);
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [show, setShow] = useState('all');
  const [sp] = useSearchParams();
  const [sort, setSort] = useState(sp.get('sort') || 'attention');
  const tableRef = useRef(null);
  // "Posts this month" tile → sort the client table by posts and bring it into view
  useEffect(() => {
    const s = sp.get('sort');
    if (s && SORTS[s]) {
      setSort(s);
      setTimeout(() => tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    }
  }, [sp]);
  const [showAllAttention, setShowAllAttention] = useState(false);

  const rows = useMemo(() => (data ? clientHealth(data) : []), [data]);
  if (isLoading || !data) return <FullPageSpinner />;

  const totals = {
    posts: rows.reduce((s, r) => s + r.total, 0),
    published: rows.reduce((s, r) => s + r.published, 0),
    waiting: data.awaitingApproval.length,
    edits: data.needsEdits.length,
    next7: data.upcoming.length,
  };
  const attention = rows.filter((r) => r.health !== 'OK').sort(SORTS.attention.fn);
  const attentionShown = showAllAttention ? attention : attention.slice(0, 5);

  const s = q.trim().toLowerCase();
  const table = rows
    .filter((r) => !s || r.name.toLowerCase().includes(s) || (r.industry || '').toLowerCase().includes(s))
    .filter((r) => (show === 'all' ? true : show === 'pinned' ? isPinned(r.id) : show === 'attention' ? r.health !== 'OK' : r.health === 'OK'))
    .sort(SORTS[sort].fn);

  return (
    <div className="mx-auto max-w-6xl space-y-7 p-4 sm:p-8">
      <PageHeader
        eyebrow={`Dashboard · ${monthLabel(data.today.slice(0, 7))}`}
        title={`Good day, ${user.name.split(' ')[0]}`}
        description={`All ${rows.length} content calendars at a glance — FBS and every client.`}
        actions={
          <Link to="/admin/clients?new=1" className="btn-primary">
            <Plus className="h-4 w-4" /> Add client
          </Link>
        }
      />

      {/* 1. four numbers for all clients together */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiTile solid to="/admin?sort=posts" label="Posts this month" value={totals.posts} icon={CalendarRange} hint={`${totals.published} published`} />
        <KpiTile to="/admin/approvals?tab=waiting" label="Waiting for approval" value={totals.waiting} icon={Clock} tone="amber" hint="all clients" />
        <KpiTile to="/admin/approvals?tab=edits" label="Needs edits" value={totals.edits} icon={ListChecks} tone="orange" hint="to edit / rejected" />
        <KpiTile to="/admin/approvals?tab=next7" label="Next 7 days" value={totals.next7} icon={CalendarClock} tone="brand" hint="posts going out" />
      </div>

      {/* 2. only the clients that need something */}
      <section className="card overflow-hidden">
        <header className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <h2 className="text-sm font-semibold text-brand-700">Needs attention</h2>
          <span className="rounded-full bg-slate-100 px-2 text-xs text-slate-600 tabular-nums">{attention.length}</span>
          <Link to="/admin/approvals" className="ml-auto text-xs font-medium text-brand-600 hover:underline">
            Open approvals
          </Link>
        </header>
        {attention.length ? (
          <ul className="divide-y divide-slate-100">
            {attentionShown.map((r) => (
              <li key={r.id}>
                <Link to={`/c/${r.slug}`} className="flex flex-col gap-1.5 px-4 py-2.5 hover:bg-slate-50 sm:flex-row sm:items-center sm:gap-3">
                  <span className="flex min-w-0 items-center gap-3 sm:w-60 sm:shrink-0">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.brandColor }} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{r.name}</span>
                    <ChevronRight className="h-4 w-4 text-slate-300 sm:hidden" />
                  </span>
                  <span className="flex flex-1 flex-wrap gap-1.5 pl-5.5 sm:pl-0">
                    {r.reasons.map((x) => (
                      <span key={x.text} className={`rounded-md px-2 py-0.5 text-xs ${x.tone === 'red' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'}`}>
                        {x.text}
                      </span>
                    ))}
                  </span>
                  <ChevronRight className="hidden h-4 w-4 text-slate-300 sm:block" />
                </Link>
              </li>
            ))}
            {attention.length > 5 && (
              <li>
                <button className="w-full cursor-pointer px-4 py-2 text-center text-xs font-medium text-brand-600 hover:bg-slate-50" onClick={() => setShowAllAttention((v) => !v)}>
                  {showAllAttention ? 'Show fewer' : `Show all ${attention.length}`}
                </button>
              </li>
            )}
          </ul>
        ) : (
          <EmptyState icon={CheckCircle2} title="All clients are on track">Nothing is waiting, late, or missing for next week.</EmptyState>
        )}
      </section>

      {/* 3. every client as one short row */}
      <section ref={tableRef} className="card scroll-mt-16 overflow-hidden">
        <header className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3.5">
          <h2 className="w-full text-sm font-semibold text-brand-700 lg:mr-auto lg:w-auto">All clients</h2>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input className="input w-44 py-1 pl-8 sm:w-56" placeholder="Search clients…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="input w-auto py-1" value={show} onChange={(e) => setShow(e.target.value)} aria-label="Show">
            <option value="all">All clients</option>
            <option value="attention">Needs attention / behind</option>
            <option value="ok">On track</option>
            <option value="pinned">Pinned</option>
          </select>
          <select className="input w-auto py-1" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
            {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-brand-50 text-left text-xs font-semibold text-slate-500">
              <tr>
                <th className="w-8 px-2 py-2" />
                <th className="px-2 py-2">Client</th>
                <th className="px-3 py-2">This month</th>
                <th className="hidden px-3 py-2 text-center md:table-cell">Waiting</th>
                <th className="hidden px-3 py-2 text-center md:table-cell">Needs edits</th>
                <th className="hidden px-3 py-2 text-center sm:table-cell">Next 7 days</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {table.map((r) => (
                <tr key={r.id} className="cursor-pointer hover:bg-slate-50" onClick={() => navigate(`/c/${r.slug}`)}>
                  <td className="px-2 py-2 text-center">
                    <button
                      className={`cursor-pointer rounded p-1 ${isPinned(r.id) ? 'text-brand-600' : 'text-slate-300 hover:text-slate-700'}`}
                      title={isPinned(r.id) ? 'Unpin from sidebar' : 'Pin to sidebar'}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggle(r.id);
                      }}
                    >
                      <Star className="h-4 w-4" fill={isPinned(r.id) ? 'currentColor' : 'none'} />
                    </button>
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.brandColor }} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-slate-800">{r.name}</span>
                        {r.industry && <span className="block truncate text-xs text-slate-500">{r.industry}</span>}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2" title={`${r.published} of ${r.total} published`}>
                      <span className="w-6 text-right font-medium tabular-nums">{r.total}</span>
                      <span className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-slate-100 sm:block">
                        <span className="block h-full rounded-full bg-brand-600" style={{ width: `${r.pct}%` }} />
                      </span>
                      <span className="hidden text-xs text-slate-500 lg:inline">{r.published} published</span>
                    </div>
                  </td>
                  <td className={`hidden px-3 py-2 text-center tabular-nums md:table-cell ${r.waiting ? 'font-semibold text-amber-700' : 'text-slate-500'}`}>{r.waiting}</td>
                  <td className={`hidden px-3 py-2 text-center tabular-nums md:table-cell ${r.edits ? 'font-semibold text-orange-700' : 'text-slate-500'}`}>{r.edits}</td>
                  <td className={`hidden px-3 py-2 text-center tabular-nums sm:table-cell ${r.next7 ? '' : 'text-red-600'}`}>{r.next7}</td>
                  <td className="px-3 py-2">
                    <HealthPill health={r.health} />
                  </td>
                </tr>
              ))}
              {!table.length && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                    {rows.length ? 'No client matches this search or filter.' : 'No clients yet. Add your first client to start planning.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
