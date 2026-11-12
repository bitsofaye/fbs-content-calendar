import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, X } from 'lucide-react';
import { PLACEMENT, STATUS } from '../lib/constants';

export function Spinner({ className = 'h-5 w-5' }) {
  return <Loader2 className={`animate-spin text-slate-500 ${className}`} />;
}

export function FullPageSpinner() {
  return (
    <div className="flex h-full items-center justify-center">
      <Spinner className="h-8 w-8" />
    </div>
  );
}

export function StatusBadge({ status, className = '' }) {
  const s = STATUS[status] || { label: status, cls: 'bg-slate-100 text-slate-600 ring-slate-300' };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ring-1 ring-inset ${s.cls} ${className}`}>
      {s.label}
    </span>
  );
}

export function StatusDot({ status, className = '' }) {
  return <span title={STATUS[status]?.label} className={`inline-block h-2 w-2 shrink-0 rounded-full ${className}`} style={{ background: STATUS[status]?.dot }} />;
}

export function PlacementChips({ placements = [], size = 'sm' }) {
  if (!placements?.length) return null;
  return (
    <span className="inline-flex flex-wrap gap-0.5">
      {placements.map((p) => (
        <span
          key={p}
          title={PLACEMENT[p]?.label}
          className={`rounded font-semibold ${size === 'xs' ? 'px-1 text-[10px] leading-[15px]' : 'px-1.5 py-px text-[11px]'}`}
          style={platformStyle(PLACEMENT[p]?.color)}
        >
          {PLACEMENT[p]?.short || p}
        </span>
      ))}
    </span>
  );
}

// The platform color at 60% strength, with whichever text color (dark or white) reads better on it
export function platformStyle(hex) {
  const h = (hex || '#64748b').replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mix = (c) => Math.round(c * 0.6 + 255 * 0.4); // 60% color over white
  const [mr, mg, mb] = [mix(r), mix(g), mix(b)];
  const lum = (0.2126 * mr + 0.7152 * mg + 0.0722 * mb) / 255;
  return { background: `rgb(${mr} ${mg} ${mb})`, color: lum > 0.55 ? '#24161e' : '#ffffff' };
}

// Full platform names, one per line, e.g. for the Content plan
export function PlatformList({ placements = [] }) {
  if (!placements?.length) return <span className="text-xs text-slate-400">—</span>;
  return (
    <ul className="flex flex-col items-start gap-1">
      {placements.map((p) => (
        <li key={p} className="rounded-md px-2 py-0.5 text-[11px] leading-4 font-medium whitespace-nowrap" style={platformStyle(PLACEMENT[p]?.color)}>
          {PLACEMENT[p]?.label || p}
        </li>
      ))}
    </ul>
  );
}

export function PillarTag({ pillar }) {
  if (!pillar) return <span className="text-xs text-slate-500">Uncategorized</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
      <span className="h-2.5 w-2.5 shrink-0 rounded-sm ring-1 ring-black/10" style={{ background: pillar.color }} />
      <span className="truncate">{pillar.name}</span>
    </span>
  );
}

export function Modal({ open, onClose, title, children, footer, wide = false }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-[8vh]" onMouseDown={onClose}>
      <div className={`card w-full ${wide ? 'max-w-3xl' : 'max-w-lg'}`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="font-semibold text-brand-700">{title}</h2>
          <button className="btn-ghost p-1" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      {Icon && <Icon className="h-8 w-8 text-slate-300" />}
      <p className="font-medium text-slate-600">{title}</p>
      {children && <div className="max-w-md text-sm text-slate-500">{children}</div>}
    </div>
  );
}

const TONES = {
  slate: 'bg-slate-100 text-slate-500',
  amber: 'bg-amber-50 text-amber-600',
  green: 'bg-emerald-50 text-emerald-600',
  orange: 'bg-orange-50 text-orange-600',
  brand: 'bg-brand-100 text-brand-600',
};

// A headline number. `solid` = the hero tile (burgundy → magenta). `to` makes the whole tile a link.
export function KpiTile({ label, value, hint, icon: Icon, tone = 'slate', solid = false, to }) {
  const body = (
    <div
      className={`card relative h-full overflow-hidden px-4 py-3.5 sm:px-5 sm:py-4 ${solid ? 'border-transparent! bg-gradient-to-br! from-brand-700 to-brand-600 text-white' : ''}`}
    >
      {solid && <span aria-hidden className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-white/10" />}
      <div className="relative flex items-start justify-between gap-2">
        <span className={`text-xs font-medium ${solid ? 'text-white/85' : 'text-slate-500'}`}>{label}</span>
        {Icon && (
          <span className={`hidden h-8 w-8 shrink-0 items-center justify-center rounded-full sm:flex ${solid ? 'bg-white/15 text-white' : TONES[tone]}`}>
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <div className={`relative mt-1 text-2xl sm:-mt-1 leading-tight font-semibold sm:text-[28px] tracking-tight tabular-nums ${solid ? 'text-white' : 'text-slate-800'}`}>{value ?? '—'}</div>
      <div className={`relative mt-0.5 flex items-center gap-1 text-xs ${solid ? 'text-white/80' : 'text-slate-500'}`}>
        {hint && <span>{hint}</span>}
        {to && <span className={`ml-auto hidden font-medium whitespace-nowrap sm:inline ${solid ? 'text-white' : 'text-brand-600'}`}>View →</span>}
      </div>
    </div>
  );
  return to ? (
    <Link to={to} className="card-link">
      {body}
    </Link>
  ) : (
    body
  );
}

// Page heading used across the app: optional small label above, title, one-line description
export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
        <h1 className="page-title">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export const fmtNumber = (n) => (n === null || n === undefined ? '—' : Number(n).toLocaleString());
