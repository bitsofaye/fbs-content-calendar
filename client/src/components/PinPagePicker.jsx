import { CALENDAR_PAGES } from '../lib/pins';

// "Opens on: <page>" — which page of a client's calendar its sidebar pin opens.
// It can be set before pinning (the pin then opens there) or changed any time after.
export default function PinPagePicker({ client, pageOf, setPage, className = '' }) {
  return (
    <select
      className={`max-w-[118px] cursor-pointer rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] text-slate-600 outline-none hover:border-slate-300 focus:border-brand-500 ${className}`}
      value={pageOf(client.id)}
      title="Page the sidebar pin opens"
      aria-label={`Page ${client.name}'s sidebar pin opens`}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      onChange={(e) => setPage(client.id, e.target.value)}
    >
      {CALENDAR_PAGES.map((p) => (
        <option key={p.id} value={p.id}>
          {p.label}
        </option>
      ))}
    </select>
  );
}
