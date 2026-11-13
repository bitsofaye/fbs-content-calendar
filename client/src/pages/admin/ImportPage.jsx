import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ChevronDown, Download, FileUp, Info, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useClients } from '../../api/hooks';
import { api, errorMessage } from '../../lib/api';
import { PLACEMENT, STATUSES } from '../../lib/constants';
import { formatDate } from '../../lib/dates';
import { downloadCSV, toCSV } from '../../lib/csv';
import { PlacementChips } from '../../components/ui';

// The headings every CSV must have in its first row (cells may be empty, except Topic).
// They match the Content plan's Export CSV, so an exported month can be imported back as is.
const REQUIRED_HEADINGS = ['Date', 'Time', 'Pillar / Service', 'Topic', 'Type', 'Platforms', 'Status', 'Approver', 'Format', 'Story board', 'Caption', 'Hashtags', 'Pubmat links', 'Remarks'];

function downloadTemplate() {
  downloadCSV('content-import-template.csv', toCSV([], REQUIRED_HEADINGS.map((c) => ({ label: c, value: () => '' }))));
}

export default function ImportPage() {
  const qc = useQueryClient();
  const { data: clients = [] } = useClients();
  const [clientId, setClientId] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [showHelp, setShowHelp] = useState(true);
  const cid = clientId || clients.find((c) => c.slug === 'fbs')?.id || clients[0]?.id;
  const client = clients.find((c) => c.id === cid);

  async function runPreview(e) {
    e.preventDefault();
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) return toast.error('Choose a .csv file. In Excel or Google Sheets: File → Save as / Download → CSV.');
    setBusy(true);
    setResult(null);
    try {
      const csv = await file.text();
      const { data } = await api.post('/import/preview-csv', { clientId: cid, csv }, { timeout: 120000 });
      setPreview(data);
      setRows(data.posts.map((p) => ({ ...p, include: !p.alreadyImported })));
      setShowHelp(false);
    } catch (err) {
      toast.error(errorMessage(err), { duration: 8000 });
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    const posts = rows.filter((r) => r.include).map(({ include, alreadyImported, source, line, ...p }) => p); // eslint-disable-line no-unused-vars
    if (!posts.length) return toast.error('No rows selected');
    setBusy(true);
    try {
      const { data } = await api.post('/import/commit', { clientId: cid, posts }, { timeout: 120000 });
      setResult({ ...data, firstMonth: posts.map((p) => p.date).filter(Boolean).sort()[0]?.slice(0, 7) });
      toast.success(`Imported ${data.created} posts`);
      ['posts', 'dashboard', 'overview', 'pillars', 'client', 'clients'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      setRows((rs) => rs.map((r) => (r.include ? { ...r, include: false, alreadyImported: true } : r)));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const selected = rows.filter((r) => r.include).length;
  const setRow = (key, patch) => setRows((rs) => rs.map((r) => (r.importSource === key ? { ...r, ...patch } : r)));
  const pillarNames = useMemo(() => [...new Set(rows.map((r) => r.pillarName).filter(Boolean))].sort(), [rows]);

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="page-title">Import content from CSV</h1>
        <p className="max-w-3xl text-sm text-slate-500">
          Add many posts at once from a CSV file — one post per row. Rows with a <b>date</b> go on the <b>Calendar</b> and <b>Content plan</b>; rows
          without a date go to the <b>Idea bank</b>. You see a preview first: nothing is saved until you click <b>Import</b>.
        </p>
      </div>

      {/* ---------- how to prepare the file ---------- */}
      <div className="card overflow-hidden">
        <button type="button" className="flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-left" onClick={() => setShowHelp((v) => !v)}>
          <Info className="h-4 w-4 shrink-0 text-brand-700" />
          <span className="font-medium text-slate-800">How to prepare your CSV file</span>
          <span className="ml-auto text-xs text-slate-500">{showHelp ? 'Hide' : 'Show'}</span>
          <ChevronDown className={`h-4 w-4 text-slate-500 transition ${showHelp ? 'rotate-180' : ''}`} />
        </button>
        {showHelp && (
          <div className="space-y-3 border-t border-slate-100 px-4 pt-3 pb-4 text-sm text-slate-600">
            <p>The <b>first row</b> of your file must have these headings:</p>
            <div className="flex flex-wrap gap-1.5">
              {REQUIRED_HEADINGS.map((h) => (
                <span key={h} className={`rounded-md px-2 py-1 text-xs font-medium ${h === 'Topic' ? 'bg-brand-700 text-white' : 'bg-brand-50 text-brand-700'}`}>{h}</span>
              ))}
            </div>
            <ul className="list-disc space-y-1 pl-5">
              <li>All headings must be there, even if the column is empty. Only <b>Topic</b> must be filled in on every row.</li>
              <li>One post per row. Rows with a <b>Date</b> go on the Calendar and Content plan; rows without a date go to the Idea bank.</li>
              <li>
                Save the file as <b>CSV</b> (Excel: <i>Save As → CSV UTF-8</i>; Google Sheets: <i>Download → .csv</i>), or{' '}
                <button type="button" className="font-medium text-brand-700 underline underline-offset-2" onClick={downloadTemplate}>download the empty template</button>.
              </li>
            </ul>
          </div>
        )}
      </div>

      {/* ---------- choose client + file ---------- */}
      <form onSubmit={runPreview} className="card flex flex-wrap items-end gap-4 p-4">
        <div>
          <label className="label">Import into client</label>
          <select className="input w-64" value={cid || ''} onChange={(e) => { setClientId(e.target.value); setPreview(null); setRows([]); }}>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="min-w-[240px] flex-1">
          <label className="label">CSV file</label>
          <input
            type="file"
            accept=".csv,text/csv"
            className="input file:mr-3 file:rounded file:border-0 file:bg-brand-50 file:px-2 file:py-1 file:text-sm file:text-brand-700"
            onChange={(e) => { setFile(e.target.files?.[0] || null); setPreview(null); setRows([]); setResult(null); }}
          />
        </div>
        <button type="button" className="btn-ghost" onClick={downloadTemplate}>
          <Download className="h-4 w-4" /> Template
        </button>
        <button className="btn-primary" disabled={!file || !cid || busy}>
          <FileUp className="h-4 w-4" /> {busy && !preview ? 'Reading…' : 'Preview'}
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
            <div className="mt-1 flex flex-wrap gap-4">
              <Link to={`/c/${client?.slug}${result.firstMonth ? `?month=${result.firstMonth}` : ''}`} className="font-medium underline">Open the calendar →</Link>
              <Link to={`/c/${client?.slug}?view=sheet${result.firstMonth ? `&month=${result.firstMonth}` : ''}`} className="font-medium underline">Open the content plan →</Link>
            </div>
          </div>
        </div>
      )}

      {preview && (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="card p-4 text-sm">
              <div className="mb-1 text-xs font-medium text-slate-500">Found in the file</div>
              <div className="text-2xl font-semibold text-brand-700 tabular-nums">{preview.summary.total} posts</div>
              <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
                <li>With a date (Calendar & Content plan): <b>{preview.summary.dated}</b></li>
                <li>Without a date (Idea bank): <b>{preview.summary.ideas}</b></li>
              </ul>
              {preview.alreadyImported > 0 && <p className="mt-1 text-xs text-amber-700">{preview.alreadyImported} already in the calendar (unticked)</p>}
            </div>
            <div className="card p-4 text-sm">
              <div className="mb-1 text-xs font-medium text-slate-500">Columns used</div>
              <p className="text-xs text-slate-700">{preview.columnsFound.join(', ')}</p>
              {preview.unknownHeaders.length > 0 && <p className="mt-1 text-xs text-slate-500">Ignored: {preview.unknownHeaders.join(', ')}</p>}
              {Object.keys(preview.approvers).length > 0 && (
                <ul className="mt-2 space-y-0.5 text-xs">
                  {Object.entries(preview.approvers).map(([name, match]) => (
                    <li key={name}>
                      Approver {name} → {match ? <b className="text-green-700">{match}</b> : <span className="text-amber-700">no user yet (kept as text)</span>}
                    </li>
                  ))}
                </ul>
              )}
              {preview.pillarsToCreate.length > 0 && <p className="mt-2 text-xs text-slate-600">New pillars to create: {preview.pillarsToCreate.join(', ')}</p>}
            </div>
            <div className="card p-4 text-sm">
              <div className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-500"><AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Check these ({preview.warnings.length})</div>
              <ul className="max-h-28 space-y-0.5 overflow-y-auto text-xs text-slate-600">
                {preview.warnings.map((w, i) => <li key={i}><b>Row {w.row}:</b> {w.message}</li>)}
                {!preview.warnings.length && <li className="text-slate-500">Everything looks fine</li>}
              </ul>
              {preview.skipped.length > 0 && <p className="mt-1 text-xs text-slate-500">{preview.skipped.length === 1 ? `Row ${preview.skipped[0].row} has no topic and was skipped` : `${preview.skipped.length} rows without a topic were skipped (rows ${preview.skipped.map((s) => s.row).join(', ')})`}</p>}
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2">
              <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setRows((rs) => rs.map((r) => (r.alreadyImported ? r : { ...r, include: true })))}>Select all</button>
              <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setRows((rs) => rs.map((r) => ({ ...r, include: false })))}>Select none</button>
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
                    <th className="px-2 py-2">Row</th>
                    <th className="px-2 py-2">Date</th>
                    <th className="px-2 py-2">Topic</th>
                    <th className="px-2 py-2">Pillar</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">Platforms</th>
                    <th className="px-2 py-2">Approver</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => (
                    <tr key={r.importSource} className={r.alreadyImported ? 'bg-slate-50 text-slate-500' : ''}>
                      <td className="px-2 py-1.5">
                        <input type="checkbox" checked={r.include} disabled={r.alreadyImported} onChange={(e) => setRow(r.importSource, { include: e.target.checked })} />
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-slate-500">
                        {r.line}
                        {r.kind === 'AD' && <span className="ml-1 rounded bg-fuchsia-100 px-1 text-fuchsia-700">AD</span>}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        {r.date ? formatDate(r.date) : <i className="text-slate-500">Idea bank</i>}
                        {r.time && <span className="ml-1 text-slate-500">{r.time}</span>}
                        {r.alreadyImported && <div className="text-[10px] text-amber-700">already in calendar</div>}
                      </td>
                      <td className="max-w-[320px] px-2 py-1.5">
                        <input className="input py-0.5 text-xs" value={r.title} disabled={r.alreadyImported} onChange={(e) => setRow(r.importSource, { title: e.target.value })} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input className="input py-0.5 text-xs" list="import-pillars" value={r.pillarName || ''} placeholder="Uncategorized" disabled={r.alreadyImported} onChange={(e) => setRow(r.importSource, { pillarName: e.target.value || null })} />
                      </td>
                      <td className="px-2 py-1.5">
                        <select className="input py-0.5 text-xs" value={r.status} disabled={r.alreadyImported} onChange={(e) => setRow(r.importSource, { status: e.target.value })}>
                          {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1.5" title={r.placements.map((p) => PLACEMENT[p]?.label).join(', ')}>
                        {r.placements.length ? <PlacementChips placements={r.placements} size="xs" /> : <span className="text-slate-400">—</span>}
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
