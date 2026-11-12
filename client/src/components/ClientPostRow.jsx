import { formatDate } from '../lib/dates';
import { PlacementChips, StatusBadge } from './ui';

// One post in a client-side list (Overview / Approvals). The action button opens the post.
export default function ClientPostRow({ post, onOpen, action = 'Open', primary = false, note }) {
  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: post.pillar?.color || '#cbd5e1' }} title={post.pillar?.name || 'Uncategorized'} />
      <button className="min-w-0 flex-1 cursor-pointer text-left" onClick={() => onOpen(post)}>
        <span className="block truncate text-sm font-medium text-slate-800 hover:text-brand-700">
          {post.kind === 'AD' && <span className="mr-1 rounded bg-fuchsia-100 px-1 text-[10px] text-fuchsia-700">AD</span>}
          {post.title}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
          <span>{post.date ? formatDate(post.date, { withYear: true }) : 'No date yet'}</span>
          {post.pillar && <span>· {post.pillar.name}</span>}
          <PlacementChips placements={post.placements} size="xs" />
          {note && <span className="text-slate-500">· {note}</span>}
        </span>
      </button>
      {/* wrapper so the badge really hides on phones and leaves room for the title */}
      <span className="hidden sm:inline">
        <StatusBadge status={post.status} />
      </span>
      <button className={`${primary ? 'btn-primary' : 'btn-secondary'} px-3 py-1 text-xs`} onClick={() => onOpen(post)}>
        {action}
      </button>
    </li>
  );
}
