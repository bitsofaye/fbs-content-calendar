import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useClients } from '../../api/hooks';
import { api, errorMessage } from '../../lib/api';
import { PLACEMENT, STATUSES } from '../../lib/constants';
import { formatDate } from '../../lib/dates';
import { PlacementChips } from '../../components/ui';

export default function ImportPage() {
  const qc = useQueryClient();
  const { data: clients = [] } = useClients();
  const [clientId, setClientId] = useState('');
  const [year, setYear] = useState('2026');
  const [includeIdeas, setIncludeIdeas] = useState(true);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [sourceFilter, setSourceFilter] = useState('');
  const cid = clientId || clients.find((c) => c.slug === 'fbs')?.id || clients[0]?.id;
  const client = clients.find((c) => c.id === cid);

  async function runPreview(e) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('clientId', cid);
      if (year) fd.append('year', year);
      fd.append('includeIdeas', String(includeIdeas));
      const { data } = await api.post('/import/preview', fd, { timeout: 120000 });
      setPreview(data);
      setRows(data.posts.map((p) => ({ ...p, include: !p.alreadyImported })));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    const posts = rows.filter((r) => r.include).map(({ include, alreadyImported, source, ...p }) => p); // eslint-disable-line no-unused-vars
    if (!posts.length) return toast.error('No rows selected');
    setBusy(true);
    try {
      const { data } = await api.post('/import/commit', { clientId: cid, posts }, { timeout: 120000 });
      setResult(data);
      toast.success(`Imported ${data.created} posts`);
      ['posts', 'dashboard', 'overview', 'pillars', 'client', 'clients'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      setRows((rs) => rs.map((r) => (r.include ? { ...r, include: false, alreadyImported: true } : r)));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const visible = useMemo(() => rows.filter((r) => !sourceFilter || r.source === sourceFilter), [rows, sourceFilter]);
  const selected = rows.filter((r) => r.include).length;
  const setRow = (key, patch) => setRows((rs) => rs.map((r) => (r.importSource === key ? { ...r, ...patch } : r)));
  const pillarNames = useMemo(() => [...new Set(rows.map((r) => r.pillarName).filter(Boolean))].sort(), [rows]);

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="page-title">Import from the FBS workbook</h1>
        <p className="max-w-3xl text-sm text-slate-500">
          Upload <b>FBS Social Media Calendar.xlsx</b>. Posts are read from the <i>Content proposals</i>, <i>Contents for Approval</i> and{' '}
          <i>Ads for Approval</i> sheets, plus undated ideas from <i>Contents</i>. Nothing is saved until you confirm. Re-importing the same file skips
          rows that were already imported.
        </p>
      </div>

      <form onSubmit={runPreview} className="card flex flex-wrap items-end gap-4 p-4">
        <div>
          <label className="label">Import into client</label>
          <select className="input w-60" value={cid || ''} onChange={(e) => setClientId(e.target.value)}>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Only dates in year</label>
          <input className="input w-28" type="number" value={year} onChange={(e) => setYear(e.target.value)} placeholder="all" />
        </div>
        <label className="flex items-center gap-1.5 pb-2 text-sm text-slate-600">
          <input type="checkbox" checked={includeIdeas} onChange={(e) => setIncludeIdeas(e.target.checked)} /> Include idea bank
        </label>
        <div className="min-w-[240px] flex-1">
          <label className="label">Workbook (.xlsx)</label>
          <input type="file" accept=".xlsx" className="input file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-sm" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </div>
        <button className="btn-primary" disabled={!file || !cid || busy}>
          <FileSpreadsheet className="h-4 w-4" /> {busy && !preview ? 'Reading…' : 'Preview'}
        </button>
      </form>

      {result && (
        <div className="card flex items-start gap-3 border-green-200 bg-green-50 p-4 text-sm text-green-900">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">
              Imported {result.created} posts into {client?.name}
              {result.alreadyImported ? ` · ${result.alreadyImported} were already there` : ''}.
            </p>
            {result.pillarsCreated.length > 0 && <p>New pillars created: {result.pillarsCreated.join(', ')}</p>}
            {result.approversUnmatched.length > 0 && (
              <p>
                Approvers without an account yet: {result.approversUnmatched.join(', ')} — <Link to="/admin/users" className="underline">add them as users</Link> and their posts are linked automatically.
              </p>
            )}
            <Link to={`/c/${client?.slug}?month=${year || ''}-01`} className="mt-1 inline-block font-medium underline">Open the calendar →</Link>
          </div>
        </div>
      )}

      {preview && (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="card p-4 text-sm">
              <div className="mb-1 text-xs font-medium text-slate-500">Found</div>
              <div className="text-2xl font-semibold tabular-nums">{preview.summary.total}</div>
              <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
                {Object.entries(preview.summary.bySource).map(([k, v]) => <li key={k}>{k}: <b>{v}</b></li>)}
              </ul>
              {preview.alreadyImported > 0 && <p className="mt-1 text-xs text-amber-700">{preview.alreadyImported} already imported (unticked)</p>}
            </div>
            <div className="card p-4 text-sm">
              <div className="mb-1 text-xs font-medium text-slate-500">Approvers in the sheet</div>
              <ul className="space-y-0.5 text-xs">
                {Object.entries(preview.approvers).map(([name, match]) => (
                  <li key={name}>
                    {name} → {match ? <b className="text-green-700">{match}</b> : <span className="text-amber-700">no user yet (kept as text)</span>}
                  </li>
                ))}
                {!Object.keys(preview.approvers).length && <li className="text-slate-500">none</li>}
              </ul>
              {preview.pillarsToCreate.length > 0 && <p className="mt-2 text-xs text-slate-600">New pillars to create: {preview.pillarsToCreate.join(', ')}</p>}
            </div>
            <div className="card p-4 text-sm">
              <div className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-500"><AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Warnings ({preview.warnings.length})</div>
              <ul className="max-h-28 space-y-0.5 overflow-y-auto text-xs text-slate-600">
                {preview.warnings.map((w, i) => <li key={i}>[{w.sheet}{w.row ? ` r${w.row}` : ''}] {w.message}</li>)}
                {!preview.warnings.length && <li className="text-slate-500">No warnings</li>}
              </ul>
              {preview.skipped.length > 0 && <p className="mt-1 text-xs text-slate-500">{preview.skipped.length} empty rows skipped</p>}
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2">
              <select className="input w-auto py-1 text-xs" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
                <option value="">All sheets</option>
                {Object.keys(preview.summary.bySource).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setRows((rs) => rs.map((r) => (visible.includes(r) && !r.alreadyImported ? { ...r, include: true } : r)))}>Select all</button>
              <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setRows((rs) => rs.map((r) => (visible.includes(r) ? { ...r, include: false } : r)))}>Select none</button>
              <span className="ml-auto text-xs text-slate-500">{selected} selected</span>
              <button className="btn-primary" disabled={!selected || busy} onClick={commit}>
                <Upload className="h-4 w-4" /> {busy ? 'Importing…' : `Import ${selected} posts`}
              </button>
            </div>
            <div className="max-h-[60vh] overflow-auto">
              <table className="w-full min-w-[1000px] text-xs">
                <thead className="sticky top-0 bg-slate-50 text-left text-[11px] text-slate-500 uppercase">
                  <tr>
                    <th className="w-8 px-2 py-2" />
                    <th className="px-2 py-2">Date</th>
                    <th className="px-2 py-2">Sheet</th>
                    <th className="px-2 py-2">Topic</th>
                    <th className="px-2 py-2">Pillar</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">Platforms</th>
                    <th className="px-2 py-2">Approver</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visible.map((r) => (
                    <tr key={r.importSource} className={r.alreadyImported ? 'bg-slate-50 text-slate-500' : ''}>
                      <td className="px-2 py-1.5">
                        <input type="checkbox" checked={r.include} disabled={r.alreadyImported} onChange={(e) => setRow(r.importSource, { include: e.target.checked })} />
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{r.date ? formatDate(r.date) : <i>idea</i>}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-slate-500">
                        {r.source} <span className="text-slate-500">{r.importSource.split('!')[1]}</span>
                        {r.kind === 'AD' && <span className="ml-1 rounded bg-fuchsia-100 px-1 text-fuchsia-700">AD</span>}
                      </td>
                      <td className="max-w-[320px] px-2 py-1.5">
                        <input className="input py-0.5 text-xs" value={r.title} onChange={(e) => setRow(r.importSource, { title: e.target.value })} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          className="input py-0.5 text-xs"
                          list="import-pillars"
                          value={r.pillarName || ''}
                          placeholder="Uncategorized"
                          onChange={(e) => setRow(r.importSource, { pillarName: e.target.value || null })}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <select className="input py-0.5 text-xs" value={r.status} onChange={(e) => setRow(r.importSource, { status: e.target.value })}>
                          {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1.5" title={r.placements.map((p) => PLACEMENT[p]?.label).join(', ')}>
                        <PlacementChips placements={r.placements} size="xs" />
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{r.approverName || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <datalist id="import-pillars">{pillarNames.map((n) => <option key={n} value={n} />)}</datalist>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
