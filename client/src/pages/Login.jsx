import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { CalendarDays, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { errorMessage } from '../lib/api';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // the page they tried to open before signing in (only same-site paths)
  const from = typeof location.state?.from === 'string' && location.state.from.startsWith('/') ? location.state.from : '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={from} replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-brand-700 p-4">
      <form onSubmit={onSubmit} className="card w-full max-w-sm p-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600">
            <CalendarDays className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-brand-700">Content Calendar</h1>
            <p className="text-xs text-slate-500">Sign in to plan, review and approve posts</p>
          </div>
        </div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" type="email" autoComplete="username" className="input mb-3" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        <label className="label" htmlFor="password">Password</label>
        <div className="relative mb-4">
          <input
            id="password"
            type={showPw ? 'text' : 'password'}
            autoComplete="current-password"
            className="input pr-10"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            type="button"
            className="absolute top-1/2 right-1.5 -translate-y-1/2 cursor-pointer rounded p-1 text-slate-500 hover:text-slate-700"
            onClick={() => setShowPw((v) => !v)}
            aria-label={showPw ? 'Hide password' : 'Show password'}
          >
            {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
        <button className="btn-primary w-full py-2" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="mt-4 text-center text-xs text-slate-500">Forgot your password? Ask your FBS admin to set a new one for you.</p>
        <p className="mt-2 text-center text-[11px] text-slate-500">The first sign-in of the day can take up to a minute while the server wakes up.</p>
      </form>
    </div>
  );
}
