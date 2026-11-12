import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Save, Trash2 } from 'lucide-react';
import { useAdminMutation, useClients, usePillars, useThemes } from '../../api/hooks';
import { api } from '../../lib/api';
import { WEEKDAYS } from '../../lib/constants';
import { monthName } from '../../lib/dates';
import { Spinner } from '../../components/ui';

const PILLAR_KEYS = ['pillars', 'client', 'posts', 'dashboard'];

function PillarRow({ pillar }) {
  const [f, setF] = useState(pillar);
  useEffect(() => setF(pillar), [pillar]);
  const save = useAdminMutation((body) => api.patch(`/pillars/${pillar.id}`, body), PILLAR_KEYS, 'Pillar saved');
  const del = useAdminMutation(() => api.delete(`/pillars/${pillar.id}`), PILLAR_KEYS, 'Pillar deleted');
  const dirty = f.name !== pillar.name || f.color !== pillar.color || f.weekday !== pillar.weekday || f.active !== pillar.active || f.sortOrder !== pillar.sortOrder;
  return (
    <tr className={f.active ? '' : 'opacity-50'}>
      <td className="px-3 py-1.5">
        <input type="color" className="h-8 w-10 cursor-pointer rounded border border-slate-300" value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} />
      </td>
      <td className="px-3 py-1.5"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></td>
      <td className="px-3 py-1.5">
        <select className="input" value={f.weekday ?? ''} onChange={(e) => setF({ ...f, weekday: e.target.value === '' ? null : Number(e.target.value) })}>
          <option value="">— any day —</option>
          {WEEKDAYS.map((w, i) => <option key={w} value={i}>{w}</option>)}
        </select>
      </td>
      <td className="px-3 py-1.5"><input type="number" className="input w-20" value={f.sortOrder} onChange={(e) => setF({ ...f, sortOrder: Number(e.target.value) })} /></td>
      <td className="px-3 py-1.5 text-center"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /></td>
      <td className="px-3 py-1.5 text-right text-xs text-slate-500 tabular-nums">{pillar._count?.posts ?? 0}</td>
      <td className="px-3 py-1.5">
        <div className="flex justify-end gap-1">
          {dirty && <span className="self-center text-[11px] text-amber-700">unsaved</span>}
          <button className="btn-primary px-2 py-1" title="Save this pillar" disabled={!dirty || save.isPending} onClick={() => save.mutate({ name: f.name, color: f.color, weekday: f.weekday, sortOrder: f.sortOrder, active: f.active })}>
            <Save className="h-3.5 w-3.5" />
          </button>
          <button
            className="btn-ghost px-2 text-red-600"
            onClick={() => confirm(`Delete pillar "${pillar.name}"? ${pillar._count?.posts || 0} posts become uncategorized.`) && del.mutate()}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function ThemeRow({ clientId, year, month, theme }) {
  const [title, setTitle] = useState(theme?.title || '');
  const [weeks, setWeeks] = useState(() => [1, 2, 3, 4, 5].map((w) => theme?.weeklyFocus?.find((x) => x.week === w)?.focus || ''));
  const [notes, setNotes] = useState(theme?.notes || '');
  const [open, setOpen] = useState(false);
  const save = useAdminMutation((body) => api.put('/themes', body), ['themes'], 'Theme saved');
  const del = useAdminMutation(() => api.delete(`/themes/${theme.id}`), ['themes'], 'Theme removed');
  return (
    <div className="border-b border-slate-100 py-2 last:border-0">
      <div className="flex items-center gap-3">
        <span className="w-24 shrink-0 text-sm font-medium text-slate-600">{monthName(month)}</span>
        <input className="input" placeholder="Monthly theme, e.g. Business Preparedness & Efficiency" value={title} onChange={(e) => setTitle(e.target.value)} onFocus={() => setOpen(true)} />
        <button
          className="btn-primary px-2.5"
          disabled={!title.trim() || save.isPending}
          onClick={() =>
            save.mutate({
              clientId, year, month, title, notes: notes || null,
              weeklyFocus: weeks.map((focus, i) => ({ week: i + 1, focus })).filter((w) => w.focus.trim()),
            })
          }
        >
          <Save className="h-4 w-4" />
        </button>
        {theme && <button className="btn-ghost px-2 text-red-600" title="Remove theme" onClick={() => confirm(`Remove the ${monthName(month)} theme?`) && del.mutate()}><Trash2 className="h-4 w-4" /></button>}
      </div>
      {open && (
        <div className="mt-2 ml-27 grid gap-2 sm:grid-cols-2">
          {weeks.map((w, i) => (
            <input key={i} className="input text-xs" placeholder={`Week ${i + 1} focus`} value={w} onChange={(e) => setWeeks((ws) => ws.map((x, j) => (j === i ? e.target.value : x)))} />
          ))}
          <input className="input text-xs sm:col-span-2" placeholder="Notes (format rotation, reminders…)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      )}
    </div>
  );
}

export default function PillarsPage() {
  const { data: clients = [] } = useClients();
  // the chosen client lives in the URL (?client=slug) so it survives refreshes and can be linked to
  const [sp, setSp] = useSearchParams();
  const clientId = clients.find((c) => c.slug === sp.get('client'))?.id || '';
  const setClientId = (id) => setSp({ client: clients.find((c) => c.id === id)?.slug || '' }, { replace: true });
  const [year, setYear] = useState(new Date().getFullYear());
  const cid = clientId || clients[0]?.id;
  const { data: pillars, isLoading } = usePillars(cid);
  const { data: themes = [], isFetching: themesLoading } = useThemes(cid, year);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#3b82f6');
  const add = useAdminMutation((body) => api.post('/pillars', body), PILLAR_KEYS, 'Pillar added');

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="page-title">Pillars & monthly themes</h1>
        <select className="input ml-auto w-auto" value={cid || ''} onChange={(e) => setClientId(e.target.value)}>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <section className="card overflow-x-auto">
        <div className="border-b border-slate-100 px-5 py-3.5">
          <h2 className="font-semibold text-brand-700">Content pillars</h2>
          <p className="text-xs text-slate-500">
            The color key of the calendar. Give a pillar a weekday (e.g. Motivational Monday) to show it in the calendar header and to use “Generate month”.
          </p>
        </div>
        {isLoading ? (
          <div className="flex justify-center p-6"><Spinner /></div>
        ) : (
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-left text-xs text-slate-500 uppercase">
              <tr>
                <th className="px-3 py-2">Color</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Weekday slot</th>
                <th className="px-3 py-2">Order</th>
                <th className="px-3 py-2 text-center">Active</th>
                <th className="px-3 py-2 text-right">Posts</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pillars?.map((p) => <PillarRow key={p.id} pillar={p} />)}
              <tr className="bg-slate-50/60">
                <td className="px-3 py-2"><input type="color" className="h-8 w-10 cursor-pointer rounded border border-slate-300" value={newColor} onChange={(e) => setNewColor(e.target.value)} /></td>
                <td className="px-3 py-2" colSpan={5}><input className="input" placeholder="New pillar name" value={newName} onChange={(e) => setNewName(e.target.value)} /></td>
                <td className="px-3 py-2 text-right">
                  <button
                    className="btn-primary px-2.5"
                    disabled={!newName.trim() || add.isPending}
                    onClick={async () => {
                      await add.mutateAsync({ clientId: cid, name: newName.trim(), color: newColor, sortOrder: (pillars?.length || 0) + 1 });
                      setNewName('');
                    }}
                  >
                    <Plus className="h-4 w-4" /> Add
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </section>

      <section className="card">
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-3.5">
          <div>
            <h2 className="font-semibold text-brand-700">Monthly themes</h2>
            <p className="text-xs text-slate-500">Shown as a banner above the calendar for that month, with the weekly focus topics.</p>
          </div>
          <select className="input ml-auto w-auto" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[year - 1, year, year + 1].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="px-4 py-2">
          {themesLoading && !themes.length ? (
            <div className="flex justify-center p-6"><Spinner /></div>
          ) : (
            Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <ThemeRow key={`${cid}-${year}-${m}-${themes.find((t) => t.month === m)?.id || 'new'}`} clientId={cid} year={year} month={m} theme={themes.find((t) => t.month === m)} />
            ))
          )}
        </div>
      </section>
    </div>
  );
}
