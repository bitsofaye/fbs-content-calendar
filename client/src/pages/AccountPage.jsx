import { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { api, errorMessage } from '../lib/api';

export default function AccountPage() {
  const { user } = useAuth();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    if (form.newPassword !== form.confirm) return toast.error('New passwords do not match');
    setBusy(true);
    try {
      await api.post('/auth/change-password', { currentPassword: form.currentPassword, newPassword: form.newPassword });
      toast.success('Password changed');
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <div className="mx-auto max-w-lg p-6">
      <h1 className="page-title mb-5">My account</h1>
      <div className="card mb-6 p-5 text-sm">
        <div className="grid grid-cols-[100px_1fr] gap-y-2">
          <span className="text-slate-500">Name</span>
          <span>{user.name}</span>
          <span className="text-slate-500">Email</span>
          <span>{user.email}</span>
          <span className="text-slate-500">Role</span>
          <span>{user.role === 'ADMIN' ? 'Admin' : `Client · ${user.client?.name ?? ''}`}</span>
        </div>
      </div>
      <form onSubmit={onSubmit} className="card space-y-3 p-5">
        <h2 className="font-medium text-brand-700">Change password</h2>
        <div>
          <label className="label">Current password</label>
          <input type="password" className="input" value={form.currentPassword} onChange={set('currentPassword')} required autoComplete="current-password" />
        </div>
        <div>
          <label className="label">New password (min. 8 characters)</label>
          <input type="password" className="input" value={form.newPassword} onChange={set('newPassword')} required minLength={8} autoComplete="new-password" />
        </div>
        <div>
          <label className="label">Confirm new password</label>
          <input type="password" className="input" value={form.confirm} onChange={set('confirm')} required minLength={8} autoComplete="new-password" />
        </div>
        <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Change password'}</button>
      </form>
    </div>
  );
}
