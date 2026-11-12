import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, CalendarClock, CalendarRange, CheckCircle2, Clock, Inbox, ListChecks, Lightbulb, Plus, Sparkles } from 'lucide-react';
import { useClientDashboard, usePosts, useThemes } from '../../api/hooks';
import { formatDate, monthBounds, monthKey, monthLabel, todayISO } from '../../lib/dates';
import { EmptyState, fmtNumber, FullPageSpinner, KpiTile, PageHeader } from '../../components/ui';
import PillarMix from '../../components/PillarMix';
import ClientPostRow from '../../components/ClientPostRow';
import PostDrawer from '../../components/PostDrawer';
import { useMyClient } from './useMyClient';

const NONE = [];

function Panel({ title, icon: Icon, tone = 'text-slate-500', count, children, link }) {
  return (
    <section className="card overflow-hidden">
      <header className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5">
        <Icon className={`h-4 w-4 ${tone}`} />
        <h2 className="text-sm font-semibold text-brand-700">{title}</h2>
        {count !== undefined && <span className="rounded-full bg-slate-100 px-2 text-xs text-slate-600 tabular-nums">{count}</span>}
        {link && (
          <Link to={link.to} className="ml-auto text-xs font-medium text-brand-600 hover:underline">
            {link.label}
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}

// The client's home page: what needs them, what's coming, and how the month looks.
export default function ClientOverview() {
  const { user, client, isLoading, openId, open, close } = useMyClient();
  const [draft, setDraft] = useState(null);
  const today = todayISO();
  const month = monthKey(today);
  const bounds = monthBounds(month);
  const dash = useClientDashboard(client?.id, { from: bounds.from, to: bounds.to });
  const { data: themes = NONE } = useThemes(client?.id, bounds.year);
  // published most recently (any month), newest first
  const published = usePosts({ clientId: client?.id, status: 'PUBLISHED,BOOSTED', undated: 'false', limit: 200 });
  const revising = usePosts({ clientId: client?.id, status: 'TO_EDIT,REJECTED', limit: 100 });

  if (isLoading || !client || !dash.data) return <FullPageSpinner />;
  const d = dash.data;
  const theme = themes.find((t) => t.month === bounds.month);
  const recent = [...(published.data || NONE)].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 5);
  const beingRevised = revising.data || NONE;
  const awaiting = d.awaiting || NONE;
  const next7 = d.next7 || NONE;

  return (
    <div className="mx-auto max-w-6xl space-y-7 p-4 sm:p-8">
      <PageHeader
        eyebrow={`Dashboard · ${monthLabel(month)}`}
        title={`Good day, ${user.name.split(' ')[0]}`}
        description={`Your ${client.name} content calendar with FBS.`}
        actions={
          <button className="btn-primary" onClick={() => setDraft({ date: today, status: 'IN_PROGRESS' })}>
            <Plus className="h-4 w-4" /> Add post
          </button>
        }
      />

      {/* the numbers */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiTile solid to={`/c/${client.slug}`} label="Posts this month" value={d.totals.total} icon={CalendarRange} hint={d.totals.ads ? `${d.totals.ads} ads` : 'organic & ads'} />
        <KpiTile to="/approvals?tab=published" label="Published" value={d.totals.published} icon={CheckCircle2} tone="green" hint={d.totals.total ? `${Math.round((d.totals.published / d.totals.total) * 100)}% of the month` : undefined} />
        <KpiTile to="/approvals" label="Waiting for your approval" value={awaiting.length} icon={Clock} tone="amber" hint="all dates" />
        <KpiTile to="/approvals?tab=revising" label="Being revised by FBS" value={beingRevised.length} icon={ListChecks} tone="orange" hint="after your feedback" />
      </div>

      {/* what needs the client */}
      <Panel title="Waiting for your approval" icon={Clock} tone="text-amber-600" count={awaiting.length} link={awaiting.length > 5 ? { to: '/approvals', label: `See all ${awaiting.length}` } : undefined}>
        {awaiting.length ? (
          <ul className="divide-y divide-slate-100">
            {awaiting.slice(0, 5).map((p) => <ClientPostRow key={p.id} post={p} onOpen={open} action="Review" primary />)}
          </ul>
        ) : (
          <EmptyState icon={CheckCircle2} title="You're all caught up">Nothing is waiting for your approval right now.</EmptyState>
        )}
      </Panel>

      {theme && (
        <div className="card flex flex-wrap items-start gap-x-6 gap-y-1 border-l-4 px-4 py-3" style={{ borderLeftColor: client.brandColor }}>
          <div>
            <div className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">This month's theme</div>
            <div className="font-semibold text-slate-800">{theme.title}</div>
          </div>
          {theme.weeklyFocus?.length > 0 && (
            <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600">
              {theme.weeklyFocus.map((w) => (
                <li key={w.week}><span className="font-semibold text-slate-700">W{w.week}:</span> {w.focus}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Next 7 days" icon={CalendarClock} tone="text-brand-600" count={next7.length} link={{ to: `/c/${client.slug}?view=daily&day=${today}`, label: 'Day by day' }}>
          {next7.length ? (
            <ul className="divide-y divide-slate-100">{next7.slice(0, 6).map((p) => <ClientPostRow key={p.id} post={p} onOpen={open} />)}</ul>
          ) : (
            <EmptyState icon={Inbox} title="Nothing scheduled in the next 7 days" />
          )}
        </Panel>

        <Panel title="Recently published" icon={CheckCircle2} tone="text-green-600" link={{ to: `/c/${client.slug}/results`, label: 'See results' }}>
          {recent.length ? (
            <ul className="divide-y divide-slate-100">
              {recent.map((p) => <ClientPostRow key={p.id} post={p} onOpen={open} note={p.reach ? `${fmtNumber(p.reach)} reach` : undefined} />)}
            </ul>
          ) : (
            <EmptyState icon={Inbox} title="Nothing published yet" />
          )}
        </Panel>
      </div>

      {(d.metrics.reach || d.metrics.engagement) && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiTile label="Reach" value={fmtNumber(d.metrics.reach)} icon={Sparkles} tone="brand" hint="this month" />
          <KpiTile label="Engagement" value={fmtNumber(d.metrics.engagement)} icon={BarChart3} tone="brand" hint="this month" />
        </div>
      )}
      <PillarMix mix={d.pillarMix} total={d.totals.total} />

      {d.totals.ideas > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-slate-500">
          <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
          {d.totals.ideas} idea{d.totals.ideas === 1 ? '' : 's'} are waiting in the{' '}
          <Link to={`/c/${client.slug}?view=ideas`} className="font-medium text-brand-600 hover:underline">Idea bank</Link>.
        </p>
      )}

      {(openId || draft) && (
        <PostDrawer
          key={openId || 'new'}
          client={client}
          postId={openId}
          draft={draft}
          onClose={() => {
            setDraft(null);
            close();
          }}
          onCreated={(p) => {
            setDraft(null);
            open(p);
          }}
        />
      )}
    </div>
  );
}
