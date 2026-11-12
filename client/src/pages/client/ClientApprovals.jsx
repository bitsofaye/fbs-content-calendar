import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, Clock, Inbox, ListChecks, Send } from 'lucide-react';
import { usePosts } from '../../api/hooks';
import { EmptyState, FullPageSpinner } from '../../components/ui';
import ClientPostRow from '../../components/ClientPostRow';
import PostDrawer from '../../components/PostDrawer';
import { useMyClient } from './useMyClient';

const TABS = [
  { id: 'waiting', label: 'Waiting for you', icon: Clock, status: 'FOR_APPROVAL', action: 'Review', primary: true, empty: 'Nothing is waiting for your approval', sort: 'asc' },
  { id: 'revising', label: 'Being revised', icon: ListChecks, status: 'TO_EDIT,REJECTED', action: 'Open', empty: 'No posts are being revised', sort: 'asc', note: 'FBS is working on your feedback' },
  { id: 'approved', label: 'Approved & scheduled', icon: Send, status: 'APPROVED,SCHEDULED', action: 'Open', empty: 'No approved posts waiting to go live', sort: 'asc' },
  { id: 'published', label: 'Published', icon: CheckCircle2, status: 'PUBLISHED,BOOSTED', action: 'Open', empty: 'Nothing published yet', sort: 'desc' },
];

// Everything the client has to decide on, plus what happened to their earlier decisions.
export default function ClientApprovals() {
  const { client, isLoading, openId, open, close } = useMyClient();
  const [sp, setSp] = useSearchParams();
  const tab = TABS.find((t) => t.id === sp.get('tab')) || TABS[0];
  const lists = TABS.map((t) => usePosts({ clientId: client?.id, status: t.status, limit: 300 }));
  if (isLoading || !client) return <FullPageSpinner />;

  const posts = [...(lists[TABS.indexOf(tab)].data || [])].sort((a, b) =>
    tab.sort === 'desc' ? (b.date || '').localeCompare(a.date || '') : (a.date || '9999').localeCompare(b.date || '9999'),
  );

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
      <div>
        <h1 className="page-title">Approvals</h1>
        <p className="text-sm text-slate-500">Review posts before they go live. Open a post to approve it, ask for changes, or leave a comment.</p>
      </div>

      <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-white p-1">
        {TABS.map((t, i) => {
          const n = lists[i].data?.length;
          return (
            <button
              key={t.id}
              onClick={() => setSp(t.id === 'waiting' ? {} : { tab: t.id }, { replace: true })}
              className={`flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-sm ${tab.id === t.id ? 'bg-brand-600 font-medium text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <t.icon className="h-4 w-4" /> {t.label}
              {n !== undefined && <span className={`rounded-full px-1.5 text-[11px] tabular-nums ${tab.id === t.id ? 'bg-white/20' : 'bg-slate-100 text-slate-600'}`}>{n}</span>}
            </button>
          );
        })}
      </div>

      <section className="card overflow-hidden">
        {posts.length ? (
          <ul className="divide-y divide-slate-100">
            {posts.map((p) => <ClientPostRow key={p.id} post={p} onOpen={open} action={tab.action} primary={tab.primary} note={tab.note} />)}
          </ul>
        ) : (
          <EmptyState icon={tab.id === 'waiting' ? CheckCircle2 : Inbox} title={tab.empty}>
            {tab.id === 'waiting' && 'You’re all caught up.'}
          </EmptyState>
        )}
      </section>

      {tab.id === 'waiting' && posts.length > 0 && (
        <p className="text-xs text-slate-500">Tip: inside a post, use <b>Approve</b>, <b>Request changes</b> (tell FBS what to fix) or <b>Reject</b>. Your comment is sent to the team.</p>
      )}

      {openId && <PostDrawer key={openId} client={client} postId={openId} onClose={close} />}
    </div>
  );
}
