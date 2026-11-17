import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarDays, CalendarRange, Check, ChevronDown, ChevronRight, ClipboardCopy, ExternalLink, RefreshCw, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { useContentRequest, useGenerateContent, useGenerateStatus, usePillars, useReadClaudeReply, useSaveGeneratedContent } from '../api/hooks';
import { PLACEMENTS } from '../lib/constants';
import { formatDate, monthBounds, monthLabel, weekOf } from '../lib/dates';
import { Modal, PillarDot, PlacementChips, Spinner } from './ui';

const SCOPES = [
  { id: 'day', label: 'A specific day', icon: CalendarDays },
  { id: 'week', label: 'One week', icon: CalendarRange },
  { id: 'month', label: 'The whole month', icon: CalendarRange },
];
const GOALS = ['Brand awareness', 'Engagement (likes, comments, shares)', 'Leads and inquiries', 'Sales and promos', 'Education and tips', 'Community and values'];
const TONES = ['Friendly and conversational', 'Professional and trustworthy', 'Inspirational', 'Fun and playful', 'Warm and faith-based'];
const LANGUAGES = ['English', 'Taglish (English + Filipino)', 'Filipino'];

const DEFAULT_BRIEF = {
  goal: GOALS[1],
  customGoal: '',
  audience: '',
  tone: TONES[0],
  language: LANGUAGES[0],
  placements: ['FB_POST', 'IG_POST'],
  cta: '',
  notes: '',
  avoid: '',
  hashtags: true,
};

// the brief is remembered per client in this browser, so the team doesn't retype it every time
const briefKey = (clientId) => `cc.genBrief.${clientId}`;
function loadBrief(clientId) {
  try {
    const saved = JSON.parse(localStorage.getItem(briefKey(clientId)) || 'null');
    return saved ? { ...DEFAULT_BRIEF, ...saved, notes: '' } : DEFAULT_BRIEF;
  } catch {
    return DEFAULT_BRIEF;
  }
}
function saveBrief(clientId, brief) {
  try {
    const { notes, ...keep } = brief; // promos/events change every time
    localStorage.setItem(briefKey(clientId), JSON.stringify(keep));
  } catch {
    /* storage blocked */
  }
}

