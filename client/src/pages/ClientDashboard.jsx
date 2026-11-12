import { useCallback, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  BarChart3, CalendarCheck, CalendarDays, CalendarRange, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronsUpDown, Clock, Columns3, Eye, Lightbulb, ListChecks, Plus,
  Rows3, Search, SlidersHorizontal, Sparkles, Star, Table2, Wand2, X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useClient, useClientDashboard, useGenerateMonth, usePosts, useThemes, useUserOptions } from '../api/hooks';
import { PLACEMENTS, STATUSES } from '../lib/constants';
import { formatDate, monthBounds, monthGrid, monthKey, monthLabel, shiftMonth, todayISO, weekOf } from '../lib/dates';
import { EmptyState, fmtNumber, FullPageSpinner, KpiTile } from '../components/ui';
import { openClientSwitcher, usePins } from '../lib/pins';
import PostDrawer from '../components/PostDrawer';
import PillarMix from '../components/PillarMix';
import CalendarView from './views/CalendarView';
import SheetView from './views/SheetView';
import DailyView from './views/DailyView';
import BoardView from './views/BoardView';
import IdeasView from './views/IdeasView';

const VIEWS = [
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'sheet', label: 'Content plan', icon: Table2 },
  { id: 'daily', label: 'Daily view', icon: Rows3 },
  { id: 'board', label: 'Board', icon: Columns3 },
  { id: 'ideas', label: 'Idea bank', icon: Lightbulb },
];

const NONE = [];
const FILTER_KEYS =['status', 'placement', 'pillarId', 'approverId', 'kind', 'q'];

