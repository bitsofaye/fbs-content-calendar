import { useState } from 'react';
import { Eye, EyeOff, Pencil, Plus, Search, UserX, UserCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAdminMutation, useClients, useUsers } from '../../api/hooks';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { FullPageSpinner, Modal } from '../../components/ui';

function UserForm({ initial, clients, onClose }) {
  const isNew = !initial?.id;
  const [f, setF] = useState({
    name: initial?.name || '',
    email: initial?.email || '',
    password: '',
    role: initial?.role || 'ADMIN',
    clientId: initial?.clientId || clients[0]?.id || '',
  });
  const save = useAdminMutation(
    async (body) => (await (isNew ? api.post('/users', body) : api.patch(`/users/${initial.id}`, body))).data,
    ['users', 'userOptions', 'posts', 'overview'],
  );
  const [showPw, setShowPw] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    const body = { name: f.name, email: f.email, role: f.role, clientId: f.role === 'CLIENT' ? f.clientId : null };
    if (f.password) body.password = f.password;
    const res = await save.mutateAsync(body);
    toast.success(`${isNew ? 'User created' : 'User updated'}${res.linkedPosts ? ` · linked as approver on ${res.linkedPosts} imported posts` : ''}`);
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? 'Add user' : `Edit ${initial.name}`}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" form="user-form" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</button>
        </>
      }
    >
      <form id="user-form" onSubmit={submit} className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="label">Full name *</label>
          <input className="input" value={f.name} onChange={set('name')} required autoFocus placeholder="e.g. Carlo Del Monte" />
          <p className="mt-1 text-[11px] text-slate-500">Use the real first name — imported posts with approver “Sir Carlo” are linked automatically.</p>
        </div>
        <div className="col-span-2">
          <label className="label">Email *</label>
          <input type="email" className="input" value={f.email} onChange={set('email')} required />
        </div>
        <div className="col-span-2">
          <label className="label">{isNew ? 'Password * (min. 8 characters)' : 'New password (leave empty to keep)'}</label>
          <div className="relative">
            <input type={showPw ? 'text' : 'password'} className="input pr-10 font-mono" value={f.password} onChange={set('password')} required={isNew} minLength={8} autoComplete="new-password" />
            <button type="button" className="absolute top-1/2 right-1.5 -translate-y-1/2 cursor-pointer rounded p-1 text-slate-500 hover:text-slate-700" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Hide password' : 'Show password'}>
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Share it with the person privately. They can change it later in My account.</p>
        </div>
        <div>
          <label className="label">Role</label>
          <select className="input" value={f.role} onChange={set('role')}>
            <option value="ADMIN">Admin (FBS team)</option>
            <option value="CLIENT">Client (view & approve)</option>
          </select>
        </div>
        {f.role === 'CLIENT' && (
          <div>
            <label className="label">Client</label>
            <select className="input" value={f.clientId} onChange={set('clientId')} required>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
      </form>
    </Modal>
  );
}

export default function UsersPage() {
  const { user: me } = useAuth();
  const { data: users, isLoading } = useUsers();
  const { data: clients = [] } = useClients();
  const [editing, setEditing] = useState(null);
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const toggle = useAdminMutation(
    async (u) => (u.active ? api.delete(`/users/${u.id}`) : api.patch(`/users/${u.id}`, { active: true })),
    ['users', 'userOptions'],
    'User updated',
  );
  if (isLoading) return <FullPageSpinner />;
  const s = q.trim().toLowerCase();
  const shown = users
    .filter((u) => !roleFilter || u.role === roleFilter)
    .filter((u) => !s || u.name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s) || (u.client?.name || '').toLowerCase().includes(s));

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="page-title">Users</h1>
          <p className="text-sm text-slate-500">Admins manage every calendar. Client logins only see their own calendar and can approve, request changes and comment.</p>
        </div>
        <button className="btn-primary ml-auto" onClick={() => setEditing({})}><Plus className="h-4 w-4" /> Add user</button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input className="input w-64 pl-8" placeholder="Search name, email or client…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input w-auto" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} aria-label="Role">
          <option value="">Everyone</option>
          <option value="ADMIN">FBS team (admins)</option>
          <option value="CLIENT">Client logins</option>
        </select>
        <span className="ml-auto text-xs text-slate-500">{shown.length} of {users.length}</span>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Role</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shown.map((u) => (
              <tr key={u.id} className={u.active ? '' : 'opacity-50'}>
                <td className="px-4 py-2.5 font-medium">{u.name}{u.id === me.id && <span className="ml-1 text-xs font-normal text-slate-500">(you)</span>}</td>
                <td className="px-4 py-2.5 text-slate-600">{u.email}</td>
                <td className="px-4 py-2.5">
                  {u.role === 'ADMIN' ? (
                    <span className="rounded bg-brand-50 px-1.5 py-0.5 text-xs font-medium text-brand-700">Admin</span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                      <span className="h-2 w-2 rounded-full" style={{ background: u.client?.brandColor }} /> Client · {u.client?.name}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-xs">{u.active ? 'Active' : 'Disabled'}</td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-1">
                    <button className="btn-ghost px-2" title="Edit" onClick={() => setEditing(u)}><Pencil className="h-4 w-4" /></button>
                    {u.id !== me.id && (
                      <button
                        className="btn-ghost px-2"
                        title={u.active ? 'Disable this login' : 'Enable this login'}
                        onClick={() => (!u.active || confirm(`Disable ${u.name}? They won't be able to sign in until you enable them again. Nothing is deleted.`)) && toggle.mutate(u)}
                      >
                        {u.active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!shown.length && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">No user matches this search.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {editing && <UserForm initial={editing.id ? editing : null} clients={clients} onClose={() => setEditing(null)} />}
    </div>
  );
}