export default function GenerateContentModal({ open, onClose, client, day, month }) {
  const [step, setStep] = useState('setup'); // setup → (paste →) review
  const [mode, setMode] = useState('api'); // 'api' = one click; 'paste' = through the person's own claude.ai plan
  const [requestText, setRequestText] = useState('');
  const [reply, setReply] = useState('');
  const [scope, setScope] = useState('week');
  const [pickDay, setPickDay] = useState(day);
  const [postsPerDay, setPostsPerDay] = useState(1);
  const [days, setDays] = useState('every');
  const [brief, setBrief] = useState(() => loadBrief(client.id));
  const [result, setResult] = useState(null);
  const [keep, setKeep] = useState(new Set());
  const [expanded, setExpanded] = useState(null);
  const generate = useGenerateContent();
  const save = useSaveGeneratedContent();
  const request = useContentRequest();
  const readReply = useReadClaudeReply();
  const { data: status } = useGenerateStatus(open);
  const apiReady = Boolean(status?.api);
  const { data: pillars = [] } = usePillars(client.id);
  const hasPillarDays = pillars.some((p) => p.active && p.weekday !== null && p.weekday !== undefined);

  useEffect(() => {
    if (!open) return;
    setStep('setup');
    setPickDay(day);
    setResult(null);
    setReply('');
    setBrief(loadBrief(client.id));
  }, [open, day, client.id]);

  const range = useMemo(() => {
    if (scope === 'day') return { from: pickDay, to: pickDay, label: formatDate(pickDay, { withYear: true }) };
    if (scope === 'week') {
      const w = weekOf(pickDay);
      return { from: w[0], to: w[6], label: `${formatDate(w[0])} – ${formatDate(w[6], { withYear: true })}` };
    }
    const b = monthBounds(pickDay.slice(0, 7));
    return { from: b.from, to: b.to, label: monthLabel(pickDay.slice(0, 7)) };
  }, [scope, pickDay]);

  const set = (patch) => setBrief((b) => ({ ...b, ...patch }));
  const togglePlacement = (v) => set({ placements: brief.placements.includes(v) ? brief.placements.filter((x) => x !== v) : [...brief.placements, v] });
  const goal = brief.goal === 'Other' ? brief.customGoal.trim() : brief.goal;
  const canGenerate = goal && brief.placements.length && !generate.isPending;

  const body = () => ({
    clientId: client.id,
    from: range.from,
    to: range.to,
    postsPerDay,
    days: scope === 'day' ? 'every' : days,
    placements: brief.placements,
    goal,
    audience: brief.audience,
    tone: brief.tone,
    language: brief.language,
    cta: brief.cta,
    notes: brief.notes,
    avoid: brief.avoid,
    hashtags: brief.hashtags,
  });
  const showDrafts = (r) => {
    setResult(r);
    setKeep(new Set(r.drafts.map((_, i) => i)));
    setExpanded(null);
    setStep('review');
  };

  // copy-paste way: 1) build the request for claude.ai
  const getRequest = async () => {
    saveBrief(client.id, brief);
    setMode('paste');
    const r = await request.mutateAsync(body());
    setRequestText(r.text);
    setReply('');
    setStep('paste');
  };
  const copyRequest = async () => {
    try {
      await navigator.clipboard.writeText(requestText);
      toast.success('Copied. Now paste it into Claude');
    } catch {
      document.getElementById('cc-gen-request')?.select();
      toast('Press Ctrl+C to copy the selected text');
    }
  };
  // 2) read the reply pasted back
  const readPasted = async () => showDrafts(await readReply.mutateAsync({ ...body(), reply }));

  const run = async () => {
    saveBrief(client.id, brief);
    setMode('api');
    showDrafts(await generate.mutateAsync(body()));
  };

  const addToCalendar = async () => {
    const drafts = result.drafts.filter((_, i) => keep.has(i)).map(({ pillarName, ...d }) => d);
    await save.mutateAsync({ clientId: client.id, drafts });
    onClose();
  };

  const busy = generate.isPending;
  const footer =
    step === 'setup' ? (
      <>
        <button className="btn-secondary mr-auto" onClick={onClose} disabled={busy}>Cancel</button>
        {apiReady && (
          <button className="btn-secondary" disabled={!canGenerate || request.isPending} onClick={getRequest} title="Write the posts in claude.ai with your own Claude plan">
            Use my Claude plan
          </button>
        )}
        {apiReady ? (
          <button className="btn-primary" disabled={!canGenerate} onClick={run}>
            {busy ? <Spinner className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />} {busy ? 'Writing posts…' : 'Generate'}
          </button>
        ) : (
          <button className="btn-primary" disabled={!canGenerate || request.isPending} onClick={getRequest}>
            {request.isPending ? <Spinner className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />} Next: write it in Claude
          </button>
        )}
      </>
    ) : step === 'paste' ? (
      <>
        <button className="btn-secondary mr-auto" onClick={() => setStep('setup')} disabled={readReply.isPending}>
          <ArrowLeft className="h-4 w-4" /> Change brief
        </button>
        <button className="btn-primary" disabled={!reply.trim() || readReply.isPending} onClick={readPasted}>
          {readReply.isPending ? <Spinner className="h-4 w-4" /> : <Check className="h-4 w-4" />} Show the drafts
        </button>
      </>
    ) : (
      <>
        <button className="btn-secondary mr-auto" onClick={() => setStep('setup')} disabled={busy || save.isPending}>
          <ArrowLeft className="h-4 w-4" /> Change brief
        </button>
        <button
          className="btn-secondary"
          onClick={mode === 'paste' ? () => { setReply(''); setStep('paste'); } : run}
          disabled={busy || save.isPending}
          title={mode === 'paste' ? 'Paste a different reply from Claude' : 'Write a new set of drafts'}
        >
          {busy ? <Spinner className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />} {busy ? 'Writing…' : mode === 'paste' ? 'Paste another reply' : 'Try again'}
        </button>
        <button className="btn-primary" disabled={!keep.size || save.isPending || busy} onClick={addToCalendar}>
          <Check className="h-4 w-4" /> {save.isPending ? 'Adding…' : `Add ${keep.size} to calendar`}
        </button>
      </>
    );

  return (
    <Modal open={open} onClose={busy ? undefined : onClose} title={`Generate content · ${client.name}`} footer={footer} wide>
      {step === 'setup' ? (
        <div className="space-y-5 text-sm">
          {/* 1. period */}
          <section>
            <h3 className="mb-2 font-semibold text-slate-800">1. What should I write?</h3>
            <div className="grid gap-2 sm:grid-cols-3">
              {SCOPES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setScope(s.id)}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-left ${scope === s.id ? 'border-brand-500 bg-brand-50 font-medium text-brand-700' : 'border-slate-200 hover:bg-slate-50'}`}
                >
                  <s.icon className="h-4 w-4" /> {s.label}
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="block">
                <span className="label">{scope === 'day' ? 'Day' : scope === 'week' ? 'Any day in that week' : 'Any day in that month'}</span>
                <input type="date" className="input w-auto" value={pickDay} onChange={(e) => e.target.value && setPickDay(e.target.value)} />
              </label>
              <label className="block">
                <span className="label">Posts per day</span>
                <select className="input w-auto" value={postsPerDay} onChange={(e) => setPostsPerDay(Number(e.target.value))}>
                  {[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              {scope !== 'day' && (
                <label className="block">
                  <span className="label">Which days</span>
                  <select className="input w-auto" value={days} onChange={(e) => setDays(e.target.value)}>
                    <option value="every">Every day</option>
                    <option value="weekdays">Monday to Friday only</option>
                    <option value="pillar" disabled={!hasPillarDays}>Only days with a pillar slot</option>
                  </select>
                </label>
              )}
            </div>
            <p className="mt-2 text-xs text-slate-500">Period: <b className="text-slate-700">{range.label}</b>. Posts already on the calendar are kept; new ideas avoid repeating them.</p>
          </section>

          {/* 2. brief */}
          <section className="space-y-3">
            <h3 className="font-semibold text-slate-800">2. A few questions about the content</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="label">Main goal</span>
                <select className="input" value={brief.goal} onChange={(e) => set({ goal: e.target.value })}>
                  {GOALS.map((g) => <option key={g}>{g}</option>)}
                  <option value="Other">Other…</option>
                </select>
                {brief.goal === 'Other' && <input className="input mt-1.5" placeholder="Describe the goal" value={brief.customGoal} onChange={(e) => set({ customGoal: e.target.value })} />}
              </label>
              <label className="block">
                <span className="label">Who is it for?</span>
                <input className="input" placeholder="e.g. small business owners in Metro Manila" value={brief.audience} onChange={(e) => set({ audience: e.target.value })} />
              </label>
              <label className="block">
                <span className="label">Tone of voice</span>
                <select className="input" value={brief.tone} onChange={(e) => set({ tone: e.target.value })}>
                  {TONES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="label">Language</span>
                <select className="input" value={brief.language} onChange={(e) => set({ language: e.target.value })}>
                  {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
                </select>
              </label>
            </div>
            <div>
              <span className="label">Platforms</span>
              <div className="flex flex-wrap gap-1.5">
                {PLACEMENTS.map((p) => {
                  const on = brief.placements.includes(p.value);
                  return (
                    <button
                      key={p.value}
                      onClick={() => togglePlacement(p.value)}
                      className={`cursor-pointer rounded-full border px-2.5 py-1 text-xs ${on ? 'border-brand-500 bg-brand-50 font-medium text-brand-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                    >
                      {on && <Check className="mr-1 inline h-3 w-3" />}
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <label className="block">
              <span className="label">Main call to action (optional)</span>
              <input className="input" placeholder="e.g. Message us for a free consultation" value={brief.cta} onChange={(e) => set({ cta: e.target.value })} />
            </label>
            <label className="block">
              <span className="label">Products, promos, events or messages to include (optional)</span>
              <textarea
                className="input min-h-20"
                placeholder="e.g. 10% off website packages until Nov 30; webinar on Dec 5; new FBS Pay feature"
                value={brief.notes}
                onChange={(e) => set({ notes: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="label">Anything to avoid? (optional)</span>
              <input className="input" placeholder="e.g. no political topics, don't mention competitors" value={brief.avoid} onChange={(e) => set({ avoid: e.target.value })} />
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={brief.hashtags} onChange={(e) => set({ hashtags: e.target.checked })} /> Include hashtags
            </label>
            <p className="text-xs text-slate-500">
              The client’s pillars{pillars.length ? ` (${pillars.filter((p) => p.active).length})` : ''} and monthly theme are used automatically. Nothing is added until you review the drafts.
            </p>
          </section>
          {busy && (
            <div className="flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-brand-700">
              <Spinner className="h-4 w-4" /> Writing your posts. A week takes about a minute; a whole month can take a few minutes.
            </div>
          )}
        </div>
      ) : step === 'paste' ? (
        <div className="space-y-4 text-sm">
          <section>
            <h3 className="mb-1 font-semibold text-slate-800">1. Copy this request</h3>
            <p className="mb-2 text-xs text-slate-500">It already has the client’s details, pillars, theme, existing posts and your answers.</p>
            <textarea id="cc-gen-request" readOnly className="input h-32 font-mono text-xs" value={requestText} onFocus={(e) => e.target.select()} />
            <div className="mt-2 flex flex-wrap gap-2">
              <button className="btn-primary" onClick={copyRequest}><ClipboardCopy className="h-4 w-4" /> Copy request</button>
              <a className="btn-secondary" href="https://claude.ai/new" target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /> Open Claude</a>
            </div>
          </section>
          <section>
            <h3 className="mb-1 font-semibold text-slate-800">2. Paste it into a new Claude chat and send it</h3>
            <p className="text-xs text-slate-500">
              Claude answers with a code block. A whole month can take a minute or two. If the reply stops early, type “continue” in Claude, then copy everything.
            </p>
          </section>
          <section>
            <h3 className="mb-1 font-semibold text-slate-800">3. Copy Claude’s whole reply and paste it here</h3>
            <textarea
              className="input h-40 font-mono text-xs"
              placeholder="Paste Claude’s reply here (the copy button under the code block copies just the posts)"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
            />
          </section>
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-slate-600">
              {result.drafts.length} draft{result.drafts.length === 1 ? '' : 's'} for <b>{range.label}</b>. Untick any you don’t want, then add the rest to the calendar.
            </p>
            <button
              className="btn-ghost ml-auto text-xs"
              onClick={() => setKeep(keep.size === result.drafts.length ? new Set() : new Set(result.drafts.map((_, i) => i)))}
            >
              {keep.size === result.drafts.length ? 'Untick all' : 'Tick all'}
            </button>
          </div>
          {!result.drafts.length && <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">No drafts came back. Try again or change the brief.</p>}
          <ul className="max-h-[55vh] divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
            {result.drafts.map((d, i) => {
              const open = expanded === i;
              const pillar = pillars.find((p) => p.id === d.pillarId);
              return (
                <li key={i} className={keep.has(i) ? '' : 'opacity-50'}>
                  <div className="flex items-start gap-2 px-3 py-2">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={keep.has(i)}
                      onChange={() => setKeep((k) => { const n = new Set(k); n.has(i) ? n.delete(i) : n.add(i); return n; })}
                      aria-label={`Keep “${d.title}”`}
                    />
                    <button className="min-w-0 flex-1 cursor-pointer text-left" onClick={() => setExpanded(open ? null : i)}>
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-xs font-medium text-slate-500">{formatDate(d.date)}</span>
                        {pillar && <span className="inline-flex items-center gap-1 text-xs text-slate-600"><PillarDot pillar={pillar} /> {pillar.name}</span>}
                        {d.format && <span className="rounded bg-slate-100 px-1.5 text-[11px] text-slate-600">{d.format}</span>}
                        <PlacementChips placements={d.placements} />
                      </span>
                      <span className="mt-0.5 flex items-center gap-1 font-medium text-slate-800">
                        {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />} {d.title}
                      </span>
                    </button>
                  </div>
                  {open && (
                    <div className="space-y-2 px-9 pb-3 text-[13px] text-slate-700">
                      <Field label="Caption" text={d.caption} />
                      <Field label="Hashtags" text={d.hashtags} />
                      <Field label="Graphics idea" text={d.graphicsIdea} />
                      <Field label="Storyboard" text={d.storyboard} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-slate-500">Added posts start as <b>In progress</b>, so you can edit them before sending them for approval.</p>
        </div>
      )}
    </Modal>
  );
}

function Field({ label, text }) {
  if (!text) return null;
  return (
    <div>
      <div className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">{label}</div>
      <p className="whitespace-pre-wrap">{text}</p>
    </div>
  );
}
