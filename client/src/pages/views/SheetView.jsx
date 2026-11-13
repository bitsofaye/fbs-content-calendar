import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Archive, ArchiveRestore, ArrowDown, ArrowUp, Check, ChevronDown, Download, ExternalLink, Loader2, Maximize2, Plus, RotateCcw, Table2, Trash2, X } from 'lucide-react';
import { useBulkArchive, useBulkDelete, useBulkUpdate, useCreatePost, usePosts } from '../../api/hooks';
import { FEEDBACK, PLACEMENT, PLACEMENTS, STATUS, STATUSES } from '../../lib/constants';
import { formatDate, monthBounds, todayISO } from '../../lib/dates';
import { downloadCSV, toCSV } from '../../lib/csv';
import { EmptyState, PillarTag, PlatformList, StatusBadge } from '../../components/ui';

// ---------- batching save queue: many quick edits → one /posts/bulk request ----------
function useSaveQueue() {
  const bulk = useBulkUpdate();
  const pending = useRef(new Map());
  const timer = useRef(null);
  const [state, setState] = useState('idle'); // idle | pending | saving | saved

  const mounted = useRef(true);
  const flush = async () => {
    clearTimeout(timer.current);
    if (!pending.current.size) return;
    const updates = [...pending.current.entries()].map(([id, data]) => ({ id, data }));
    pending.current.clear();
    if (mounted.current) setState('saving');
    try {
      await bulk.mutateAsync(updates);
      if (mounted.current) setState('saved');
    } catch {
      if (mounted.current) setState('idle');
    }
  };
  const flushRef = useRef(flush);
  flushRef.current = flush;

  const queue = (id, data) => {
    pending.current.set(id, { ...(pending.current.get(id) || {}), ...data });
    setState('pending');
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 700);
  };

  useEffect(() => {
    mounted.current = true;
    // warn before closing the tab while an edit is still waiting to be saved
    const beforeUnload = (e) => {
      if (pending.current.size) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      // leaving the Sheet (another view, another page): save what's still waiting instead of dropping it
      mounted.current = false;
      flushRef.current();
    };
  }, []);
  return { queue, flush, state };
}

// ---------- editable cells ----------
// A text box that grows with its content, so nothing is hidden or cut off.
// Very long text (captions) stops growing at maxRows and scrolls inside the cell.
function TextCell({ value, onSave, placeholder, maxRows = 12, previewRows = null, strong = false, numeric = false }) {
  const [v, setV] = useState(value ?? '');
  const [focused, setFocused] = useState(false);
  const ref = useRef(null);
  // long text shows its first lines until you click into it, then the whole text
  const rowsNow = previewRows && !focused ? previewRows : maxRows;
  useEffect(() => setV(value ?? ''), [value]);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      el.style.height = 'auto';
      const max = rowsNow * 20 + 10;
      el.style.height = Math.min(el.scrollHeight + 2, max) + 'px';
      const more = el.scrollHeight + 2 > max;
      const preview = more && previewRows && !focused;
      el.style.overflowY = more && !preview ? 'auto' : 'hidden';
      // a soft fade at the bottom says "there is more — click to read it all"
      el.style.maskImage = el.style.webkitMaskImage = preview ? 'linear-gradient(to bottom, #000 70%, transparent)' : '';
    };
    fit();
    // the column can still change width after the first paint (table layout, window resize)
    let lastWidth = el.clientWidth;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth !== lastWidth) {
        lastWidth = el.clientWidth;
        fit();
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [v, rowsNow, previewRows, focused]);
  const commit = () => {
    if ((value ?? '') !== v) onSave(v === '' ? null : v);
  };
  return (
    <textarea
      ref={ref}
      rows={1}
      className={`block w-full resize-none rounded-md border border-transparent bg-transparent px-2 py-1 text-[13px] leading-5 break-words whitespace-pre-wrap outline-none hover:border-slate-200 focus:border-brand-500 focus:bg-white ${strong ? 'font-medium text-slate-800' : 'text-slate-700'} ${numeric ? 'tabular-nums' : ''}`}
      value={v}
      placeholder={placeholder}
      onChange={(e) => setV(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        commit();
      }}
      title={previewRows && !focused ? 'Click to see and edit the whole text' : undefined}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.altKey) {
          e.preventDefault();
          e.currentTarget.blur();
        }
        if (e.key === 'Escape') {
          setV(value ?? '');
          e.currentTarget.blur();
        }
      }}
    />
  );
}

