import { useMemo, useState } from 'react';
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import { Lightbulb, MessageSquare, PanelRightClose, PanelRightOpen, Plus } from 'lucide-react';
import { useBulkUpdate } from '../../api/hooks';
import { WEEKDAYS } from '../../lib/constants';
import { monthGrid, todayISO, weekday, weekOf } from '../../lib/dates';
import { PH_HOLIDAYS } from '../../lib/holidays';
import { PlacementChips, StatusDot } from '../../components/ui';

function tint(hex, alpha = 0.18) {
  const h = (hex || '#94a3b8').replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function PostChip({ post, onOpen, draggable, compact }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: post.id, data: { post }, disabled: !draggable });
  const color = post.pillar?.color || '#94a3b8';
  const style = {
    background: tint(color),
    borderLeftColor: color,
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.85 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation();
        onOpen(post);
      }}
      title={`${post.title}${post.pillar ? ` · ${post.pillar.name}` : ''}`}
      className={`group cursor-pointer rounded border-l-[3px] px-1.5 py-1 text-[11px] leading-tight text-slate-800 shadow-xs hover:ring-1 hover:ring-slate-300 ${draggable ? 'touch-none' : ''} ${isDragging ? 'shadow-lg' : ''}`}
    >
      <div className="flex items-start gap-1">
        <StatusDot status={post.status} className="mt-[3px]" />
        <span className={`min-w-0 flex-1 ${compact ? 'line-clamp-2' : 'line-clamp-3'}`}>
          {post.kind === 'AD' && <b className="text-fuchsia-700">AD · </b>}
          {post.time && <span className="text-slate-500">{post.time} </span>}
          {post.title}
        </span>
      </div>
      {!compact && (
        <div className="mt-0.5 flex items-center gap-1 pl-3">
          <PlacementChips placements={post.placements} size="xs" />
          {post._count?.commentList > 0 && (
            <span className="ml-auto inline-flex items-center gap-0.5 text-[10px] text-slate-500">
              <MessageSquare className="h-2.5 w-2.5" />
              {post._count.commentList}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function DayCell({ date, inMonth, posts, onOpen, onCreate, isAdmin, canCreate, tall, weekdayPillar }) {
  const { setNodeRef, isOver } = useDroppable({ id: date, disabled: !isAdmin });
  const isToday = date === todayISO();
  const holiday = PH_HOLIDAYS[date];
  const dayNum = Number(date.slice(8));
  return (
    <div
      ref={setNodeRef}
      onDoubleClick={() => canCreate && onCreate({ date, pillarId: weekdayPillar?.id })}
      className={`group relative flex flex-col gap-1 border-r border-b border-slate-200 p-1.5 ${tall ? 'min-h-[420px]' : 'min-h-[120px]'} ${
        inMonth ? 'bg-white' : 'bg-slate-50/70'
      } ${isOver ? 'bg-brand-50 ring-2 ring-brand-500 ring-inset' : ''}`}
    >
      <div className="flex items-center gap-1">
        <span
          className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-semibold ${
            isToday ? 'bg-brand-600 text-white' : inMonth ? 'text-slate-700' : 'text-slate-500'
          }`}
        >
          {dayNum}
        </span>
        {holiday && <span className="truncate rounded bg-rose-50 px-1 text-[10px] font-medium text-rose-700" title={holiday}>{holiday}</span>}
        {canCreate && (
          <button
            className="ml-auto cursor-pointer rounded p-0.5 text-slate-500 opacity-0 group-hover:opacity-100 hover:bg-slate-100 hover:text-slate-700 focus:opacity-100 [@media(hover:none)]:opacity-100"
            title="Add post on this day"
            onClick={() => onCreate({ date, pillarId: weekdayPillar?.id })}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="flex flex-col gap-1">
        {posts.map((p) => (
          <PostChip key={p.id} post={p} onOpen={onOpen} draggable={isAdmin} compact={!tall && posts.length > 3} />
        ))}
      </div>
    </div>
  );
}

function IdeaPanel({ ideas, onOpen, isAdmin, onClose }) {
  const { setNodeRef, isOver } = useDroppable({ id: '__ideas__', disabled: !isAdmin });
  return (
    <div ref={setNodeRef} className={`card flex w-64 shrink-0 flex-col ${isOver ? 'ring-2 ring-brand-500' : ''}`}>
      <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2">
        <Lightbulb className="h-4 w-4 text-amber-500" />
        <span className="text-sm font-medium">Idea bank</span>
        <span className="text-xs text-slate-500">{ideas.length}</span>
        <button className="btn-ghost ml-auto p-1" onClick={onClose} title="Hide"><PanelRightClose className="h-4 w-4" /></button>
      </div>
      <p className="px-3 pt-2 text-[11px] text-slate-500">{isAdmin ? 'Drag an idea onto a day to schedule it. Drag a post here to unschedule it.' : 'Ideas not scheduled yet.'}</p>
      <div className="flex max-h-[70vh] flex-col gap-1 overflow-y-auto p-2">
        {ideas.map((p) => <PostChip key={p.id} post={p} onOpen={onOpen} draggable={isAdmin} compact />)}
        {!ideas.length && <p className="px-1 py-4 text-center text-xs text-slate-500">No ideas yet</p>}
      </div>
    </div>
  );
}

// Phones: a simple day-by-day list instead of a 7-column grid that needs sideways scrolling
function Agenda({ weeks, month, mode, byDate, onOpen, onCreate, canCreate, weekdayPillars }) {
  const today = todayISO();
  const days = weeks.flat().filter((d) => mode === 'week' || d.startsWith(month));
  const shown = days.filter((d) => byDate[d]?.length || d === today);
  if (!shown.length)
    return (
      <div className="card px-4 py-8 text-center text-sm text-slate-500">
        Nothing planned in this {mode === 'week' ? 'week' : 'month'} yet.
        {canCreate && (
          <div className="mt-3">
            <button className="btn-primary" onClick={() => onCreate({ date: days.includes(today) ? today : days[0] })}>
              <Plus className="h-4 w-4" /> Add post
            </button>
          </div>
        )}
      </div>
    );
  return (
    <div className="space-y-3">
      {shown.map((d) => {
        const list = byDate[d] || [];
        return (
          <section key={d} className="card overflow-hidden">
            <header className={`flex items-center gap-2 border-b border-slate-100 px-3 py-2 ${d === today ? 'bg-brand-50' : ''}`}>
              <span className={`text-sm font-semibold ${d === today ? 'text-brand-700' : 'text-slate-700'}`}>
                {WEEKDAYS[weekday(d)].slice(0, 3)}, {Number(d.slice(8))}
                {d === today && <span className="ml-1.5 text-xs font-medium">· Today</span>}
              </span>
              {PH_HOLIDAYS[d] && <span className="truncate rounded bg-rose-50 px-1.5 text-[10px] font-medium text-rose-700">{PH_HOLIDAYS[d]}</span>}
              {canCreate && (
                <button className="btn-ghost ml-auto px-2 py-1 text-xs" onClick={() => onCreate({ date: d, pillarId: weekdayPillars[weekday(d)]?.id })}>
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
              )}
            </header>
            {list.length ? (
              <ul className="divide-y divide-slate-100">
                {list.map((p) => (
                  <li key={p.id}>
                    <button className="flex w-full cursor-pointer items-start gap-2 px-3 py-2.5 text-left hover:bg-slate-50" onClick={() => onOpen(p)}>
                      <span className="mt-1 h-3 w-1 shrink-0 rounded-full" style={{ background: p.pillar?.color || '#cbd5e1' }} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-slate-800">
                          {p.kind === 'AD' && <b className="text-fuchsia-700">AD · </b>}
                          {p.title}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-2">
                          <StatusDot status={p.status} />
                          <span className="text-xs text-slate-500">{p.pillar?.name || 'Uncategorized'}</span>
                          <PlacementChips placements={p.placements} size="xs" />
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-3 py-3 text-xs text-slate-500">Nothing planned today.</p>
            )}
          </section>
        );
      })}
    </div>
  );
}

export default function CalendarView({ client, posts, ideas, month, day, isAdmin, canCreate, onOpen, onCreate, mode }) {
  const bulk = useBulkUpdate();
  const [showIdeas, setShowIdeas] = useState(isAdmin);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const weeks = mode === 'week' ? [weekOf(day)] : monthGrid(month).weeks;

  const byDate = useMemo(() => {
    const m = {};
    for (const p of posts) (m[p.date] ||= []).push(p);
    return m;
  }, [posts]);

  const weekdayPillars = useMemo(() => {
    const m = {};
    for (const p of client.pillars || []) if (p.weekday !== null && p.weekday !== undefined && p.active) m[p.weekday] = p;
    return m;
  }, [client.pillars]);

  const legend = (client.pillars || []).filter((p) => p.active && posts.some((x) => x.pillarId === p.id));

  function onDragEnd({ active, over }) {
    if (!over) return;
    const post = active.data.current.post;
    if (over.id === '__ideas__') {
      if (post.date) bulk.mutate([{ id: post.id, data: { date: null, status: 'IDEA' } }]);
      return;
    }
    if (over.id === post.date) return;
    bulk.mutate([{ id: post.id, data: { date: over.id, ...(post.status === 'IDEA' ? { status: 'IN_PROGRESS' } : {}) } }]);
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="sm:hidden">
        <Agenda weeks={weeks} month={month} mode={mode} byDate={byDate} onOpen={onOpen} onCreate={onCreate} canCreate={canCreate} weekdayPillars={weekdayPillars} />
      </div>
      <div className="hidden sm:block">
      {legend.length > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
          <span className="font-semibold tracking-wide text-slate-500 uppercase">Key:</span>
          {legend.map((p) => (
            <span key={p.id} className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm ring-1 ring-black/10" style={{ background: p.color }} />
              {p.name}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-start gap-3">
        <div className="card min-w-0 flex-1 overflow-x-auto">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-[11px] font-semibold tracking-wide text-slate-600 uppercase">
              {WEEKDAYS.map((w, i) => (
                <div key={w} className="border-r border-slate-200 px-2 py-2 last:border-r-0">
                  {w}
                  {weekdayPillars[i] && (
                    <span className="mt-0.5 flex items-center gap-1 text-[10px] font-medium tracking-normal text-slate-500 normal-case">
                      <span className="h-2 w-2 rounded-sm" style={{ background: weekdayPillars[i].color }} />
                      <span className="truncate">{weekdayPillars[i].name}</span>
                    </span>
                  )}
                </div>
              ))}
            </div>
            {weeks.map((week) => (
              <div key={week[0]} className="grid grid-cols-7 [&>*:nth-child(7n)]:border-r-0">
                {week.map((date) => (
                  <DayCell
                    key={date}
                    date={date}
                    inMonth={mode === 'week' || date.startsWith(month)}
                    posts={byDate[date] || []}
                    onOpen={onOpen}
                    onCreate={onCreate}
                    isAdmin={isAdmin}
                    canCreate={canCreate}
                    tall={mode === 'week'}
                    weekdayPillar={weekdayPillars[weekday(date)]}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
        {showIdeas ? (
          <div className="hidden lg:block">
            <IdeaPanel ideas={ideas} onOpen={onOpen} isAdmin={isAdmin} onClose={() => setShowIdeas(false)} />
          </div>
        ) : (
          <button className="btn-secondary hidden px-2 lg:inline-flex" onClick={() => setShowIdeas(true)} title="Show idea bank">
            <PanelRightOpen className="h-4 w-4" />
          </button>
        )}
      </div>
      {canCreate && (
        <p className="mt-2 text-xs text-slate-500">
          {isAdmin ? 'Tip: drag a post to another day to reschedule. ' : ''}Use + on a day (or double-click it) to add a post.
        </p>
      )}
      </div>
    </DndContext>
  );
}
