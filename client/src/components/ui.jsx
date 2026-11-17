import { useEffect, useState } from 'react';
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
  // pick dark or white text by real contrast (WCAG), so every chip stays readable
  const lin = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * lin(mr) + 0.7152 * lin(mg) + 0.0722 * lin(mb);
  const vsWhite = 1.05 / (L + 0.05);
  const vsDark = (L + 0.05) / (0.0105 + 0.05); // #24161e
  return { background: `rgb(${mr} ${mg} ${mb})`, color: vsDark >= vsWhite ? '#24161e' : '#ffffff' };
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

/** A client's two brand colours as one dot (left half main colour, right half second colour). */
export function BrandDot({ client, className = 'h-2.5 w-2.5' }) {
  const a = client?.brandColor || '#cbd5e1';
  const b = client?.secondaryColor || a;
  return <span className={`inline-block shrink-0 rounded-full ${className}`} style={{ background: `linear-gradient(90deg, ${a} 50%, ${b} 50%)` }} />;
}

/** A client's logo; their brand-colour dot when there is no logo or it fails to load. */
export function ClientMark({ client, size = 'h-5 w-5' }) {
  const [broken, setBroken] = useState(false);
  const src = client?.logoUrl;
  useEffect(() => setBroken(false), [src]);
  if (src && !broken) {
    return (
      <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-[#fff] ring-1 ring-slate-200 ${size}`}>
        <img src={src} alt="" className="h-full w-full object-contain" loading="lazy" onError={() => setBroken(true)} />
      </span>
    );
  }
  return (
    <span className={`flex shrink-0 items-center justify-center ${size}`}>
      <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#fff] ring-1 ring-slate-200">
        <BrandDot client={client} className="h-2 w-2" />
      </span>
    </span>
  );
}

/** A pillar's mark: its emoji when it has one, otherwise its colour dot (`className` sizes the dot). */
export function PillarDot({ pillar, className = 'h-2.5 w-2.5 rounded-sm', fallback = '#cbd5e1', emojiClass = 'text-[13px]' }) {
  if (pillar?.icon) {
    return (
      <span className={`inline-flex shrink-0 items-center justify-center leading-none ${emojiClass}`} aria-hidden title={pillar.name}>
        {pillar.icon}
      </span>
    );
  }
  return <span className={`shrink-0 ${className}`} style={{ background: pillar?.color || fallback }} />;
}

export function PillarTag({ pillar }) {
  if (!pillar) return <span className="text-xs text-slate-500">Uncategorized</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
      <PillarDot pillar={pillar} className="h-2.5 w-2.5 rounded-sm ring-1 ring-black/10" />
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
      className={`card relative h-full overflow-hidden px-4 py-3.5 sm:px-5 sm:py-4 ${solid ? 'border-brand-200! bg-gradient-to-br! from-brand-100 to-white' : ''}`}
    >
      {solid && <span aria-hidden className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-white/60" />}
      <div className="relative flex items-start justify-between gap-2">
        <span className={`text-xs ${solid ? 'font-semibold' : 'font-medium'} text-brand-700`}>{label}</span>
        {Icon && (
          <span className={`hidden h-8 w-8 shrink-0 items-center justify-center rounded-full sm:flex ${solid ? 'bg-white text-brand-700 ring-1 ring-brand-200' : TONES[tone]}`}>
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <div className={`relative mt-1 text-2xl sm:-mt-1 leading-tight font-semibold sm:text-[28px] tracking-tight tabular-nums text-brand-700`}>{value ?? '—'}</div>
      <div className={`relative mt-0.5 flex items-center gap-1 text-xs text-brand-700`}>
        {hint && <span>{hint}</span>}
        {to && <span className={`ml-auto hidden font-medium whitespace-nowrap sm:inline text-brand-700`}>View →</span>}
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
