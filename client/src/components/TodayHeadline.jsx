import { Link } from 'react-router-dom';
import { ArrowRight, Sun } from 'lucide-react';
import { todayISO } from '../lib/dates';

const longDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

/**
 * "What's today": the first thing on the dashboard after signing in (FBS team and clients).
 * A big headline button into the day-by-day view; `clients` (FBS dashboard) adds one chip per
 * client posting today.
 */
export default function TodayHeadline({ to, count = 0, clients = [] }) {
  const today = todayISO();
  return (
    <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-brand-800 to-brand-700 text-white shadow-lift">
      <Link to={to} className="group flex items-center gap-4 px-5 py-5 sm:px-7 sm:py-6 focus-visible:ring-3 focus-visible:ring-white/40 focus-visible:outline-none">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 sm:h-14 sm:w-14">
          <Sun className="h-6 w-6 text-white sm:h-7 sm:w-7" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold tracking-[0.14em] text-white/80 uppercase">{longDate(today)}</span>
          <span className="block text-2xl leading-tight font-semibold tracking-tight text-white sm:text-3xl">What's today</span>
          <span className="mt-0.5 block text-sm text-white/80">
            {count ? `${count} post${count === 1 ? '' : 's'} going out today` : 'Nothing is scheduled to go out today'} · see the day post by post
          </span>
        </span>
        <span className="hidden shrink-0 items-center gap-1.5 rounded-xl bg-white/15 px-3.5 py-2 text-sm font-medium text-white ring-1 ring-white/25 transition-colors group-hover:bg-white/25 sm:flex">
          Open <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
        <ArrowRight className="h-5 w-5 shrink-0 text-white sm:hidden" />
      </Link>
      {clients.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t border-white/15 px-5 py-3 sm:px-7">
          {clients.map((c) => (
            <Link
              key={c.slug}
              to={`/c/${c.slug}?view=daily&day=${today}`}
              className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium text-white ring-1 ring-white/20 hover:bg-white/25"
            >
              {c.name} · {c.count}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
