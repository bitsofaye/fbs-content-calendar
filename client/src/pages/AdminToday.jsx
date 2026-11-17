import { Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Clock3, Sun } from 'lucide-react';
import { useAllPosts, useClients } from '../api/hooks';
import { addDays, todayISO } from '../lib/dates';
import { ClientMark, EmptyState, FullPageSpinner, PageHeader, PillarTag, PlacementChips, StatusBadge } from '../components/ui';
import { HOME_SLUG } from '../lib/workspace';

const NONE = [];
const longDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
const timeLabel = (t) => {
  if (!t) return 'Any time';
  const [h, m] = t.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
};

// FBS team: "What's today" for the whole system — every client's posts for one day, FBS included.
export default function AdminToday() {
  const [sp, setSp] = useSearchParams();
  const today = todayISO();
  const day = /^\d{4}-\d{2}-\d{2}$/.test(sp.get('day') || '') ? sp.get('day') : today;
  const setDay = (d) => setSp(d === today ? {} : { day: d }, { replace: true });
  const { data: clients = NONE } = useClients();
  const { data: posts, isLoading } = useAllPosts({ from: day, to: day, limit: 1000 });

  if (isLoading && !posts) return <FullPageSpinner />;

  // group the day's posts by client: FBS first, then the busiest
  const dayPosts = (posts || NONE).filter((p) => p.status !== 'IDEA');
  const groups = Object.values(
    dayPosts.reduce((acc, p) => {
      const c = clients.find((x) => x.id === p.client.id) || p.client;
      acc[c.id] = acc[c.id] || { client: c, posts: [] };
      acc[c.id].posts.push(p);
      return acc;
    }, {}),
  ).sort(
    (a, b) =>
      Number(b.client.slug === HOME_SLUG) - Number(a.client.slug === HOME_SLUG) ||
      b.posts.length - a.posts.length ||
      a.client.name.localeCompare(b.client.name),
  );
  const quiet = clients.filter((c) => !groups.some((g) => g.client.id === c.id));
  const isToday = day === today;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-8">
      <PageHeader
        eyebrow={`All calendars · ${longDate(day)}`}
        title={isToday ? "What's today" : `What's on ${new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long' })}`}
        description={
          dayPosts.length
            ? `${dayPosts.length} post${dayPosts.length === 1 ? '' : 's'} across ${groups.length} calendar${groups.length === 1 ? '' : 's'}, FBS included.`
            : 'Nothing is scheduled on any calendar for this day.'
        }
        actions={
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
            <button className="btn-ghost h-8 w-8 p-0" onClick={() => setDay(addDays(day, -1))} aria-label="Previous day" title="Previous day">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              className={`cursor-pointer rounded-lg px-3 py-1 text-sm font-medium ${isToday ? 'bg-brand-700 text-white' : 'text-slate-600 hover:bg-brand-50'}`}
              onClick={() => setDay(today)}
            >
              <Sun className="mr-1 inline h-3.5 w-3.5 align-[-2px]" /> Today
            </button>
            <button className="btn-ghost h-8 w-8 p-0" onClick={() => setDay(addDays(day, 1))} aria-label="Next day" title="Next day">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        }
      />

      {groups.length ? (
        groups.map(({ client, posts: list }) => (
          <section key={client.id} className="card overflow-hidden">
            <header className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-3 sm:px-5">
              <ClientMark client={client} size="h-7 w-7" />
              <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-brand-700">
                {client.name}
                {client.slug === HOME_SLUG && <span className="ml-1.5 text-[10px] font-normal text-slate-500">ours</span>}
              </h2>
              <span className="rounded-full bg-slate-100 px-2 text-xs text-slate-600 tabular-nums">{list.length}</span>
              <Link to={`/c/${client.slug}?view=daily&day=${day}`} className="text-xs font-medium whitespace-nowrap text-brand-600 hover:underline">
                Open their day →
              </Link>
            </header>
            <ul className="divide-y divide-slate-100">
              {list.map((p) => (
                <li key={p.id}>
                  <Link to={`/c/${client.slug}?view=daily&day=${day}&post=${p.id}`} className="flex items-start gap-3 px-4 py-2.5 hover:bg-slate-50 sm:px-5">
                    <span className="mt-0.5 flex w-16 shrink-0 items-center gap-1 text-xs text-slate-500 tabular-nums">
                      <Clock3 className="h-3 w-3" /> {timeLabel(p.time)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium break-words text-slate-800">{p.title}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <PillarTag pillar={p.pillar} />
                        <PlacementChips placements={p.placements} size="xs" />
                        {p.kind === 'AD' && <span className="rounded bg-slate-100 px-1 text-[10px] font-semibold text-slate-600">AD</span>}
                      </span>
                    </span>
                    <StatusBadge status={p.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      ) : (
        <div className="card">
          <EmptyState icon={Sun} title={isToday ? 'Nothing goes out today' : 'Nothing scheduled this day'}>
            No calendar has a post on {longDate(day)}.
          </EmptyState>
        </div>
      )}

      {groups.length > 0 && quiet.length > 0 && (
        <p className="text-xs leading-relaxed text-slate-500">
          <span className="font-medium text-slate-600">Nothing scheduled: </span>
          {quiet.map((c, i) => (
            <span key={c.id}>
              {i > 0 && ', '}
              <Link to={`/c/${c.slug}?view=daily&day=${day}`} className="hover:text-brand-700 hover:underline">{c.name}</Link>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
