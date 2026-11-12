import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, ExternalLink, MessageSquare, RotateCcw, Send, Trash2, X, XCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  useAddComment, useCreatePost, useDeletePost, useDuplicatePost, usePost, useReviewPost, useSubmitPost, useUpdatePost, useUserOptions,
} from '../api/hooks';
import { BOOSTS, FEEDBACK, FORMATS, PLACEMENTS, STATUSES, STATUS } from '../lib/constants';
import { formatDate, formatDateTime } from '../lib/dates';
import { PillarTag, PlacementChips, Spinner, StatusBadge } from './ui';

const EMPTY = {
  title: '', date: '', time: '', status: 'IN_PROGRESS', kind: 'ORGANIC', pillarId: '', placements: ['FB_POST', 'IG_POST', 'LINKEDIN_POST'],
  format: '', storyboard: '', graphicsIdea: '', titleDraft: '', caption: '', hashtags: '', pubmatLinks: '', referenceLink: '', remarks: '',
  boost: 'ORGANIC', approverId: '', assigneeId: '', reacts: '', comments: '', shares: '', reach: '', engagement: '', linkClicks: '', feedback: '',
  ad: { primaryText: '', headline: '', description: '', cta: '', adSets: [], botcakeMessage: '' },
};

function toForm(post) {
  const f = { ...EMPTY };
  for (const k of Object.keys(EMPTY)) if (post[k] !== undefined && post[k] !== null && k !== 'ad') f[k] = post[k];
  f.pubmatLinks = (post.pubmatLinks || []).join('\n');
  f.ad = { ...EMPTY.ad, ...(post.adDetails || {}), adSets: post.adDetails?.adSets || [] };
  for (const k of ['reacts', 'comments', 'shares', 'reach', 'engagement', 'linkClicks']) f[k] = post[k] ?? '';
  return f;
}

function toPayload(f) {
  const nul = (v) => (v === '' || v === undefined ? null : v);
  const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
  return {
    title: f.title.trim(),
    date: nul(f.date),
    time: f.time || null,
    status: f.status,
    kind: f.kind,
    pillarId: nul(f.pillarId),
    placements: f.placements,
    format: nul(f.format),
    storyboard: nul(f.storyboard),
    graphicsIdea: nul(f.graphicsIdea),
    titleDraft: nul(f.titleDraft),
    caption: nul(f.caption),
    hashtags: nul(f.hashtags),
    pubmatLinks: f.pubmatLinks.split('\n').map((s) => s.trim()).filter(Boolean),
    referenceLink: nul(f.referenceLink),
    remarks: nul(f.remarks),
    boost: f.boost,
    approverId: nul(f.approverId),
    assigneeId: nul(f.assigneeId),
    reacts: num(f.reacts),
    comments: num(f.comments),
    shares: num(f.shares),
    reach: num(f.reach),
    engagement: num(f.engagement),
    linkClicks: num(f.linkClicks),
    feedback: nul(f.feedback),
    adDetails:
      f.kind === 'AD'
        ? { ...f.ad, primaryText: nul(f.ad.primaryText), headline: nul(f.ad.headline), description: nul(f.ad.description), cta: nul(f.ad.cta), botcakeMessage: nul(f.ad.botcakeMessage), adSets: f.ad.adSets.filter((a) => a.targeting?.trim()) }
        : null,
  };
}

const Field = ({ label, children, className = '' }) => (
  <div className={className}>
    <label className="label">{label}</label>
    {children}
  </div>
);

function ReadValue({ value, pre = false }) {
  if (value === null || value === undefined || value === '' || (Array.isArray(value) && !value.length)) return <p className="text-sm text-slate-500">—</p>;
  return <p className={`text-sm text-slate-700 ${pre ? 'whitespace-pre-wrap' : ''}`}>{value}</p>;
}

