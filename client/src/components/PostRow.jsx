import { Link } from 'react-router-dom';
import { formatDate } from '../lib/dates';
import { PillarTag, PlacementChips, StatusBadge } from './ui';

// One post in a cross-client list (Approvals page). Clicking opens it in its client's calendar.
export default function PostRow({ post, today }) {
  const late = post.date && today && post.date < today && ['FOR_APPROVAL', 'TO_EDIT', 'REJECTED'].includes(post.status);
  return (
    <li>
      <Link to={`/c/${post.client.slug}?month=${post.date ? post.date.slice(0, 7) : ''}&post=${post.id}`} className="flex items-start gap-3 px-4 py-2.5 hover:bg-slate-50">
        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: post.client.brandColor }} title={post.client.name} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-800">{post.title}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
            <span className="font-medium text-slate-600">{post.client.name}</span>
            <span className={late ? 'font-medium text-red-600' : ''}>· {post.date ? formatDate(post.date) : 'No date'}{late ? ' (past date)' : ''}</span>
            <PillarTag pillar={post.pillar} />
            <PlacementChips placements={post.placements} size="xs" />
          </div>
        </div>
        <StatusBadge status={post.status} />
      </Link>
    </li>
  );
}
