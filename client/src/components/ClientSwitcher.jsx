import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Star } from 'lucide-react';
import { useClients } from '../api/hooks';
import { useAuth } from '../context/AuthContext';
import { usePins } from '../lib/pins';

// "Jump to client": search every client by name or industry, pin favourites.
// Opens with Ctrl+K (⌘K on Mac), the sidebar's "All clients" button, or the client name in a dashboard header.
export default function ClientSwitcher({ open, onClose }) {
  const { user } = useAuth();
  const { data: clients = [] } = useClients();
  const { isPinned, toggle } = usePins(user?.id);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQ('');
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const found = clients.filter((c) => !s || c.name.toLowerCase().includes(s) || (c.industry || '').toLowerCase().includes(s));
    return [...found].sort((a, b) => Number(isPinned(b.id)) - Number(isPinned(a.id)) || a.name.localeCompare(b.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients, q, isPinned]);

  if (!open) return null;

  const go = (c) => {
    if (!c) return;
    onClose();
    navigate(`/c/${c.slug}`);
  };

  const onKey = (e) => {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, list.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') go(list[active]);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-slate-900/40 p-4 pt-[10vh]" onMouseDown={onClose}>
      <div className="card w-full max-w-lg overflow-hidden" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label="Jump to client">
        <div className="flex items-center gap-2 border-b border-slate-200 px-4">
          <Search className="h-4 w-4 text-slate-500" />
          <input
            ref={inputRef}
            className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-slate-400"
            placeholder="Search clients by name or industry…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKey}
          />
          <kbd className="rounded border border-slate-200 px-1.5 text-[10px] text-slate-500">Esc</kbd>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto py-1">
          {list.map((c, i) => (
            <li key={c.id}>
              <div
                className={`flex cursor-pointer items-center gap-3 px-4 py-2 ${i === active ? 'bg-brand-100' : 'hover:bg-slate-50'}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(c)}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.brandColor }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-800">{c.name}</span>
                  {c.industry && <span className="block truncate text-xs text-slate-500">{c.industry}</span>}
                </span>
                <button
                  className={`cursor-pointer rounded p-1 ${isPinned(c.id) ? 'text-brand-600' : 'text-slate-300 hover:text-slate-700'}`}
                  title={isPinned(c.id) ? 'Unpin from sidebar' : 'Pin to sidebar'}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(c.id);
                  }}
                >
                  <Star className="h-4 w-4" fill={isPinned(c.id) ? 'currentColor' : 'none'} />
                </button>
              </div>
            </li>
          ))}
          {!list.length && <li className="px-4 py-6 text-center text-sm text-slate-500">No client matches “{q}”.</li>}
        </ul>
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-2 text-[11px] text-slate-500">
          <span>↑ ↓ to move · Enter to open</span>
          <span>☆ pins a client to the sidebar</span>
        </div>
      </div>
    </div>
  );
}