function Links({ links }) {
  if (!links?.length) return <p className="text-sm text-slate-500">—</p>;
  return (
    <ul className="space-y-1">
      {links.map((l) => (
        <li key={l} className="truncate text-sm">
          {/^https?:\/\//.test(l) ? (
            <a href={l} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-600 hover:underline">
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{l.replace(/^https?:\/\/(www\.)?/, '').slice(0, 60)}</span>
            </a>
          ) : (
            <span className="text-slate-700">{l}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function Discussion({ post }) {
  const [body, setBody] = useState('');
  const add = useAddComment();
  const send = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    await add.mutateAsync({ id: post.id, body });
    setBody('');
  };
  const ACTION_LABEL = {
    CREATED: 'created the post', UPDATED: 'edited', STATUS_CHANGED: 'changed status', RESCHEDULED: 'rescheduled', SUBMITTED: 'sent for approval',
    APPROVED: 'approved', CHANGES_REQUESTED: 'requested changes', REJECTED: 'rejected', IMPORTED: 'imported',
  };
  return (
    <div className="space-y-5">
      <div>
        <h3 className="mb-2 text-sm font-medium text-slate-700">Comments</h3>
        <div className="space-y-2">
          {post.commentList?.length ? (
            post.commentList.map((c) => (
              <div key={c.id} className={`rounded-lg px-3 py-2 text-sm ${c.user.role === 'CLIENT' ? 'bg-amber-50' : 'bg-slate-100'}`}>
                <div className="mb-0.5 flex justify-between text-xs text-slate-500">
                  <span className="font-medium text-slate-700">
                    {c.user.name} {c.user.role === 'CLIENT' && <span className="font-normal text-amber-700">· client</span>}
                  </span>
                  <span>{formatDateTime(c.createdAt)}</span>
                </div>
                <p className="whitespace-pre-wrap text-slate-700">{c.body}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">No comments yet.</p>
          )}
        </div>
        <form onSubmit={send} className="mt-3 flex gap-2">
          <textarea className="input min-h-[38px] flex-1" rows={2} placeholder="Write a comment…" value={body} onChange={(e) => setBody(e.target.value)} />
          <button className="btn-primary self-end" disabled={add.isPending || !body.trim()}>
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-medium text-slate-700">History</h3>
        <ul className="space-y-1.5 border-l border-slate-200 pl-3">
          {post.activities?.map((a) => (
            <li key={a.id} className="text-xs text-slate-500">
              <span className="font-medium text-slate-700">{a.user?.name ?? 'System'}</span> {ACTION_LABEL[a.action] ?? a.action.toLowerCase()}
              {a.meta?.to && a.action !== 'RESCHEDULED' && <> → {STATUS[a.meta.to]?.label ?? a.meta.to}</>}
              {a.action === 'RESCHEDULED' && <> {a.meta?.from ?? 'idea'} → {a.meta?.to ?? 'idea bank'}</>}
              {a.action === 'UPDATED' && a.meta?.fields && <> ({a.meta.fields.join(', ')})</>}
              <span className="ml-1 text-slate-500">· {formatDateTime(a.createdAt)}</span>
            </li>
          ))}
          {!post.activities?.length && <li className="text-xs text-slate-500">No history (imported from the workbook).</li>}
        </ul>
      </div>
    </div>
  );
}

function ReviewBar({ post }) {
  const review = useReviewPost();
  const [mode, setMode] = useState(null); // REQUEST_CHANGES | REJECT
  const [comment, setComment] = useState('');
  const go = async (action) => {
    await review.mutateAsync({ id: post.id, action, comment: comment.trim() || undefined });
    setMode(null);
    setComment('');
  };
  return (
    <div className="border-b border-amber-200 bg-amber-50 px-5 py-3">
      {mode ? (
        <div className="space-y-2">
          <textarea autoFocus className="input" rows={3} placeholder={mode === 'REJECT' ? 'Why is this rejected?' : 'What should be changed?'} value={comment} onChange={(e) => setComment(e.target.value)} />
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setMode(null)}>Cancel</button>
            <button className={mode === 'REJECT' ? 'btn-danger' : 'btn-primary'} disabled={!comment.trim() || review.isPending} onClick={() => go(mode)}>
              {mode === 'REJECT' ? 'Reject post' : 'Send change request'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-auto text-sm font-medium text-amber-900">
            {post.status === 'FOR_APPROVAL' ? 'This post is waiting for your approval' : 'Review this post'}
          </span>
          <button className="btn-success" disabled={review.isPending} onClick={() => go('APPROVE')}>
            <Check className="h-4 w-4" /> Approve
          </button>
          <button className="btn-secondary" onClick={() => setMode('REQUEST_CHANGES')}>
            <RotateCcw className="h-4 w-4" /> Request changes
          </button>
          <button className="btn-ghost text-red-600" onClick={() => setMode('REJECT')}>
            <XCircle className="h-4 w-4" /> Reject
          </button>
        </div>
      )}
    </div>
  );
}

export default function PostDrawer({ client, postId, draft, onClose, onCreated }) {
  const { user, isAdmin } = useAuth();
  const isNew = !postId;
  const { data: post, isLoading } = usePost(postId);
  const { data: people = [] } = useUserOptions(client.id);
  const [form, setForm] = useState(() => ({ ...EMPTY, ...(draft || {}) }));
  // what the form looked like when it was opened / last saved — used to warn about unsaved edits
  const [snapshot, setSnapshot] = useState(() => JSON.stringify({ ...EMPTY, ...(draft || {}) }));
  // clients mostly care about the content (caption + pubmat), so they land on that tab
  const [tab, setTab] = useState(isAdmin || !postId ? 'details' : 'content');
  const create = useCreatePost();
  const update = useUpdatePost();
  const del = useDeletePost();
  const dup = useDuplicatePost();
  const submit = useSubmitPost();

  useEffect(() => {
    if (post) {
      const f = toForm(post);
      setForm(f);
      setSnapshot(JSON.stringify(f));
    }
  }, [post]);

  // FBS edits anything; a client can add posts and edit the ones they added while still Idea / In progress
  const canEdit = isAdmin || isNew || (post ? post.createdById === user.id && ['IDEA', 'IN_PROGRESS'].includes(post.status) : false);
  const dirty = canEdit && JSON.stringify(form) !== snapshot;
  const requestClose = () => {
    if (dirty && !confirm('You have unsaved changes. Close without saving?')) return;
    onClose();
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));
  const setAd = (k) => (e) => setForm((f) => ({ ...f, ad: { ...f.ad, [k]: e.target.value } }));
  const togglePlacement = (p) =>
    setForm((f) => ({ ...f, placements: f.placements.includes(p) ? f.placements.filter((x) => x !== p) : [...f.placements, p] }));

  const pillars = useMemo(() => (client.pillars || []).filter((p) => p.active || p.id === form.pillarId), [client.pillars, form.pillarId]);
  const pillar = (client.pillars || []).find((p) => p.id === form.pillarId);
  const readOnly = !canEdit;
  // approve / request changes only makes sense while a post is waiting for approval
  const canReview = post && post.status === 'FOR_APPROVAL';
  const hasApprover = Boolean(form.approverId || post?.approverName);

  async function save() {
    const payload = toPayload(form);
    if (!payload.title) return setTab('details');
    if (isNew) {
      const created = await create.mutateAsync({ ...payload, clientId: client.id });
      setSnapshot(JSON.stringify(form));
      onCreated?.(created);
    } else {
      await update.mutateAsync({ id: post.id, ...payload });
      setSnapshot(JSON.stringify(form));
    }
  }

  // Esc closes (with the unsaved-changes check); Ctrl/⌘ + S saves
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') requestClose();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && canEdit) {
        e.preventDefault();
        if (form.title.trim()) save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const tabs = [
    ['details', 'Details'],
    ['content', 'Content'],
    ...(form.kind === 'AD' ? [['ad', 'Ad setup']] : []),
    ...(!isNew ? [['metrics', 'Results']] : []),
    ...(!isNew ? [['discussion', `Discussion${post?.commentList?.length ? ` (${post.commentList.length})` : ''}`]] : []),
  ];

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/30" onClick={requestClose} />
      <aside className="relative flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
        <header className="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="h-2 w-2 rounded-full" style={{ background: client.brandColor }} />
              {client.name}
              {form.kind === 'AD' && <span className="rounded bg-fuchsia-100 px-1.5 font-medium text-fuchsia-700">AD</span>}
              {post?.importSource && <span title={post.importSource}>· from workbook</span>}
            </div>
            <h2 className="truncate text-lg font-semibold text-brand-700">{isNew ? 'New post' : form.title || 'Untitled'}</h2>
            {isNew && !isAdmin && <p className="mt-1 text-xs text-slate-500">Tell FBS what you’d like posted and when. The team will pick it up from here.</p>}
            {!isNew && !isAdmin && canEdit && <p className="mt-1 text-xs text-slate-500">You added this post. You can still change it until FBS picks it up.</p>}
            {!isNew && (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <StatusBadge status={form.status} />
                <span className="text-xs text-slate-500">{form.date ? formatDate(form.date, { withYear: true }) : 'Idea bank (no date)'}</span>
                <PillarTag pillar={pillar} />
              </div>
            )}
          </div>
          <button className="btn-ghost p-1.5" onClick={requestClose} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </header>

        {canReview && <ReviewBar post={post} />}

        <nav className="flex gap-1 border-b border-slate-200 px-4">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`-mb-px cursor-pointer border-b-2 px-3 py-2 text-sm ${tab === id ? 'border-brand-600 font-medium text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!isNew && isLoading ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : (
            <>
              {tab === 'details' && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Topic / title *" className="col-span-2">
                    {readOnly ? <ReadValue value={form.title} /> : <input className="input" value={form.title} onChange={set('title')} placeholder="e.g. Free Business Compliance Checklist" autoFocus={isNew} />}
                  </Field>
                  <Field label="Date (empty = Idea bank)">
                    {readOnly ? <ReadValue value={form.date ? formatDate(form.date, { withYear: true }) : ''} /> : <input type="date" className="input" value={form.date || ''} onChange={set('date')} />}
                  </Field>
                  <Field label="Time">
                    {readOnly ? <ReadValue value={form.time} /> : <input type="time" className="input" value={form.time || ''} onChange={set('time')} />}
                  </Field>
                  <Field label="Pillar / service">
                    {readOnly ? (
                      <PillarTag pillar={pillar} />
                    ) : (
                      <select className="input" value={form.pillarId || ''} onChange={set('pillarId')}>
                        <option value="">Uncategorized</option>
                        {pillars.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    )}
                  </Field>
                  <Field label="Status">
                    {readOnly || !isAdmin ? (
                      <StatusBadge status={form.status} />
                    ) : (
                      <select className="input" value={form.status} onChange={set('status')}>
                        {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    )}
                  </Field>
                  <Field label="Platforms" className="col-span-2">
                    {readOnly ? (
                      <PlacementChips placements={form.placements} />
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {PLACEMENTS.map((p) => {
                          const on = form.placements.includes(p.value);
                          return (
                            <button
                              type="button"
                              key={p.value}
                              onClick={() => togglePlacement(p.value)}
                              className={`cursor-pointer rounded-full border px-2.5 py-1 text-xs ${on ? 'border-transparent text-white' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'}`}
                              style={on ? { background: p.color } : undefined}
                            >
                              {p.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </Field>
                  {isAdmin && (
                  <>
                  <Field label="Approver">
                    {readOnly ? (
                      <ReadValue value={post?.approver?.name || post?.approverName} />
                    ) : (
                      <>
                        <select className="input" value={form.approverId || ''} onChange={set('approverId')}>
                          <option value="">{post?.approverName ? `${post.approverName} (from sheet)` : '— none —'}</option>
                          {people.map((u) => <option key={u.id} value={u.id}>{u.name}{u.role === 'CLIENT' ? ' (client)' : ''}</option>)}
                        </select>
                      </>
                    )}
                  </Field>
                  <Field label="Assigned to">
                    {readOnly ? (
                      <ReadValue value={post?.assignee?.name} />
                    ) : (
                      <select className="input" value={form.assigneeId || ''} onChange={set('assigneeId')}>
                        <option value="">— none —</option>
                        {people.filter((u) => u.role === 'ADMIN').map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                    )}
                  </Field>
                  </>
                  )}
                  <Field label="Format / pubmat type">
                    {readOnly ? (
                      <ReadValue value={form.format} />
                    ) : (
                      <>
                        <input className="input" list="formats" value={form.format || ''} onChange={set('format')} placeholder="Graphic, Carousel, Short Video…" />
                        <datalist id="formats">{FORMATS.map((f) => <option key={f} value={f} />)}</datalist>
                      </>
                    )}
                  </Field>
                  {isAdmin && (
                  <Field label="Type / boost">
                    {readOnly ? (
                      <ReadValue value={`${form.kind === 'AD' ? 'Ad' : 'Organic post'} · ${BOOSTS.find((b) => b.value === form.boost)?.label}`} />
                    ) : (
                      <div className="flex gap-2">
                        <select className="input" value={form.kind} onChange={set('kind')}>
                          <option value="ORGANIC">Organic post</option>
                          <option value="AD">Ad</option>
                        </select>
                        <select className="input" value={form.boost} onChange={set('boost')}>
                          {BOOSTS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                        </select>
                      </div>
                    )}
                  </Field>
                  )}
                  <Field label="Remarks / reviewer notes" className="col-span-2">
                    {readOnly ? <ReadValue value={form.remarks} pre /> : <textarea className="input" rows={3} value={form.remarks || ''} onChange={set('remarks')} />}
                  </Field>
                </div>
              )}

              {tab === 'content' && (
                <div className="space-y-3">
                  <Field label="Content story board">
                    {readOnly ? <ReadValue value={form.storyboard} pre /> : <textarea className="input" rows={4} value={form.storyboard || ''} onChange={set('storyboard')} placeholder="Hook, flow of the graphic / video, key points…" />}
                  </Field>
                  <Field label="Graphics idea">
                    {readOnly ? <ReadValue value={form.graphicsIdea} pre /> : <textarea className="input" rows={2} value={form.graphicsIdea || ''} onChange={set('graphicsIdea')} />}
                  </Field>
                  <Field label="Title draft / thumbnail">
                    {readOnly ? <ReadValue value={form.titleDraft} /> : <input className="input" value={form.titleDraft || ''} onChange={set('titleDraft')} />}
                  </Field>
                  <Field label="Caption">
                    {readOnly ? <ReadValue value={form.caption} pre /> : <textarea className="input" rows={7} value={form.caption || ''} onChange={set('caption')} />}
                  </Field>
                  <Field label="Hashtags">
                    {readOnly ? <ReadValue value={form.hashtags} /> : <input className="input" value={form.hashtags || ''} onChange={set('hashtags')} placeholder="#FrontlineBusinessSolutions #…" />}
                  </Field>
                  <Field label="Pubmat links (one per line)">
                    {readOnly ? <Links links={post?.pubmatLinks} /> : <textarea className="input font-mono text-xs" rows={3} value={form.pubmatLinks} onChange={set('pubmatLinks')} placeholder="https://drive.google.com/…  or  https://www.canva.com/…" />}
                  </Field>
                  <Field label="Reference link (original source)">
                    {readOnly ? <Links links={form.referenceLink ? [form.referenceLink] : []} /> : <input className="input" value={form.referenceLink || ''} onChange={set('referenceLink')} />}
                  </Field>
                </div>
              )}

              {tab === 'ad' && (
                <div className="space-y-3">
                  <Field label="Primary text">
                    {readOnly ? <ReadValue value={form.ad.primaryText} pre /> : <textarea className="input" rows={5} value={form.ad.primaryText || ''} onChange={setAd('primaryText')} />}
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Headline">{readOnly ? <ReadValue value={form.ad.headline} /> : <input className="input" value={form.ad.headline || ''} onChange={setAd('headline')} />}</Field>
                    <Field label="Call to action">{readOnly ? <ReadValue value={form.ad.cta} /> : <input className="input" value={form.ad.cta || ''} onChange={setAd('cta')} placeholder="Send Message" />}</Field>
                  </div>
                  <Field label="Description">{readOnly ? <ReadValue value={form.ad.description} /> : <input className="input" value={form.ad.description || ''} onChange={setAd('description')} />}</Field>
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="label mb-0">Targeting (ad sets)</span>
                      {!readOnly && (
                        <button
                          type="button"
                          className="btn-ghost px-2 py-0.5 text-xs"
                          onClick={() => setForm((f) => ({ ...f, ad: { ...f.ad, adSets: [...f.ad.adSets, { name: `Ad set ${f.ad.adSets.length + 1}`, targeting: '' }] } }))}
                        >
                          + Add ad set
                        </button>
                      )}
                    </div>
                    <div className="space-y-2">
                      {form.ad.adSets.map((a, i) => (
                        <div key={i} className="rounded-lg border border-slate-200 p-2">
                          {readOnly ? (
                            <>
                              <p className="text-xs font-medium text-slate-600">{a.name}</p>
                              <ReadValue value={a.targeting} pre />
                            </>
                          ) : (
                            <>
                              <div className="mb-1 flex gap-2">
                                <input
                                  className="input py-1 text-xs"
                                  value={a.name}
                                  onChange={(e) => setForm((f) => ({ ...f, ad: { ...f.ad, adSets: f.ad.adSets.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) } }))}
                                />
                                <button type="button" className="btn-ghost px-2" onClick={() => setForm((f) => ({ ...f, ad: { ...f.ad, adSets: f.ad.adSets.filter((_, j) => j !== i) } }))}>
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                              <textarea
                                className="input text-xs"
                                rows={3}
                                placeholder="Location, age range, interests…"
                                value={a.targeting}
                                onChange={(e) => setForm((f) => ({ ...f, ad: { ...f.ad, adSets: f.ad.adSets.map((x, j) => (j === i ? { ...x, targeting: e.target.value } : x)) } }))}
                              />
                            </>
                          )}
                        </div>
                      ))}
                      {!form.ad.adSets.length && <p className="text-sm text-slate-500">No ad sets yet.</p>}
                    </div>
                  </div>
                  <Field label="Botcake message">{readOnly ? <ReadValue value={form.ad.botcakeMessage} /> : <input className="input" value={form.ad.botcakeMessage || ''} onChange={setAd('botcakeMessage')} />}</Field>
                </div>
              )}

              {tab === 'metrics' && (
                <div>
                  <p className="mb-3 text-xs text-slate-500">Fill these in after the post goes live (from Meta Business Suite insights).</p>
                  <div className="grid grid-cols-3 gap-3">
                    {[['reacts', 'Reacts'], ['comments', 'Comments'], ['shares', 'Shares'], ['reach', 'Reach'], ['engagement', 'Engagement'], ['linkClicks', 'Link clicks']].map(([k, label]) => (
                      <Field key={k} label={label}>
                        {readOnly ? <ReadValue value={form[k] === '' ? null : Number(form[k]).toLocaleString()} /> : <input type="number" min="0" className="input" value={form[k]} onChange={set(k)} />}
                      </Field>
                    ))}
                    <Field label="Feedback" className="col-span-3">
                      {readOnly ? (
                        <ReadValue value={FEEDBACK.find((f) => f.value === form.feedback)?.label} />
                      ) : (
                        <select className="input" value={form.feedback || ''} onChange={set('feedback')}>
                          <option value="">—</option>
                          {FEEDBACK.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                        </select>
                      )}
                    </Field>
                  </div>
                </div>
              )}

              {tab === 'discussion' && post && <Discussion post={post} />}
            </>
          )}
        </div>

        {canEdit && (
          <footer className="flex flex-wrap items-center gap-2 border-t border-slate-200 px-5 py-3">
            {!isNew && (
              <>
                <button
                  className="btn-ghost text-red-600"
                  title="Delete"
                  onClick={async () => {
                    if (!confirm('Delete this post? This cannot be undone.')) return;
                    await del.mutateAsync(post.id);
                    onClose();
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                {isAdmin && (
                  <button className="btn-ghost" title="Duplicate" onClick={() => dup.mutateAsync({ id: post.id })}>
                    <Copy className="h-4 w-4" />
                  </button>
                )}
                {isAdmin && post && !['FOR_APPROVAL', 'APPROVED', 'SCHEDULED', 'PUBLISHED', 'BOOSTED', 'IDEA'].includes(post.status) && (
                  <button
                    className="btn-secondary"
                    disabled={submit.isPending}
                    onClick={() => {
                      if (!hasApprover && !confirm('No approver is set for this post, so it won’t show in anyone’s “My approvals”. Send it anyway?')) {
                        setTab('details');
                        return;
                      }
                      submit.mutateAsync({ id: post.id, approverId: form.approverId || undefined });
                    }}
                    title={hasApprover ? 'Set status to For approval and notify the approver' : 'Tip: pick an approver in Details first'}
                  >
                    <Send className="h-4 w-4" /> Send for approval
                  </button>
                )}
                <button className="btn-ghost" onClick={() => setTab('discussion')} title="Comments">
                  <MessageSquare className="h-4 w-4" />
                </button>
              </>
            )}
            <div className="ml-auto flex items-center gap-2">
              {dirty && <span className="hidden text-xs text-amber-700 sm:inline">Unsaved changes</span>}
              <button className="btn-secondary" onClick={requestClose}>Close</button>
              <button className="btn-primary" onClick={save} disabled={!form.title.trim() || create.isPending || update.isPending} title="Save (Ctrl + S)">
                {create.isPending || update.isPending ? 'Saving…' : isNew ? 'Create post' : 'Save changes'}
              </button>
            </div>
          </footer>
        )}
      </aside>
    </div>
  );
}
