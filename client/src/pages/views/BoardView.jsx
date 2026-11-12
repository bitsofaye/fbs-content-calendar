import { useMemo, useState } from 'react';
import { DndContext, DragOverlay, PointerSensor, pointerWithin, rectIntersection, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import { ArrowDownToLine, CalendarDays, GripVertical, MessageSquare } from 'lucide-react';
import { useBulkUpdate } from '../../api/hooks';
import { STATUS } from '../../lib/constants';
import { formatDate } from '../../lib/dates';
import { PlacementChips } from '../../components/ui';

// The six stages of a post, left to right. Each status belongs to exactly one column;
// dropping a card on a column gives it that column's main status.
export const BOARD_COLUMNS = [
  { id: 'progress', label: 'In Progress', status: 'IN_PROGRESS', color: '#0284c7', includes: ['IN_PROGRESS', 'CREATED', 'EDITED', 'ON_HOLD', 'RESCHEDULE'] },
  { id: 'approval', label: 'For Approval', status: 'FOR_APPROVAL', color: '#d97706', includes: ['FOR_APPROVAL'] },
  { id: 'approved', label: 'Approved', status: 'APPROVED', color: '#059669', includes: ['APPROVED'] },
  { id: 'edits', label: 'Needs Edit', status: 'TO_EDIT', color: '#ea580c', includes: ['TO_EDIT', 'REJECTED'] },
  { id: 'scheduled', label: 'Scheduled', status: 'SCHEDULED', color: '#0d9488', includes: ['SCHEDULED'] },
  { id: 'published', label: 'Published', status: 'PUBLISHED', color: '#921259', includes: ['PUBLISHED', 'BOOSTED'] },
];
const columnOf = (status) => BOARD_COLUMNS.find((c) => c.includes.includes(status));

// prefer the column under the pointer; fall back to the one the card overlaps most
const collision = (args) => {
  const hits = pointerWithin(args);
  return hits.length ? hits : rectIntersection(args);
};

function CardBody({ post, draggable }) {
  // the exact status, shown only when it differs from the column name (e.g. "Created" inside In Progress)
  const col = columnOf(post.status);
  const subStatus = col && post.status !== col.status ? STATUS[post.status]?.label : null;
  return (
    <>
      <div className="flex items-start gap-1.5">
        <p className="min-w-0 flex-1 font-medium break-words text-slate-800">
          {post.kind === 'AD' && <span className="mr-1.5 rounded bg-fuchsia-50 px-1.5 text-[11px] font-medium text-fuchsia-700">Ad</span>}
          {post.title}
        </p>
        {draggable && <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-slate-300 group-hover:text-slate-500" aria-hidden />}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="h-3.5 w-3.5" />
          {post.date ? formatDate(post.date) : 'No date'}
          {post.time ? ` · ${post.time}` : ''}
        </span>
        {post.pillar && (
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: post.pillar.color }} />
            <span className="truncate">{post.pillar.name}</span>
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <PlacementChips placements={post.placements} size="xs" />
        {subStatus && <span className="text-[11px] text-slate-500">{subStatus}</span>}
        {post._count?.commentList > 0 && (
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-slate-500">
            <MessageSquare className="h-3.5 w-3.5" /> {post._count.commentList}
          </span>
        )}
      </div>
    </>
  );
}

function Card({ post, onOpen, draggable }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: post.id, data: { post }, disabled: !draggable });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => onOpen(post)}
      className={`group rounded-xl border p-3 text-sm transition-colors ${
        isDragging
          ? // the card's old spot stays visible as an outline while you drag its copy
            'border-dashed border-brand-500/50 bg-brand-50/40 [&>*]:opacity-30'
          : 'cursor-pointer border-slate-200 bg-white hover:border-brand-500/40'
      } ${draggable ? 'touch-none' : ''} ${draggable && !isDragging ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      <CardBody post={post} draggable={draggable} />
    </div>
  );
}

function Column({ column, posts, onOpen, isAdmin, dragging, fromHere }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id, disabled: !isAdmin });
  const target = isOver && !fromHere;
  return (
    <section
      ref={setNodeRef}
      className={`flex min-w-[180px] flex-1 basis-0 flex-col rounded-2xl transition-all duration-150 ${
        target ? 'bg-white ring-2' : dragging && !fromHere ? 'bg-white/60 outline-2 -outline-offset-2 outline-dashed outline-slate-300' : 'bg-white/60 ring-1 ring-slate-200/80'
      }`}
      style={target ? { '--tw-ring-color': column.color, background: `color-mix(in srgb, ${column.color} 7%, white)` } : undefined}
    >
      <header className="flex items-center gap-2 px-3.5 pt-3.5 pb-2.5">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: column.color }} />
        <h3 className="text-sm font-semibold text-slate-800">{column.label}</h3>
        <span className="ml-auto rounded-full bg-slate-100 px-2 text-xs font-medium text-slate-600 tabular-nums">{posts.length}</span>
      </header>
      <div className="mx-3.5 mb-2.5 h-0.5 rounded-full" style={{ background: column.color, opacity: target ? 1 : 0.35 }} />
      <div className="flex max-h-[68vh] min-h-[120px] flex-col gap-2.5 overflow-y-auto px-2.5 pb-3">
        {/* where the card will land: a clear "drop here" slot at the top of the column */}
        {target && (
          <div className="flex items-center justify-center gap-1.5 rounded-xl border-2 border-dashed py-4 text-xs font-semibold" style={{ borderColor: column.color, color: column.color }}>
            <ArrowDownToLine className="h-4 w-4" /> Move to {column.label}
          </div>
        )}
        {posts.map((p) => <Card key={p.id} post={p} onOpen={onOpen} draggable={isAdmin} />)}
        {!posts.length && !target && <p className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-xs text-slate-400">Nothing here</p>}
      </div>
    </section>
  );
}

export default function BoardView({ posts, isAdmin, onOpen }) {
  const bulk = useBulkUpdate();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [active, setActive] = useState(null); // the post being dragged
  const [overId, setOverId] = useState(null);

  // ideas live in the Idea bank, so the board shows dated work only
  const columns = useMemo(() => {
    const m = Object.fromEntries(BOARD_COLUMNS.map((c) => [c.id, []]));
    for (const p of posts) {
      const col = columnOf(p.status);
      if (col) m[col.id].push(p);
    }
    for (const list of Object.values(m)) list.sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.time || '').localeCompare(b.time || ''));
    return m;
  }, [posts]);

  const fromCol = active ? columnOf(active.status)?.id : null;
  const overCol = BOARD_COLUMNS.find((c) => c.id === overId);

  function onDragEnd({ active: a, over }) {
    setActive(null);
    setOverId(null);
    if (!over) return;
    const post = a.data.current.post;
    const target = BOARD_COLUMNS.find((c) => c.id === over.id);
    if (!target || columnOf(post.status)?.id === target.id) return;
    bulk.mutate([{ id: post.id, data: { status: target.status } }]);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={({ active: a }) => setActive(a.data.current.post)}
      onDragOver={({ over }) => setOverId(over?.id ?? null)}
      onDragCancel={() => { setActive(null); setOverId(null); }}
      onDragEnd={onDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-2">
        {BOARD_COLUMNS.map((c) => (
          <Column key={c.id} column={c} posts={columns[c.id]} onOpen={onOpen} isAdmin={isAdmin} dragging={!!active} fromHere={fromCol === c.id} />
        ))}
      </div>

      {/* the card you are holding: lifted, slightly tilted, and labelled with where it will go */}
      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' }}>
        {active && (
          <div className="w-[240px] rotate-[1.5deg] cursor-grabbing">
            <div className="rounded-xl border border-brand-500/50 bg-white p-3 text-sm shadow-[0_18px_40px_-12px_rgba(36,22,30,0.35)] ring-1 ring-brand-500/20">
              <CardBody post={active} />
            </div>
            <div
              className="mt-1.5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white"
              style={{ background: overCol && overCol.id !== fromCol ? overCol.color : '#64748b' }}
            >
              {overCol && overCol.id !== fromCol ? `→ ${overCol.label}` : 'Drop on a column'}
            </div>
          </div>
        )}
      </DragOverlay>

      {isAdmin && <p className="mt-2 text-xs text-slate-500">Drag a card to another column to change its stage. Open a card for the exact status.</p>}
    </DndContext>
  );
}
