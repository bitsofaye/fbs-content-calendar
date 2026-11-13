import { useMemo, useState } from 'react';
import { CalendarCheck2, Check, ChevronLeft, ChevronRight, Clock3, ExternalLink, MessageSquare, Plus, RotateCcw, Rows3, Send, Sun } from 'lucide-react';
import { useSubmitPost } from '../../api/hooks';
import { useAuth } from '../../context/AuthContext';
import { useStatusChange } from '../../components/StatusChange';
import { canReviewPost, statusBlock } from '../../lib/workflow';
import { PLACEMENT, STATUS } from '../../lib/constants';
import { addDays, formatDate, todayISO, weekday, weekOf } from '../../lib/dates';
import { PH_HOLIDAYS } from '../../lib/holidays';
import { EmptyState, PlatformList, StatusBadge } from '../../components/ui';

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

// 7 days of the selected week, each with how many posts it has
function WeekStrip({ day, setDay, counts }) {
  const week = weekOf(day);
  const today = todayISO();
  return (
    <div className="card flex items-center gap-1 p-2">
      <button className="btn-ghost h-9 w-9 p-0" onClick={() => setDay(addDays(day, -7))} aria-label="Previous week" title="Previous week">
        <ChevronLeft className="h-5 w-5" />
      </button>
      <div className="grid flex-1 grid-cols-7 gap-1">
        {week.map((d) => {
          const active = d === day;
          const n = counts[d] || 0;
          return (
            <button
              key={d}
              onClick={() => setDay(d)}
              className={`flex cursor-pointer flex-col items-center rounded-xl px-1 py-2 transition-colors ${
                active ? 'bg-brand-600 text-white' : d === today ? 'bg-brand-50 text-brand-700 hover:bg-brand-100' : 'text-slate-600 hover:bg-slate-100'
              }`}
              aria-label={`${formatDate(d)}, ${n} post${n === 1 ? '' : 's'}`}
            >
              <span className={`text-[11px] font-medium uppercase ${active ? 'text-white/80' : 'text-slate-500'}`}>{DAY_SHORT[weekday(d)]}</span>
              <span className="text-lg leading-tight font-semibold">{Number(d.slice(8))}</span>
              <span className={`mt-0.5 text-[11px] ${active ? 'text-white/85' : n ? 'text-brand-600' : 'text-slate-400'}`}>{n ? <>{n}<span className="hidden sm:inline"> post{n === 1 ? '' : 's'}</span></> : '—'}</span>
            </button>
          );
        })}
      </div>
      <button className="btn-ghost h-9 w-9 p-0" onClick={() => setDay(addDays(day, 7))} aria-label="Next week" title="Next week">
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}

// One post, shown roughly the way it will look when posted, plus what to do next
function PostPreview({ post, client, isAdmin, onOpen }) {
  const { user } = useAuth();
  const submit = useSubmitPost();
  const { change, dialog } = useStatusChange();
  const [expanded, setExpanded] = useState(false);
  const links = (post.pubmatLinks || []).filter((l) => /^https?:/.test(l));
  const canReview = canReviewPost(user, post);
  const canSubmit = isAdmin && ['IN_PROGRESS', 'CREATED', 'EDITED', 'TO_EDIT', 'REJECTED'].includes(post.status) && !statusBlock(user, post, 'FOR_APPROVAL');
  const caption = post.caption || '';
  const long = caption.length > 320 || caption.split('\n').length > 6;
  const platformNames = [...new Set((post.placements || []).map((p) => PLACEMENT[p]?.label.split(' ')[0]))].join(' · ');

  return (
    <article className="card overflow-hidden">
      {dialog}
      {/* what it is */}
      <header className="flex flex-wrap items-start gap-3 border-b border-slate-100 px-5 py-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            {post.pillar ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-slate-600">
                <span className="h-2 w-2 rounded-full" style={{ background: post.pillar.color }} /> {post.pillar.name}
              </span>
            ) : (
              <span>Uncategorized</span>
            )}
            {post.format && <span>· {post.format}</span>}
            {post.kind === 'AD' && <span className="rounded bg-fuchsia-50 px-1.5 font-medium text-fuchsia-700">Ad</span>}
          </div>
          <button className="mt-1 cursor-pointer text-left text-base font-semibold break-words text-slate-800 hover:text-brand-700" onClick={() => onOpen(post)}>
            {post.title}
          </button>
        </div>
        <StatusBadge status={post.status} />
      </header>

      <div className="grid gap-5 px-5 py-4 md:grid-cols-[1fr_200px]">
        {/* how it will read */}
        <div className="min-w-0 rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center gap-2.5 border-b border-slate-100 px-3.5 py-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white" style={{ background: client.brandColor }}>
              {initials(client.name)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-slate-800">{client.name}</span>
              <span className="block truncate text-[11px] text-slate-500">{platformNames || 'No platform yet'}</span>
            </span>
          </div>
          <div className="px-3.5 py-3">
            {caption ? (
              <>
                <p className={`text-sm leading-6 break-words whitespace-pre-wrap text-slate-700 ${!expanded && long ? 'line-clamp-6' : ''}`}>{caption}</p>
                {long && (
                  <button className="mt-1 cursor-pointer text-xs font-medium text-brand-600 hover:underline" onClick={() => setExpanded((v) => !v)}>
                    {expanded ? 'Show less' : 'Read the whole caption'}
                  </button>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-400 italic">No caption yet</p>
            )}
            {post.hashtags && <p className="mt-2 text-sm break-words text-sky-700">{post.hashtags}</p>}
          </div>
          {links.length > 0 && (
            <div className="flex flex-wrap gap-2 border-t border-slate-100 px-3.5 py-2.5">
              {links.map((l, i) => (
                <a key={l} href={l} target="_blank" rel="noreferrer" className="btn-secondary px-2.5 py-1 text-xs">
                  <ExternalLink className="h-3.5 w-3.5" /> Pubmat{links.length > 1 ? ` ${i + 1}` : ''}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* the facts */}
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="eyebrow mb-1">Platforms</dt>
            <dd><PlatformList placements={post.placements} /></dd>
          </div>
          <div>
            <dt className="eyebrow mb-1">Approver</dt>
            <dd className="text-slate-700">{post.approver?.name || post.approverName || '—'}</dd>
          </div>
          <div>
            <dt className="eyebrow mb-1">Comments</dt>
            <dd>
              <button className="inline-flex cursor-pointer items-center gap-1.5 text-slate-700 hover:text-brand-700" onClick={() => onOpen(post)}>
                <MessageSquare className="h-4 w-4" /> {post._count?.commentList || 0}
              </button>
            </dd>
          </div>
        </dl>
      </div>

      {/* what to do next */}
      {(canReview || canSubmit) && (
        <footer className="border-t border-slate-100 bg-brand-50/60 px-5 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-auto text-xs text-slate-600">{canReview ? 'Waiting for approval' : 'Ready to send for approval?'}</span>
              {canReview && (
                <>
                  <button className="btn-success px-3 py-1.5 text-xs" onClick={() => change(post, 'APPROVED')}>
                    <Check className="h-3.5 w-3.5" /> Approve
                  </button>
                  <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => change(post, 'TO_EDIT')}>
                    <RotateCcw className="h-3.5 w-3.5" /> Request changes
                  </button>
                </>
              )}
              {canSubmit && (
                <button className="btn-secondary px-3 py-1.5 text-xs" disabled={submit.isPending} onClick={() => submit.mutate({ id: post.id })}>
                  <Send className="h-3.5 w-3.5" /> Send for approval
                </button>
              )}
            </div>
        </footer>
      )}
    </article>
  );
}

// Side panel: everything about the day in one look
function DayAtAGlance({ day, dayPosts, client, canCreate, onCreate }) {
  const wd = weekday(day);
  const slot = (client.pillars || []).find((p) => p.active && p.weekday === wd);
  const slotFilled = slot && dayPosts.some((p) => p.pillarId === slot.id);
  const holiday = PH_HOLIDAYS[day];
  const byStatus = {};
  for (const p of dayPosts) byStatus[p.status] = (byStatus[p.status] || 0) + 1;
  return (
    <aside className="space-y-4">
      <div className="card p-5">
        <div className="eyebrow">{DAY_LONG[wd]}</div>
        <div className="mt-1 text-2xl font-semibold tracking-tight text-brand-700">{formatDate(day, { withDay: false, withYear: true })}</div>
        {day === todayISO() && <div className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand-600"><Sun className="h-3.5 w-3.5" /> Today</div>}
        {holiday && <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{holiday}</div>}
        {canCreate && (
          <button className="btn-primary mt-4 w-full" onClick={() => onCreate({ date: day, pillarId: slot?.id })}>
            <Plus className="h-4 w-4" /> Add post for this day
          </button>
        )}
      </div>

      {slot && (
        <div className="card p-5">
          <div className="eyebrow mb-2">Today’s pillar</div>
          <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: slot.color }} /> {slot.name}
          </div>
          <div className={`mt-2 inline-flex items-center gap-1.5 text-xs ${slotFilled ? 'text-emerald-700' : 'text-amber-700'}`}>
            {slotFilled ? <CalendarCheck2 className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
            {slotFilled ? 'Planned' : 'Not planned yet'}
          </div>
        </div>
      )}

      <div className="card p-5">
        <div className="eyebrow mb-2">This day</div>
        {dayPosts.length ? (
          <ul className="space-y-2">
            {Object.entries(byStatus).map(([s, n]) => (
              <li key={s} className="flex items-center gap-2 text-sm">
                <span className="h-2 w-2 rounded-full" style={{ background: STATUS[s]?.dot }} />
                <span className="flex-1 text-slate-700">{STATUS[s]?.label || s}</span>
                <span className="font-semibold text-slate-800 tabular-nums">{n}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">No posts yet.</p>
        )}
      </div>
    </aside>
  );
}

export default function DailyView({ client, posts, day, setDay, isAdmin, canCreate, onOpen, onCreate }) {
  const counts = useMemo(() => {
    const m = {};
    for (const p of posts) m[p.date] = (m[p.date] || 0) + 1;
    return m;
  }, [posts]);
  // the day's posts in posting order; posts without a time come last
  const dayPosts = useMemo(
    () => posts.filter((p) => p.date === day).sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99') || a.title.localeCompare(b.title)),
    [posts, day],
  );

  return (
    <div className="space-y-5">
      <WeekStrip day={day} setDay={setDay} counts={counts} />

      <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
        <div className="min-w-0">
          {dayPosts.length ? (
            <ol className="relative space-y-5">
              {dayPosts.map((p) => (
                <li key={p.id} className="grid gap-2 sm:grid-cols-[76px_1fr] sm:gap-3">
                  {/* time rail */}
                  <div className="sm:pt-4 sm:text-right">
                    <div className="text-sm font-semibold text-slate-800 tabular-nums">{p.time || 'Any time'}</div>
                  </div>
                  <PostPreview post={p} client={client} isAdmin={isAdmin} onOpen={onOpen} />
                </li>
              ))}
            </ol>
          ) : (
            <div className="card">
              <EmptyState icon={Rows3} title={`Nothing planned for ${formatDate(day)}`}>Pick another day above{canCreate ? ', or add a post for this day.' : '.'}</EmptyState>
            </div>
          )}
        </div>
        <DayAtAGlance day={day} dayPosts={dayPosts} client={client} canCreate={canCreate} onCreate={onCreate} />
      </div>
    </div>
  );
}
