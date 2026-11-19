import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Archive, ArchiveRestore, ExternalLink, Image as ImageIcon, Pencil, Plus, RotateCcw, Search, Trash2, Upload } from 'lucide-react';
import { useAdminMutation, useClients, useClientTrash } from '../../api/hooks';
import { api } from '../../lib/api';
import { ClientMark, FullPageSpinner, Modal, Spinner } from '../../components/ui';
import { formatDate } from '../../lib/dates';

const blank = { name: '', slug: '', brandColor: '#921259', secondaryColor: '', industry: '', logoUrl: '' };
const HEX = /^#[0-9a-f]{6}$/i;

// Shrinks an uploaded logo to a small square-ish image (longest side `max` px), keeping transparency
function shrinkLogo(file, max = 256) {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpeg|webp|gif|svg\+xml)$/.test(file.type)) return reject(new Error('Pick a PNG, JPG, WebP, GIF or SVG image'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.naturalWidth || max, img.naturalHeight || max));
      const w = Math.max(1, Math.round((img.naturalWidth || max) * scale));
      const h = Math.max(1, Math.round((img.naturalHeight || max) * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      let data = canvas.toDataURL('image/webp', 0.9);
      if (!data.startsWith('data:image/webp')) data = canvas.toDataURL('image/png'); // browsers without WebP export
      resolve(data);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That file could not be read as an image'));
    };
    img.src = url;
  });
}

// Logo: upload an image from the computer, or paste a link to one
function LogoField({ value, onChange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const uploaded = value?.startsWith('data:');
  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      onChange(await shrinkLogo(file));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="sm:col-span-2">
      <label className="label">Logo</label>
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#fff] ring-1 ring-slate-200">
          {value ? <img src={value} alt="Logo preview" className="h-full w-full object-contain" /> : <ImageIcon className="h-6 w-6 text-slate-300" />}
        </span>
        <label className={`btn-secondary cursor-pointer ${busy ? 'pointer-events-none opacity-60' : ''}`}>
          <Upload className="h-4 w-4" /> {busy ? 'Preparing…' : value ? 'Change logo' : 'Upload logo'}
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" className="sr-only" onChange={pick} />
        </label>
        {value && (
          <button type="button" className="btn-ghost px-2 text-xs text-red-600" onClick={() => onChange('')}>
            Remove
          </button>
        )}
        <input
          className="input min-w-[180px] flex-1"
          value={uploaded ? '' : value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={uploaded ? 'Uploaded image (or paste a link instead)' : '…or paste a logo link https://…'}
          aria-label="Logo link"
        />
      </div>
      <p className={`mt-1 text-xs ${error ? 'text-red-600' : 'text-slate-500'}`}>
        {error || 'PNG with a transparent background looks best. It is shrunk to a small image automatically.'}
      </p>
    </div>
  );
}

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
    const body = { name: f.name, brandColor: f.brandColor, secondaryColor: f.secondaryColor || '', industry: f.industry || null, logoUrl: f.logoUrl || '' };
    if (f.slug) body.slug = f.slug;
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
      <form id="client-form" onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Client name *</label>
          <input className="input" value={f.name} onChange={set('name')} required autoFocus />
        </div>
        <div>
          <label className="label">URL name (slug)</label>
          <input className="input" value={f.slug} onChange={set('slug')} placeholder="auto from name" pattern="[a-z0-9-]+" />
        </div>
        <div>
          <label className="label">Main brand color</label>
          <div className="flex gap-2">
            <input type="color" className="h-[34px] w-12 cursor-pointer rounded border border-slate-300" value={f.brandColor} onChange={set('brandColor')} />
            <input className="input" value={f.brandColor} onChange={set('brandColor')} />
          </div>
        </div>
        <div>
          <label className="label">Second brand color <span className="font-normal text-slate-500">(optional)</span></label>
          <div className="flex gap-2">
            <input
              type="color"
              className="h-[34px] w-12 cursor-pointer rounded border border-slate-300"
              value={HEX.test(f.secondaryColor || '') ? f.secondaryColor : f.brandColor}
              onChange={set('secondaryColor')}
            />
            <input className="input" value={f.secondaryColor || ''} onChange={set('secondaryColor')} placeholder="none" pattern="#[0-9a-fA-F]{6}" />
            {f.secondaryColor && (
              <button type="button" className="btn-ghost px-2 text-xs" onClick={() => setF((x) => ({ ...x, secondaryColor: '' }))} title="Remove second color">
                Clear
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg sm:col-span-2 border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <span className="flex h-6 w-16 shrink-0 overflow-hidden rounded-md ring-1 ring-slate-200">
            <span className="flex-1" style={{ background: HEX.test(f.brandColor) ? f.brandColor : '#cbd5e1' }} />
            <span className="flex-1" style={{ background: HEX.test(f.secondaryColor || '') ? f.secondaryColor : HEX.test(f.brandColor) ? f.brandColor : '#cbd5e1' }} />
          </span>
          The client’s login is themed in these colors: the main color for headings, buttons and menus; the second for badges, highlights and accents.
        </div>
        <div>
          <label className="label">Industry</label>
          <input className="input" value={f.industry || ''} onChange={set('industry')} placeholder="e.g. Resort, Restaurant" />
        </div>
        <LogoField value={f.logoUrl} onChange={(v) => setF((x) => ({ ...x, logoUrl: v }))} />
        {isNew && <p className="text-xs sm:col-span-2 text-slate-500">The new client starts with no pillars. Add theirs in Pillars &amp; themes.</p>}
      </form>
    </Modal>
  );
}

const TRASH_KEYS = ['clients', 'client', 'overview', 'clientTrash', 'posts'];
const daysLeft = (iso) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));

