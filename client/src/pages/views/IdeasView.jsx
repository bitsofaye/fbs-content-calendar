import { useMemo, useState } from 'react';
import { Bell, BellOff, Hammer, Lightbulb, Search, Send } from 'lucide-react';
import { useBulkUpdate, useCreatePost } from '../../api/hooks';
import { STATUS } from '../../lib/constants';
import { EmptyState, Spinner } from '../../components/ui';

// How far an idea has come. Ideas are posts without a date: a new one is status IDEA,
// and it stays in the bank (with its progress shown) until someone gives it a date.
function ideaStage(p) {
  if (p.status === 'IDEA') return { id: 'new', label: 'New idea', cls: 'bg-sky-50 text-sky-700 ring-sky-200' };
  if (['IN_PROGRESS', 'CREATED', 'EDITED', 'TO_EDIT', 'REJECTED', 'ON_HOLD', 'RESCHEDULE'].includes(p.status))
    return { id: 'creating', label: 'In creation', cls: 'bg-violet-50 text-violet-700 ring-violet-200', detail: p.status !== 'IN_PROGRESS' ? STATUS[p.status]?.label : null };
  return { id: 'later', label: STATUS[p.status]?.label || p.status, cls: STATUS[p.status]?.cls || 'bg-slate-100 text-slate-600 ring-slate-200' };
}

function timeAgo(iso) {
  if (!iso) return '';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// "Write an idea" box at the top of the bank
function Composer({ client }) {
  const create = useCreatePost();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [pillarId, setPillarId] = useState('');
  const [attention, setAttention] = useState(true);
  const pillars = (client.pillars || []).filter((p) => p.active);

  async function submit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    await create.mutateAsync({
      clientId: client.id,
      title: title.trim(),
      storyboard: description.trim() || null,
      pillarId: pillarId || null,
      date: null,
      needsAttention: attention,
      placements: [],
    });
    setTitle('');
    setDescription('');
  }

  return (
    <form onSubmit={submit} className="card p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-50 text-amber-600">
          <Lightbulb className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-brand-700">Share a content idea</h2>
          <p className="text-xs text-slate-500">Anything you’d like to see posted. The team will pick it up from here.</p>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_220px]">
        <div>
          <label className="label" htmlFor="idea-title">Content idea *</label>
          <input id="idea-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. 5 signs your business needs a bookkeeper" maxLength={500} />
        </div>
        <div>
          <label className="label" htmlFor="idea-pillar">Pillar / service</label>
          <select id="idea-pillar" className="input" value={pillarId} onChange={(e) => setPillarId(e.target.value)}>
            <option value="">Not sure yet</option>
            {pillars.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="label" htmlFor="idea-desc">Description</label>
          <textarea
            id="idea-desc"
            className="input min-h-[84px]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What should the post say or show? Who is it for? Any example or reference link?"
          />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={attention} onChange={(e) => setAttention(e.target.checked)} className="h-4 w-4 accent-[#921259]" />
          <Bell className="h-4 w-4 text-brand-600" /> Notify the team — this needs attention
        </label>
        <button className="btn-primary ml-auto" disabled={!title.trim() || create.isPending}>
          <Send className="h-4 w-4" /> {create.isPending ? 'Adding…' : 'Add idea'}
        </button>
      </div>
    </form>
  );
}

