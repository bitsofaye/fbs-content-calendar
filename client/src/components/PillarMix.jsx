// A thin stacked bar showing how this month's posts spread across the content pillars
export default function PillarMix({ mix, total, title = 'Pillar mix this month' }) {
  if (!total) return null;
  return (
    <div className="card px-4 py-3">
      <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-500">
        <span>{title}</span>
        <span className="tabular-nums">{total} posts</span>
      </div>
      <div className="flex h-3 gap-[2px] overflow-hidden rounded" role="img" aria-label="Posts per pillar">
        {mix.map((m) => (
          <div key={m.name} title={`${m.name}: ${m.count}`} className="h-full first:rounded-l last:rounded-r" style={{ width: `${(m.count / total) * 100}%`, background: m.color, minWidth: 3 }} />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {mix.map((m) => (
          <li key={m.name} className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="h-2.5 w-2.5 rounded-sm ring-1 ring-black/10" style={{ background: m.color }} />
            {m.name} <span className="text-slate-500 tabular-nums">{m.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