// Clients moved to the Trash: restore them, or delete them for good. Anything left is removed after 30 days.
function TrashList() {
  const { data, isLoading } = useClientTrash();
  const restore = useAdminMutation((c) => api.post(`/clients/${c.id}/restore`), TRASH_KEYS, 'Client restored');
  const purge = useAdminMutation((c) => api.delete(`/clients/${c.id}/permanent`), TRASH_KEYS, 'Client deleted for good');
  if (isLoading) return <div className="card flex justify-center p-8"><Spinner /></div>;
  const list = data?.clients || [];
  return (
    <div className="card overflow-x-auto">
      <div className="border-b border-slate-100 px-4 py-3 text-xs text-slate-500">
        Deleted clients stay here for <b>{data?.days ?? 30} days</b>. While here, their calendar is hidden and their logins can’t sign in. Restore a client to bring everything back; otherwise it is deleted for good on the date shown.
      </div>
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs text-slate-500 uppercase">
          <tr>
            <th className="px-4 py-2">Client</th>
            <th className="px-4 py-2">Deleted on</th>
            <th className="px-4 py-2">Deleted for good on</th>
            <th className="px-4 py-2 text-right">Posts</th>
            <th className="px-4 py-2 text-right">Logins</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {list.map((c) => {
            const left = daysLeft(c.purgeAt);
            return (
              <tr key={c.id}>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ background: c.brandColor }} />
                    <span className="font-medium">{c.name}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-slate-600">{formatDate(c.deletedAt.slice(0, 10), { withYear: true })}</td>
                <td className="px-4 py-2.5 text-slate-600">
                  {formatDate(c.purgeAt.slice(0, 10), { withYear: true })}
                  <span className={`ml-2 rounded-full px-1.5 text-[11px] ${left <= 5 ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                    {left} day{left === 1 ? '' : 's'} left
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{c._count.posts}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{c._count.users}</td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-1">
                    <button className="btn-secondary px-2.5 py-1 text-xs" disabled={restore.isPending} onClick={() => restore.mutate(c)}>
                      <RotateCcw className="h-3.5 w-3.5" /> Restore
                    </button>
                    <button
                      className="btn-ghost px-2.5 py-1 text-xs text-red-600"
                      disabled={purge.isPending}
                      onClick={() =>
                        confirm(`Delete ${c.name} for good now? Its ${c._count.posts} posts, pillars, Drive links and client logins are removed. This cannot be undone.`) &&
                        purge.mutate(c)
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete for good
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
          {!list.length && (
            <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">The Trash is empty.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function ClientsPage() {
  const [sp, setSp] = useSearchParams();
  const [showArchived, setShowArchived] = useState(false);
  const [q, setQ] = useState('');
  const { data: clients, isLoading } = useClients({ includeArchived: showArchived ? 'true' : undefined });
  const { data: trash } = useClientTrash();
  const view = sp.get('view') === 'trash' ? 'trash' : 'list';
  const setView = (v) => setSp(v === 'trash' ? { view: 'trash' } : {}, { replace: true });
  const moveToTrash = useAdminMutation((c) => api.post(`/clients/${c.id}/trash`), TRASH_KEYS, (r) => `${r.data.client.name} moved to the Trash`);
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
        <div className="relative min-w-0 flex-1 sm:flex-none">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input className="input w-full pl-8 sm:w-56" placeholder="Search clients…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <label className="ml-auto flex items-center gap-1.5 text-sm text-slate-600">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Show archived
        </label>
        <button className="btn-primary" onClick={() => setEditing({})}><Plus className="h-4 w-4" /> Add client</button>
      </div>
      <div className="flex w-fit gap-1 rounded-xl border border-slate-200 bg-white p-1 text-sm">
        {[['list', 'Clients', clients?.length], ['trash', 'Trash', trash?.clients?.length]].map(([id, label, n]) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 ${view === id ? 'bg-brand-700 font-medium text-white shadow-sm' : 'text-slate-600 hover:bg-brand-50'}`}
          >
            {id === 'trash' && <Trash2 className="h-3.5 w-3.5" />} {label}
            {n ? <span className={`rounded-full px-1.5 text-[11px] tabular-nums ${view === id ? 'bg-white/20' : 'bg-slate-100 text-slate-600'}`}>{n}</span> : null}
          </button>
        ))}
      </div>
      {view === 'trash' ? (
        <TrashList />
      ) : (
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-2">Client</th>
              <th className="hidden px-4 py-2 md:table-cell">Industry</th>
              <th className="px-4 py-2 text-right">Posts</th>
              <th className="hidden px-4 py-2 text-right sm:table-cell">Pillars</th>
              <th className="hidden px-4 py-2 text-right sm:table-cell">Logins</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shown.map((c) => (
              <tr key={c.id} className={c.active ? '' : 'opacity-50'}>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <ClientMark client={c} />
                    <Link to={`/c/${c.slug}`} className="font-medium hover:text-brand-700 hover:underline">{c.name}</Link>
                    <span className="hidden text-xs text-slate-500 sm:inline">/{c.slug}</span>
                    {!c.active && <span className="rounded bg-slate-200 px-1.5 text-[10px]">archived</span>}
                  </div>
                </td>
                <td className="hidden px-4 py-2.5 text-slate-600 md:table-cell">{c.industry || '—'}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{c._count.posts}</td>
                <td className="hidden px-4 py-2.5 text-right tabular-nums sm:table-cell">{c._count.pillars}</td>
                <td className="hidden px-4 py-2.5 text-right tabular-nums sm:table-cell">{c._count.users}</td>
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
                    <button
                      className="btn-ghost px-2 text-red-600"
                      title="Delete (kept in the Trash for 30 days)"
                      disabled={moveToTrash.isPending}
                      onClick={() =>
                        confirm(`Delete ${c.name}? It moves to the Trash: its calendar is hidden and its logins can’t sign in. You can restore it within 30 days; after that it is deleted for good.`) &&
                        moveToTrash.mutate(c)
                      }
                    >
                      <Trash2 className="h-4 w-4" />
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
      )}
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