function IdeaCard({ post, isAdmin, onOpen }) {
  const bulk = useBulkUpdate();
  const [expanded, setExpanded] = useState(false);
  const stage = ideaStage(post);
  const desc = post.storyboard || post.caption || '';
  const long = desc.length > 220;

  return (
    <article className={`card flex flex-col p-4 ${post.needsAttention ? 'border-amber-300!' : ''}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${stage.cls}`}>{stage.label}</span>
        {stage.detail && <span className="text-[11px] text-slate-500">{stage.detail}</span>}
        {post.needsAttention && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
            <Bell className="h-3 w-3" /> Needs attention
          </span>
        )}
      </div>
      <button className="mt-2.5 cursor-pointer text-left font-semibold break-words text-slate-800 hover:text-brand-700" onClick={() => onOpen(post)}>
        {post.title}
      </button>
      {desc ? (
        <div className="mt-1.5">
          <p className={`text-sm leading-6 break-words whitespace-pre-wrap text-slate-600 ${!expanded && long ? 'line-clamp-4' : ''}`}>{desc}</p>
          {long && (
            <button className="mt-1 cursor-pointer text-xs font-medium text-brand-600 hover:underline" onClick={() => setExpanded((v) => !v)}>
              {expanded ? 'Show less' : 'Read more'}
            </button>
          )}
        </div>
      ) : (
        <p className="mt-1.5 text-sm text-slate-400 italic">No description</p>
      )}

      <div className="mt-auto pt-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
          {post.pillar ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: post.pillar.color }} /> {post.pillar.name}
            </span>
          ) : (
            <span>No pillar yet</span>
          )}
          <span>
            {post.createdBy?.name ? `by ${post.createdBy.name}` : 'from the workbook'}
            {post.createdBy?.role === 'CLIENT' && <span className="ml-1 rounded bg-amber-50 px-1 text-[10px] font-medium text-amber-800">client</span>}
            {post.createdAt && ` · ${timeAgo(post.createdAt)}`}
          </span>
        </div>
        {isAdmin && (
          <div className="mt-3 flex flex-wrap gap-2">
            {stage.id === 'new' && (
              <button className="btn-primary px-3 py-1.5 text-xs" disabled={bulk.isPending} onClick={() => bulk.mutate([{ id: post.id, data: { status: 'IN_PROGRESS', needsAttention: false } }])}>
                <Hammer className="h-3.5 w-3.5" /> Start creating
              </button>
            )}
            {post.needsAttention && (
              <button className="btn-secondary px-3 py-1.5 text-xs" disabled={bulk.isPending} onClick={() => bulk.mutate([{ id: post.id, data: { needsAttention: false } }])}>
                <BellOff className="h-3.5 w-3.5" /> Mark as seen
              </button>
            )}
            <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => onOpen(post)}>
              Open
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

const FILTERS = [
  { id: 'all', label: 'All ideas' },
  { id: 'attention', label: 'Needs attention' },
  { id: 'new', label: 'New' },
  { id: 'creating', label: 'In creation' },
];

export default function IdeasView({ client, ideas, isAdmin, onOpen, loading }) {
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [pillar, setPillar] = useState('');

  const counts = useMemo(
    () => ({
      all: ideas.length,
      attention: ideas.filter((p) => p.needsAttention).length,
      new: ideas.filter((p) => ideaStage(p).id === 'new').length,
      creating: ideas.filter((p) => ideaStage(p).id === 'creating').length,
    }),
    [ideas],
  );

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return ideas
      .filter((p) => filter === 'all' || (filter === 'attention' ? p.needsAttention : ideaStage(p).id === filter))
      .filter((p) => !pillar || (pillar === 'none' ? !p.pillarId : p.pillarId === pillar))
      .filter((p) => !s || p.title.toLowerCase().includes(s) || (p.storyboard || '').toLowerCase().includes(s))
      .sort((a, b) => Number(b.needsAttention) - Number(a.needsAttention) || (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [ideas, filter, pillar, q]);

  return (
    <div className="space-y-5">
      <Composer client={client} />

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm ${filter === f.id ? 'bg-brand-700 font-medium text-white shadow-sm' : 'bg-brand-50 text-brand-700 hover:bg-brand-100'}`}
            >
              {f.id === 'attention' && <Bell className="h-3.5 w-3.5" />}
              {f.label}
              <span className={`rounded-full px-1.5 text-[11px] tabular-nums ${filter === f.id ? 'bg-white/20' : 'bg-slate-100 text-slate-600'}`}>{counts[f.id]}</span>
            </button>
          ))}
        </div>
        <div className="relative ml-auto">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input className="input w-56 pl-9" placeholder="Search ideas…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input w-auto" value={pillar} onChange={(e) => setPillar(e.target.value)} aria-label="Pillar">
          <option value="">All pillars</option>
          {(client.pillars || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          <option value="none">No pillar yet</option>
        </select>
        {loading && <Spinner className="h-4 w-4" />}
      </div>

      {shown.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((p) => <IdeaCard key={p.id} post={p} isAdmin={isAdmin} onOpen={onOpen} />)}
        </div>
      ) : (
        <div className="card">
          <EmptyState icon={Lightbulb} title={ideas.length ? 'No idea matches this filter' : 'The idea bank is empty'}>
            {ideas.length ? 'Try another filter or search.' : 'Write the first idea above.'}
          </EmptyState>
        </div>
      )}
      <p className="text-xs text-slate-500">To put an idea on the calendar, open it and give it a date — it then moves to the Calendar and Content plan.</p>
    </div>
  );
}