// Read-only text for client users: full text, wrapped
function ReadText({ children, strong = false, muted = false, previewRows = null }) {
  const [open, setOpen] = useState(false);
  if (children === null || children === undefined || children === '') return <span className="px-2 text-slate-400">—</span>;
  const text = String(children);
  const long = previewRows && (text.length > previewRows * 45 || text.split('\n').length > previewRows);
  return (
    <div className="px-2 py-1">
      <p
        className={`text-[13px] leading-5 break-words whitespace-pre-wrap ${strong ? 'font-medium text-slate-800' : muted ? 'text-slate-500' : 'text-slate-700'}`}
        style={long && !open ? { display: '-webkit-box', WebkitLineClamp: previewRows, WebkitBoxOrient: 'vertical', overflow: 'hidden' } : undefined}
      >
        {text}
      </p>
      {long && (
        <button className="mt-0.5 cursor-pointer text-xs font-medium text-brand-600 hover:underline" onClick={() => setOpen((v) => !v)}>
          {open ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}

// let "Birthday/Work Anniversary" wrap after the slash instead of mid-word
const softBreaks = (s) => (typeof s === 'string' ? s.replace(/\//g, '/​') : s);

// A dropdown whose chosen value wraps onto more lines instead of being cut off:
// the visible label is ordinary wrapping text, and the real <select> sits invisibly on top of it.
function SelectCell({ value, options, onSave, allowEmpty, emptyLabel = '—' }) {
  const current = options.find((o) => o.value === value)?.label ?? (allowEmpty ? emptyLabel : '');
  return (
    <div className="relative rounded-md border border-transparent hover:border-slate-200 has-[select:focus]:border-brand-500 has-[select:focus]:bg-white">
      <div className="flex items-start gap-1 px-2 py-1 text-[13px] leading-5 text-slate-700">
        <span className={`min-w-0 flex-1 break-words ${value ? '' : 'text-slate-400'}`}>{softBreaks(current)}</span>
        <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
      </div>
      <select
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        value={value ?? ''}
        aria-label={current}
        onChange={(e) => onSave(e.target.value === '' ? null : e.target.value)}
      >
        {allowEmpty && <option value="">{emptyLabel}</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function PlacementCell({ value = [], onSave }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  const toggle = (p) => onSave(value.includes(p) ? value.filter((x) => x !== p) : [...value, p]);
  return (
    <div ref={ref} className="relative">
      <button className="w-full cursor-pointer rounded-md px-1.5 py-1 text-left hover:bg-slate-100" onClick={() => setOpen((o) => !o)} title="Choose platforms">
        <PlatformList placements={value} />
      </button>
      {open && (
        <div className="absolute top-full left-0 z-20 mt-1 w-52 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
          {PLACEMENTS.map((p) => (
            <button key={p.value} onClick={() => toggle(p.value)} className="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-slate-50">
              <span className={`flex h-3.5 w-3.5 items-center justify-center rounded border ${value.includes(p.value) ? 'border-brand-600 bg-brand-600' : 'border-slate-300'}`}>
                {value.includes(p.value) && <Check className="h-2.5 w-2.5 text-white" />}
              </span>
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- resizable columns and rows (remembered in this browser) ----------
function useStored(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(key)) || initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* private window: sizes just aren't remembered */
    }
  }, [key, value]);
  return [value, setValue];
}

// Drag with the mouse (or finger); calls onMove with how far the pointer moved since the start.
function startDrag(e, onMove) {
  e.preventDefault();
  e.stopPropagation();
  const x0 = e.clientX;
  const y0 = e.clientY;
  const move = (ev) => onMove(ev.clientX - x0, ev.clientY - y0);
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  document.body.style.userSelect = 'none';
}

const MIN_COL = 60;
const MAX_COL = 900;
const MIN_ROW = 40;

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function SheetView({ client, posts, month, isAdmin, onOpen, people }) {
  const { queue, state } = useSaveQueue();
  const create = useCreatePost();
  const [sort, setSort] = useState({ key: 'date', dir: 1 });
  const [showMetrics, setShowMetrics] = useState(false);
  const [showContent, setShowContent] = useState(true);
  // local overlay so edits show instantly before the refetch arrives
  const [local, setLocal] = useState({});

  // archived posts are hidden everywhere; admins can look at them here and restore them
  const [showArchived, setShowArchived] = useState(false);
  const [colW, setColW] = useStored('cc.sheet.colWidths', {});
  const [rowH, setRowH] = useStored('cc.sheet.rowHeights', {});
  const bounds = monthBounds(month);
  const archivedQ = usePosts({ clientId: client.id, from: bounds.from, to: bounds.to, archived: 'true' }, { enabled: isAdmin && showArchived });
  const source = showArchived ? archivedQ.data || [] : posts;
  useEffect(() => setLocal({}), [source]);

  // row selection (admins): select all, then archive or delete in one go
  const [selected, setSelected] = useState(() => new Set());
  const archive = useBulkArchive();
  const remove = useBulkDelete();
  useEffect(() => setSelected(new Set()), [month, showArchived]);
  useEffect(() => {
    // drop selections that are no longer on screen (filters changed, rows deleted)
    const visible = new Set(source.map((p) => p.id));
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [source]);

  const pillarOpts = (client.pillars || []).map((p) => ({ value: p.id, label: p.name }));
  const peopleOpts = people.map((u) => ({ value: u.id, label: u.name }));
  const pillarById = Object.fromEntries((client.pillars || []).map((p) => [p.id, p]));

  const rows = useMemo(() => {
    const merged = source.map((p) => ({ ...p, ...(local[p.id] || {}) }));
    const val = (p) => {
      switch (sort.key) {
        case 'pillar': return pillarById[p.pillarId]?.name || '';
        case 'status': return STATUSES.findIndex((s) => s.value === p.status);
        case 'approver': return p.approver?.name || p.approverName || '';
        default: return p[sort.key] ?? '';
      }
    };
    return merged.sort((a, b) => {
      const x = val(a);
      const y = val(b);
      if (x < y) return -sort.dir;
      if (x > y) return sort.dir;
      return (a.date || '').localeCompare(b.date || '');
    });
  }, [source, local, sort, pillarById]);

  const edit = (post, data) => {
    setLocal((l) => ({ ...l, [post.id]: { ...(l[post.id] || {}), ...data } }));
    queue(post.id, data);
  };

  const headCls = 'sticky top-0 z-10 border-b border-slate-200 bg-brand-50 px-2 py-2.5 text-left align-bottom text-xs font-semibold text-slate-600';
  // grip on the right edge of a column header: drag to resize, double-click to reset
  const ColGrip = ({ col }) =>
    col ? (
      <span
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize column"
        title="Drag to resize · double-click to reset"
        className="absolute top-0 -right-1 z-20 h-full w-2.5 cursor-col-resize touch-none select-none after:absolute after:top-1/4 after:left-1/2 after:h-1/2 after:w-0.5 after:-translate-x-1/2 after:rounded-full after:bg-slate-300 hover:after:bg-brand-500"
        onPointerDown={(e) => {
          const start = widthOf(col);
          document.body.style.cursor = 'col-resize';
          startDrag(e, (dx) => setColW((prev) => ({ ...prev, [col]: Math.round(Math.min(MAX_COL, Math.max(MIN_COL, start + dx))) })));
        }}
        onDoubleClick={() => setColW(({ [col]: _drop, ...rest }) => rest)}
      />
    ) : null;
  const SortHead = ({ k, col = k, children, className = '' }) => (
    <th className={`${headCls} ${className}`}>
      <button className="inline-flex cursor-pointer items-center gap-1 hover:text-slate-900" onClick={() => setSort((s) => ({ key: k, dir: s.key === k ? -s.dir : 1 }))}>
        {children}
        {sort.key === k && (sort.dir === 1 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </button>
      <ColGrip col={col} />
    </th>
  );
  const Head = ({ col, children, className = '' }) => (
    <th className={`${headCls} ${className}`}>
      {children}
      <ColGrip col={col} />
    </th>
  );

  function exportCSV() {
    const cols = [
      { label: 'Date', value: (p) => p.date },
      { label: 'Day', value: (p) => (p.date ? DAY_NAMES[new Date(`${p.date}T00:00:00Z`).getUTCDay()] : '') },
      { label: 'Time', value: (p) => p.time },
      { label: 'Pillar / Service', value: (p) => pillarById[p.pillarId]?.name },
      { label: 'Topic', value: (p) => p.title },
      { label: 'Type', value: (p) => (p.kind === 'AD' ? 'Ad' : 'Organic') },
      { label: 'Platforms', value: (p) => p.placements.map((x) => PLACEMENT[x]?.label) },
      { label: 'Status', value: (p) => STATUS[p.status]?.label },
      { label: 'Approver', value: (p) => p.approver?.name || p.approverName },
      { label: 'Format', value: (p) => p.format },
      { label: 'Story board', value: (p) => p.storyboard },
      { label: 'Caption', value: (p) => p.caption },
      { label: 'Hashtags', value: (p) => p.hashtags },
      { label: 'Pubmat links', value: (p) => p.pubmatLinks },
      { label: 'Remarks', value: (p) => p.remarks },
      { label: 'Reacts', value: (p) => p.reacts },
      { label: 'Comments', value: (p) => p.comments },
      { label: 'Shares', value: (p) => p.shares },
      { label: 'Reach', value: (p) => p.reach },
      { label: 'Engagement', value: (p) => p.engagement },
      { label: 'Link clicks', value: (p) => p.linkClicks },
      { label: 'Feedback', value: (p) => FEEDBACK.find((f) => f.value === p.feedback)?.label },
    ];
    downloadCSV(`${client.slug}-${month}.csv`, toCSV(rows, cols));
  }

  const ro = !isAdmin || showArchived; // archived rows are read-only until restored

  const allSelected = rows.length > 0 && rows.every((p) => selected.has(p.id));
  const someSelected = selected.size > 0 && !allSelected;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(rows.map((p) => p.id)));
  const toggleOne = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const ids = [...selected];
  const n = ids.length;
  const busy = archive.isPending || remove.isPending;
  const doArchive = async () => {
    const restoring = showArchived;
    if (!restoring && !confirm(`Archive ${n} post${n === 1 ? '' : 's'}? They will be hidden from the calendar, dashboards and approvals. You can restore them from "Show archived".`)) return;
    await archive.mutateAsync({ ids, archived: !restoring });
    setSelected(new Set());
  };
  const doDelete = async () => {
    if (!confirm(`Permanently delete ${n} post${n === 1 ? '' : 's'}, with their comments and history? This cannot be undone.`)) return;
    await remove.mutateAsync(ids);
    setSelected(new Set());
  };

  // column widths (px) — kept narrow; text wraps onto more lines within them
  const cols = [
    ...(isAdmin ? [{ id: 'select', w: 40 }] : []),
    { id: 'open', w: 40 },
    { id: 'date', w: 132 },
    { id: 'pillar', w: 160 },
    { id: 'title', w: 200 },
    { id: 'platforms', w: 132 },
    { id: 'status', w: 128 },
    { id: 'approver', w: 128 },
    { id: 'format', w: 112 },
    ...(showContent ? [{ id: 'caption', w: 260 }, { id: 'hashtags', w: 170 }] : []),
    { id: 'pubmat', w: 96 },
    { id: 'remarks', w: 170 },
    ...(showMetrics ? ['reacts', 'comments', 'shares', 'reach', 'engagement', 'linkClicks'].map((id) => ({ id, w: 92 })).concat({ id: 'feedback', w: 112 }) : []),
  ];
  const widthOf = (id) => colW[id] ?? cols.find((c) => c.id === id)?.w ?? 120;
  const tableWidth = cols.reduce((sum, c) => sum + widthOf(c.id), 0);
  // a taller row shows more lines of its long texts (caption, hashtags, remarks)
  const linesFor = (p) => (rowH[p.id] ? Math.max(1, Math.floor((rowH[p.id] - 24) / 20)) : 5);
  const customSizes = Object.keys(colW).length + Object.keys(rowH).length > 0;

  return (
    <div className="card overflow-hidden">
      {n > 0 ? (
        // selection bar: icon-only actions for the chosen rows
        <div className="flex flex-wrap items-center gap-1.5 border-b border-brand-500/30 bg-brand-50 px-3 py-1.5">
          <span className="mr-1 text-xs font-semibold text-brand-700 tabular-nums">{n} selected</span>
          <button
            className="btn-ghost h-8 w-8 p-0 text-slate-700 hover:bg-white hover:text-brand-700"
            onClick={doArchive}
            disabled={busy}
            title={showArchived ? 'Restore' : 'Archive'}
            aria-label={showArchived ? `Restore ${n} selected` : `Archive ${n} selected`}
          >
            {showArchived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
          </button>
          <button
            className="btn-ghost h-8 w-8 p-0 text-red-600 hover:bg-white hover:text-red-700"
            onClick={doDelete}
            disabled={busy}
            title="Delete"
            aria-label={`Delete ${n} selected`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
          {busy && <Loader2 className="h-4 w-4 animate-spin text-brand-600" />}
          <button className="btn-ghost ml-auto h-8 w-8 p-0 text-slate-500" onClick={() => setSelected(new Set())} title="Clear selection" aria-label="Clear selection">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2">
        {isAdmin && !showArchived && (
          <button
            className="btn-secondary px-2 py-1 text-xs"
            disabled={create.isPending}
            onClick={async () => {
              // today if we're looking at this month, otherwise the 1st; then open it so it's easy to find and fill in
              const t = todayISO();
              const created = await create.mutateAsync({ clientId: client.id, title: 'New post', date: t.startsWith(month) ? t : `${month}-01`, status: 'IN_PROGRESS', placements: ['FB_POST', 'IG_POST', 'LINKEDIN_POST'] });
              onOpen(created);
            }}
          >
            <Plus className="h-3.5 w-3.5" /> Add row
          </button>
        )}
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-600">
          <input type="checkbox" checked={showContent} onChange={(e) => setShowContent(e.target.checked)} /> Caption columns
        </label>
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-600">
          <input type="checkbox" checked={showMetrics} onChange={(e) => setShowMetrics(e.target.checked)} /> Results columns
        </label>
        {isAdmin && (
          <label className={`flex cursor-pointer items-center gap-1.5 text-xs ${showArchived ? 'font-semibold text-brand-700' : 'text-slate-600'}`}>
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Show archived
          </label>
        )}
        {customSizes ? (
          <button className="btn-ghost px-2 py-1 text-xs" onClick={() => { setColW({}); setRowH({}); }} title="Put all column widths and row heights back to normal">
            <RotateCcw className="h-3.5 w-3.5" /> Reset sizes
          </button>
        ) : (
          <span className="hidden text-xs text-slate-400 xl:inline">Tip: drag a column edge or a row bottom edge to resize</span>
        )}
        <span className="ml-auto flex items-center gap-1 text-xs text-slate-500">
          {state === 'pending' && 'Unsaved changes…'}
          {state === 'saving' && (<><Loader2 className="h-3 w-3 animate-spin" /> Saving…</>)}
          {state === 'saved' && (<><Check className="h-3 w-3 text-green-600" /> All changes saved</>)}
        </span>
        <span className="text-xs text-slate-500">{rows.length} rows</span>
        <button className="btn-secondary px-2 py-1 text-xs" onClick={exportCSV} disabled={!rows.length}>
          <Download className="h-3.5 w-3.5" /> Export CSV
        </button>
      </div>
      )}
      {showArchived && (
        <p className="border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
          Showing <b>archived</b> posts for this month. They are hidden from the calendar, dashboards and approvals. Select them to restore or delete.
        </p>
      )}

      {rows.length === 0 ? (
        showArchived ? (
          <EmptyState icon={Archive} title="No archived posts this month" />
        ) : (
          <EmptyState icon={Table2} title="No posts this month">Add a row, or change the filters above.</EmptyState>
        )
      ) : (
        <div className="max-h-[75vh] overflow-auto">
          {/* fixed column widths: long text wraps downwards inside its column instead of stretching the table sideways */}
          <table className="table-fixed border-collapse" style={{ width: tableWidth, minWidth: '100%' }}>
            <colgroup>
              {cols.map((c) => <col key={c.id} style={{ width: widthOf(c.id) }} />)}
            </colgroup>
            <thead>
              <tr>
                {isAdmin && (
                  <th className={`${headCls} text-center`}>
                    <input
                      type="checkbox"
                      className="h-4 w-4 cursor-pointer accent-brand-600 align-middle"
                      checked={allSelected}
                      ref={(el) => el && (el.indeterminate = someSelected)}
                      onChange={toggleAll}
                      title={allSelected ? 'Clear selection' : 'Select all'}
                      aria-label="Select all rows"
                    />
                  </th>
                )}
                <Head />
                <SortHead k="date">Date</SortHead>
                <SortHead k="pillar">Pillar / service</SortHead>
                <SortHead k="title">Topic</SortHead>
                <Head col="platforms">Platforms</Head>
                <SortHead k="status">Status</SortHead>
                <SortHead k="approver">Approver</SortHead>
                <SortHead k="format">Format</SortHead>
                {showContent && <Head col="caption">Caption</Head>}
                {showContent && <Head col="hashtags">Hashtags</Head>}
                <Head col="pubmat">Pubmat</Head>
                <Head col="remarks">Remarks</Head>
                {showMetrics && ['Reacts', 'Comments', 'Shares', 'Reach', 'Engagement', 'Link clicks'].map((h, i) => <Head key={h} col={['reacts', 'comments', 'shares', 'reach', 'engagement', 'linkClicks'][i]}>{h}</Head>)}
                {showMetrics && <Head col="feedback">Feedback</Head>}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} style={rowH[p.id] ? { height: rowH[p.id] } : undefined} className={`border-b border-slate-100 align-top ${selected.has(p.id) ? 'bg-brand-50' : 'hover:bg-brand-50/50'} ${showArchived ? 'text-slate-500' : ''}`}>
                  {isAdmin && (
                    <td className="px-1 py-2.5 text-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 cursor-pointer accent-brand-600"
                        checked={selected.has(p.id)}
                        onChange={() => toggleOne(p.id)}
                        aria-label={`Select ${p.title}`}
                      />
                    </td>
                  )}
                  <td className="relative px-1 py-1.5">
                    <button className="cursor-pointer rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700" title="Open details" onClick={() => onOpen(p)}>
                      <Maximize2 className="h-3.5 w-3.5" />
                    </button>
                    {/* grip along the bottom edge of the whole row: drag to resize, double-click to reset */}
                    <span
                      role="separator"
                      aria-orientation="horizontal"
                      aria-label={`Resize row ${p.title}`}
                      title="Drag to resize the row · double-click to reset"
                      className="absolute -bottom-1 z-10 h-2 cursor-row-resize touch-none select-none hover:bg-brand-500/25"
                      style={{ left: isAdmin ? -widthOf('select') : 0, width: tableWidth }}
                      onPointerDown={(e) => {
                        const start = e.currentTarget.closest('tr').getBoundingClientRect().height;
                        document.body.style.cursor = 'row-resize';
                        startDrag(e, (_dx, dy) => setRowH((prev) => ({ ...prev, [p.id]: Math.round(Math.max(MIN_ROW, start + dy)) })));
                      }}
                      onDoubleClick={() => setRowH(({ [p.id]: _drop, ...rest }) => rest)}
                    />
                  </td>
                  <td className="px-1 py-1.5">
                    {ro ? (
                      <ReadText>{formatDate(p.date, { withYear: true })}</ReadText>
                    ) : (
                      <input
                        type="date"
                        className="w-full min-w-0 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-[13px] text-slate-700 outline-none hover:border-slate-200 focus:border-brand-500"
                        value={p.date || ''}
                        onChange={(e) => e.target.value && edit(p, { date: e.target.value })}
                      />
                    )}
                    {p.date && <span className="block px-2 text-[11px] text-slate-500">{DAY_LONG[new Date(`${p.date}T00:00:00Z`).getUTCDay()]}{p.time ? ` · ${p.time}` : ''}</span>}
                  </td>
                  <td className="px-1 py-1.5">
                    {ro ? (
                      <div className="flex items-start gap-1.5 px-2 py-1 text-[13px] leading-5 text-slate-700">
                        <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: pillarById[p.pillarId]?.color || '#e2e8f0' }} />
                        <span className="min-w-0 break-words">{softBreaks(pillarById[p.pillarId]?.name) || 'Uncategorized'}</span>
                      </div>
                    ) : (
                      <div className="flex items-start gap-1 pl-1">
                        <span className="mt-2.5 h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: pillarById[p.pillarId]?.color || '#e2e8f0' }} />
                        <div className="min-w-0 flex-1">
                          <SelectCell value={p.pillarId} options={pillarOpts} allowEmpty emptyLabel="Uncategorized" onSave={(v) => edit(p, { pillarId: v })} />
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="px-1 py-1.5">
                    {ro ? <ReadText strong>{p.title}</ReadText> : <TextCell value={p.title} strong onSave={(v) => v && edit(p, { title: v })} />}
                    {p.kind === 'AD' && <span className="ml-2 inline-block rounded bg-fuchsia-100 px-1.5 text-[11px] font-medium text-fuchsia-700">Ad</span>}
                  </td>
                  <td className="px-1 py-1.5">{ro ? <div className="px-2 py-1"><PlatformList placements={p.placements} /></div> : <PlacementCell value={p.placements} onSave={(v) => edit(p, { placements: v })} />}</td>
                  <td className="px-1 py-1.5">
                    {ro ? <div className="px-2 py-1"><StatusBadge status={p.status} /></div> : (
                      <div className={`rounded-md ring-1 ring-inset ${STATUS[p.status]?.cls}`}>
                        <SelectCell value={p.status} options={STATUSES} onSave={(v) => v && edit(p, { status: v })} />
                      </div>
                    )}
                  </td>
                  <td className="px-1 py-1.5">
                    {ro ? <ReadText>{p.approver?.name || p.approverName}</ReadText> : (
                      <SelectCell
                        value={p.approverId}
                        options={peopleOpts}
                        allowEmpty
                        emptyLabel={p.approverName ? `${p.approverName} (sheet)` : '—'}
                        onSave={(v) => edit(p, { approverId: v })}
                      />
                    )}
                  </td>
                  <td className="px-1 py-1.5">{ro ? <ReadText>{p.format}</ReadText> : <TextCell value={p.format} placeholder="—" onSave={(v) => edit(p, { format: v })} />}</td>
                  {showContent && (
                    <td className="px-1 py-1.5">
                      {ro ? <ReadText previewRows={linesFor(p)}>{p.caption}</ReadText> : <TextCell value={p.caption} placeholder="Caption…" maxRows={16} previewRows={linesFor(p)} onSave={(v) => edit(p, { caption: v })} />}
                    </td>
                  )}
                  {showContent && (
                    <td className="px-1 py-1.5">{ro ? <ReadText muted previewRows={linesFor(p)}>{p.hashtags}</ReadText> : <TextCell value={p.hashtags} placeholder="#…" previewRows={linesFor(p)} onSave={(v) => edit(p, { hashtags: v })} />}</td>
                  )}
                  <td className="px-2 py-2 text-[13px]">
                    {p.pubmatLinks?.filter((l) => /^https?:/.test(l)).map((l, i) => (
                      <a key={l} href={l} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-brand-600 hover:underline">
                        <ExternalLink className="h-3.5 w-3.5" /> Pubmat{p.pubmatLinks.length > 1 ? ` ${i + 1}` : ''}
                      </a>
                    ))}
                    {!p.pubmatLinks?.some((l) => /^https?:/.test(l)) && <span className="break-words text-slate-500">{p.pubmatLinks?.[0] || '—'}</span>}
                  </td>
                  <td className="px-1 py-1.5">{ro ? <ReadText muted previewRows={linesFor(p)}>{p.remarks}</ReadText> : <TextCell value={p.remarks} placeholder="—" previewRows={linesFor(p)} onSave={(v) => edit(p, { remarks: v })} />}</td>
                  {showMetrics &&
                    ['reacts', 'comments', 'shares', 'reach', 'engagement', 'linkClicks'].map((k) => (
                      <td key={k} className="px-1 py-1.5">
                        {ro ? <ReadText>{p[k] ?? null}</ReadText> : (
                          <TextCell numeric value={p[k] === null || p[k] === undefined ? '' : String(p[k])} placeholder="—" onSave={(v) => edit(p, { [k]: v === null ? null : Math.max(0, parseInt(v, 10) || 0) })} />
                        )}
                      </td>
                    ))}
                  {showMetrics && (
                    <td className="px-1 py-1.5">
                      {ro ? <ReadText>{FEEDBACK.find((f) => f.value === p.feedback)?.label}</ReadText> : <SelectCell value={p.feedback} options={FEEDBACK} allowEmpty onSave={(v) => edit(p, { feedback: v })} />}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