export default function ClientDashboard() {
  const { slug } = useParams();
  const { isAdmin, user } = useAuth();
  const { isPinned, toggle: togglePin } = usePins(user?.id);
  const [sp, setSp] = useSearchParams();
  const today = todayISO();
  const view = sp.get('view') || 'calendar';
  const month = sp.get('month') || monthKey(today);
  const day = sp.get('day') || (monthKey(today) === month ? today : `${month}-01`);
  const calMode = sp.get('cal') || 'month';
  const openPostId = sp.get('post');
  const [draft, setDraft] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showAllAwaiting, setShowAllAwaiting] = useState(false);

  const update = useCallback(
    (patch) =>
      setSp(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch)) {
            if (v === null || v === undefined || v === '') next.delete(k);
            else next.set(k, v);
          }
          return next;
        },
        { replace: true },
      ),
    [setSp],
  );

  const filters = Object.fromEntries(FILTER_KEYS.map((k) => [k, sp.get(k) || undefined]));
  const hasFilters = FILTER_KEYS.some((k) => sp.get(k));
  const filterCount = FILTER_KEYS.filter((k) => k !== 'q' && sp.get(k)).length;

  const { data: client, isLoading, error } = useClient(slug);
  const bounds = monthBounds(month);
  const range = useMemo(() => {
    if (view === 'calendar' && calMode === 'week') {
      const w = weekOf(day);
      return { from: w[0], to: w[6] };
    }
    if (view === 'calendar') {
      const g = monthGrid(month);
      return { from: g.start, to: g.end };
    }
    if (view === 'daily') {
      // the whole month plus the edges of the selected week (it can run into the next/previous month)
      const w = weekOf(day);
      return { from: w[0] < bounds.from ? w[0] : bounds.from, to: w[6] > bounds.to ? w[6] : bounds.to };
    }
    return { from: bounds.from, to: bounds.to };
  }, [view, calMode, day, month, bounds.from, bounds.to]);

  const needsDated = view !== 'ideas';
  const needsIdeas = ['ideas', 'board', 'calendar'].includes(view);
  const postsQ = usePosts({ clientId: client?.id, ...range, ...filters }, { enabled: needsDated });
  const ideasQ = usePosts({ clientId: client?.id, undated: 'true', ...filters, status: undefined }, { enabled: needsIdeas });
  const dash = useClientDashboard(client?.id, { from: bounds.from, to: bounds.to });
  const { data: themes = [] } = useThemes(client?.id, bounds.year);
  const { data: people = [] } = useUserOptions(client?.id);
  const generate = useGenerateMonth();

  if (isLoading) return <FullPageSpinner />;
  if (error || !client) return <EmptyState icon={Eye} title="Client not found">You may not have access to this calendar.</EmptyState>;

  const theme = themes.find((t) => t.month === bounds.month);
  const posts = postsQ.data || NONE;
  const ideas = ideasQ.data || NONE;
  const d = dash.data;

  const openPost = (p) => update({ post: p.id });
  const newPost = (defaults = {}) => {
    const date = 'date' in defaults ? defaults.date : view === 'ideas' ? '' : day;
    update({ post: null });
    setDraft({ ...defaults, date, status: date ? 'IN_PROGRESS' : 'IDEA' });
  };
  const closeDrawer = () => {
    setDraft(null);
    update({ post: null });
  };

  const goMonth = (delta) => {
    const m = shiftMonth(month, delta);
    update({ month: m, day: monthKey(today) === m ? today : `${m}-01` });
  };

  const showActions = view === 'calendar' || view === 'sheet';
  const showMonth = view === 'calendar' || view === 'sheet' || view === 'board';

  const shared = { client, posts, ideas, month, day, isAdmin, canCreate: true, onOpen: openPost, onCreate: newPost, setDay: (dd) => update({ day: dd, month: monthKey(dd) }), loading: postsQ.isFetching };

  return (
    <div className="flex min-h-full flex-col">
      {/* header */}
      <div className="border-b border-slate-200 bg-white">
        <div className="h-1" style={{ background: client.brandColor }} />
        {/* three parts: client on the left, the month truly centred, actions on the right */}
        <div className="grid grid-cols-1 items-center gap-3 px-4 py-3 sm:grid-cols-[1fr_auto_1fr] sm:px-6">
          <div className="flex min-w-0 items-center gap-1">
            {isAdmin ? (
              <button className="group flex min-w-0 cursor-pointer items-center gap-1.5 rounded-md px-1 py-0.5 text-left hover:bg-slate-50" onClick={openClientSwitcher} title="Switch client (Ctrl K)">
                <span className="min-w-0">
                  <span className="block truncate text-2xl font-semibold tracking-tight text-brand-700">{client.name}</span>
                  <span className="block text-xs text-slate-500">{client.industry || 'Content calendar'}</span>
                </span>
                <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-500 group-hover:text-brand-600" />
              </button>
            ) : (
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-semibold tracking-tight text-brand-700">{client.name}</h1>
                <p className="text-xs text-slate-500">{client.industry || 'Content calendar'}</p>
              </div>
            )}
            {isAdmin && (
              <button
                className={`cursor-pointer rounded p-1.5 ${isPinned(client.id) ? 'text-brand-600' : 'text-slate-300 hover:text-slate-700'}`}
                title={isPinned(client.id) ? 'Unpin from sidebar' : 'Pin to sidebar'}
                onClick={() => togglePin(client.id)}
              >
                <Star className="h-4 w-4" fill={isPinned(client.id) ? 'currentColor' : 'none'} />
              </button>
            )}
          </div>

          {/* month picker: only where the page shows a month (the Daily view has its own week strip; ideas have no date) */}
          {showMonth ? (
            <div className="flex items-center justify-center gap-1">
              <button className="btn-ghost p-1.5" onClick={() => goMonth(-1)} aria-label="Previous month"><ChevronLeft className="h-5 w-5" /></button>
              <span className="min-w-[150px] text-center text-lg font-semibold text-slate-800">{monthLabel(month)}</span>
              <button className="btn-ghost p-1.5" onClick={() => goMonth(1)} aria-label="Next month"><ChevronRight className="h-5 w-5" /></button>
              <button
                className={`btn-ghost ml-1 p-1.5 ${month === monthKey(today) ? 'text-brand-600' : ''}`}
                onClick={() => update({ month: monthKey(today), day: today })}
                aria-label="Go to today"
                title="Go to today"
              >
                <CalendarCheck className="h-5 w-5" />
              </button>
            </div>
          ) : <div className="hidden sm:block" />}

          <div className="flex items-center gap-2 sm:justify-end">
            {showActions && isAdmin && (
              <button
                className="btn-secondary"
                disabled={generate.isPending}
                title="Create empty posts for each weekday pillar (e.g. every Monday → Motivational Monday)"
                onClick={() => {
                  if (confirm(`Create empty slots for every weekday pillar in ${monthLabel(month)}? Days that already have that pillar are skipped.`))
                    generate.mutate({ clientId: client.id, year: bounds.year, month: bounds.month });
                }}
              >
                <Wand2 className="h-4 w-4" /> <span className="hidden md:inline">Generate month</span>
              </button>
            )}
            {showActions && (
              <button className="btn-primary" onClick={() => newPost()}>
                <Plus className="h-4 w-4" /> {isAdmin ? 'New post' : 'Add post'}
              </button>
            )}
          </div>
        </div>

        {/* view tabs (clients pick the view from the sidebar on big screens, so tabs only show on small ones) */}
        <div className="scrollbar-none flex gap-1 overflow-x-auto px-4 sm:px-6 lg:hidden">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              onClick={() => update({ view: v.id === 'calendar' ? null : v.id })}
              className={`-mb-px flex cursor-pointer items-center gap-1.5 border-b-2 px-3 py-2 text-sm whitespace-nowrap ${
                view === v.id ? 'border-brand-600 font-medium text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <v.icon className="h-4 w-4" /> {v.label}
              {v.id === 'ideas' && d?.totals?.ideas ? <span className="rounded-full bg-slate-100 px-1.5 text-[10px] text-slate-600">{d.totals.ideas}</span> : null}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 space-y-4 p-4 sm:p-6">
        {/* the headline numbers live on the Dashboard; the calendar tabs stay focused on the content */}

        {/* clients: a short reminder here; the full list lives on Overview / Approvals */}
        {!isAdmin && d?.awaiting?.length > 0 && view === 'calendar' && (
          <section className="card overflow-hidden border-amber-300!">
            <header className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2.5">
              <Clock className="h-4 w-4 text-amber-600" />
              <h2 className="text-sm font-semibold text-amber-900">
                {d.awaiting.length} post{d.awaiting.length === 1 ? ' is' : 's are'} waiting for your approval
              </h2>
            </header>
            <ul className="divide-y divide-slate-100">
              {(showAllAwaiting ? d.awaiting : d.awaiting.slice(0, 5)).map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: p.pillar?.color || '#cbd5e1' }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-800">{p.title}</span>
                    <span className="block text-xs text-slate-500">{p.date ? formatDate(p.date, { withYear: true }) : 'No date yet'}</span>
                  </span>
                  <button className="btn-primary px-3 py-1 text-xs" onClick={() => update({ post: p.id, month: p.date ? monthKey(p.date) : null })}>
                    Review
                  </button>
                </li>
              ))}
            </ul>
            {d.awaiting.length > 5 && (
              <button className="w-full cursor-pointer border-t border-slate-100 px-4 py-2 text-center text-xs font-medium text-brand-600 hover:bg-slate-50" onClick={() => setShowAllAwaiting((v) => !v)}>
                {showAllAwaiting ? 'Show fewer' : `Show all ${d.awaiting.length}`}
              </button>
            )}
          </section>
        )}

        {theme && (
          <div className="card flex flex-wrap items-start gap-x-6 gap-y-1 border-l-4 px-4 py-3" style={{ borderLeftColor: client.brandColor }}>
            <div>
              <div className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Monthly theme</div>
              <div className="font-semibold text-slate-800">{theme.title}</div>
            </div>
            {theme.weeklyFocus?.length > 0 && (
              <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600">
                {theme.weeklyFocus.map((w) => (
                  <li key={w.week}><span className="font-semibold text-slate-700">W{w.week}:</span> {w.focus}</li>
                ))}
              </ul>
            )}
            {theme.notes && <p className="w-full text-xs text-slate-500">{theme.notes}</p>}
          </div>
        )}

        {/* filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              className="input w-56 pl-8"
              placeholder="Search title, caption…"
              defaultValue={filters.q || ''}
              onKeyDown={(e) => e.key === 'Enter' && update({ q: e.currentTarget.value.trim() })}
              onBlur={(e) => update({ q: e.currentTarget.value.trim() })}
            />
          </div>
          <button className={`btn-secondary ${filterCount ? 'border-brand-500 text-brand-700' : ''}`} onClick={() => setFiltersOpen((v) => !v)}>
            <SlidersHorizontal className="h-4 w-4" /> Filters
            {filterCount > 0 && <span className="rounded-full bg-brand-600 px-1.5 text-[11px] text-white">{filterCount}</span>}
          </button>
          {hasFilters && (
            <button className="btn-ghost text-xs" onClick={() => update(Object.fromEntries(FILTER_KEYS.map((k) => [k, null])))}>
              <X className="h-3.5 w-3.5" /> Clear
            </button>
          )}
          {view === 'calendar' && (
            <div className="ml-auto inline-flex rounded-md border border-slate-300 bg-white p-0.5 text-xs">
              {['month', 'week'].map((m) => (
                <button key={m} onClick={() => update({ cal: m === 'month' ? null : m })} className={`cursor-pointer rounded px-2.5 py-1 capitalize ${calMode === m ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>
        {(filtersOpen || filterCount > 0) && (
        <div className="card flex flex-wrap items-center gap-2 px-3 py-2.5">
          <select className="input w-auto" value={filters.status || ''} onChange={(e) => update({ status: e.target.value })}>
            <option value="">All statuses</option>
            {STATUSES.filter((s) => s.value !== 'IDEA').map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select className="input w-auto" value={filters.pillarId || ''} onChange={(e) => update({ pillarId: e.target.value })}>
            <option value="">All pillars</option>
            {client.pillars.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            <option value="none">Uncategorized</option>
          </select>
          <select className="input w-auto" value={filters.placement || ''} onChange={(e) => update({ placement: e.target.value })}>
            <option value="">All platforms</option>
            {PLACEMENTS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          {isAdmin && (
            <select className="input w-auto" value={filters.approverId || ''} onChange={(e) => update({ approverId: e.target.value })}>
              <option value="">Any approver</option>
              {people.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          )}
          <select className="input w-auto" value={filters.kind || ''} onChange={(e) => update({ kind: e.target.value })}>
            <option value="">Posts & ads</option>
            <option value="ORGANIC">Organic only</option>
            <option value="AD">Ads only</option>
          </select>
        </div>
        )}

        {view === 'calendar' && <CalendarView {...shared} mode={calMode} />}
        {view === 'sheet' && <SheetView {...shared} people={people} />}
        {view === 'daily' && <DailyView {...shared} />}
        {view === 'board' && <BoardView {...shared} />}
        {view === 'ideas' && <IdeasView {...shared} loading={ideasQ.isFetching} />}
      </div>

      {(openPostId || draft) && (
        <PostDrawer
          key={openPostId || 'new'}
          client={client}
          postId={openPostId}
          draft={draft}
          onClose={closeDrawer}
          onCreated={(p) => {
            setDraft(null);
            update({ post: p.id });
          }}
        />
      )}
    </div>
  );
}
