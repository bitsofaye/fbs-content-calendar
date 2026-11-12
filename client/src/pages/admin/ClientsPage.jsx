import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Archive, ArchiveRestore, ExternalLink, Pencil, Plus, Search } from 'lucide-react';
import { useAdminMutation, useClients } from '../../api/hooks';
import { api } from '../../lib/api';
import { FullPageSpinner, Modal } from '../../components/ui';

const blank = { name: '', slug: '', brandColor: '#921259', industry: '', logoUrl: '', withDefaultPillars: true };

function ClientForm({ initial, onClose }) {
  const [f, setF] = useState(initial || blank);
  const isNew = !initial?.id;
  const save = useAdminMutation(
    async (body) => (isNew ? api.post('/clients', body) : api.patch(`/clients/${initial.id}`, body)),
    ['clients', 'client', 'overview'],
    isNew ? 'Client added' : 'Client updated',
  );
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    const body = { name: f.name, brandColor: f.brandColor, industry: f.industry || null, logoUrl: f.logoUrl || '' };
    if (f.slug) body.slug = f.slug;
    if (isNew) body.withDefaultPillars = f.withDefaultPillars;
    await save.mutateAsync(body);
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? 'Add client' : `Edit ${initial.name}`}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" form="client-form" disabled={save.isPending || !f.name.trim()}>{save.isPending ? 'Saving…' : 'Save'}</button>
        </>
      }
    >
      <form id="client-form" onSubmit={submit} className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="label">Client name *</label>
          <input className="input" value={f.name} onChange={set('name')} required autoFocus />
        </div>
        <div>
          <label className="label">URL name (slug)</label>
          <input className="input" value={f.slug} onChange={set('slug')} placeholder="auto from name" pattern="[a-z0-9-]+" />
        </div>
        <div>
          <label className="label">Brand color</label>
          <div className="flex gap-2">
            <input type="color" className="h-[34px] w-12 cursor-pointer rounded border border-slate-300" value={f.brandColor} onChange={set('brandColor')} />
            <input className="input" value={f.brandColor} onChange={set('brandColor')} />
          </div>
        </div>
        <div>
          <label className="label">Industry</label>
          <input className="input" value={f.industry || ''} onChange={set('industry')} placeholder="e.g. Resort, Restaurant" />
        </div>
        <div>
          <label className="label">Logo URL</label>
          <input className="input" value={f.logoUrl || ''} onChange={set('logoUrl')} placeholder="https://…" />
        </div>
        {isNew && (
          <label className="col-span-2 flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={f.withDefaultPillars} onChange={set('withDefaultPillars')} />
            Start with default pillars (Promotional, Educational, Engagement, Testimonials, Announcements, Holiday)
          </label>
        )}
      </form>
    </Modal>
  );
}

export default function ClientsPage() {
  const [sp, setSp] = useSearchParams();
  const [showArchived, setShowArchived] = useState(false);
  const [q, setQ] = useState('');
  const { data: clients, isLoading } = useClients({ includeArchived: showArchived ? 'true' : undefined });
  const [editing, setEditing] = useState(sp.get('new') ? {} : null);
  const toggle = useAdminMutation(
    async (c) => (c.active ? api.delete(`/clients/${c.id}`) : api.patch(`/clients/${c.id}`, { active: true })),
    ['clients', 'overview'],
    'Client updated',
  );

  if (isLoading) return <FullPageSpinner />;
  const s = q.trim().toLowerCase();
  const shown = clients.filter((c) => !s || c.name.toLowerCase().includes(s) || (c.industry || '').toLowerCase().includes(s));
  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="page-title">Clients</h1>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input className="input w-56 pl-8" placeholder="Search clients…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <label className="ml-auto flex items-center gap-1.5 text-sm text-slate-600">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Show archived
        </label>
        <button className="btn-primary" onClick={() => setEditing({})}><Plus className="h-4 w-4" /> Add client</button>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-2">Client</th>
              <th className="px-4 py-2">Industry</th>
              <th className="px-4 py-2 text-right">Posts</th>
              <th className="px-4 py-2 text-right">Pillars</th>
              <th className="px-4 py-2 text-right">Logins</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shown.map((c) => (
              <tr key={c.id} className={c.active ? '' : 'opacity-50'}>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ background: c.brandColor }} />
                    <Link to={`/c/${c.slug}`} className="font-medium hover:text-brand-700 hover:underline">{c.name}</Link>
                    <span className="text-xs text-slate-500">/{c.slug}</span>
                    {!c.active && <span className="rounded bg-slate-200 px-1.5 text-[10px]">archived</span>}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-slate-600">{c.industry || '—'}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{c._count.posts}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{c._count.pillars}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{c._count.users}</td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-1">
                    <Link to={`/c/${c.slug}`} className="btn-ghost px-2" title="Open calendar"><ExternalLink className="h-4 w-4" /></Link>
                    <button className="btn-ghost px-2" title="Edit" onClick={() => setEditing({ ...c, slug: c.slug })}><Pencil className="h-4 w-4" /></button>
                    <button
                      className="btn-ghost px-2"
                      title={c.active ? 'Archive' : 'Restore'}
                      onClick={() => (c.active ? confirm(`Archive ${c.name}? Its calendar is kept but hidden.`) && toggle.mutate(c) : toggle.mutate(c))}
                    >
                      {c.active ? <Archive className="h-4 w-4" /> : <ArchiveRestore className="h-4 w-4" />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!shown.length && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">No client matches this search.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {editing && (
        <ClientForm
          initial={editing.id ? editing : null}
          onClose={() => {
            setEditing(null);
            if (sp.get('new')) setSp({}, { replace: true });
          }}
        />
      )}
    </div>
  );
}
