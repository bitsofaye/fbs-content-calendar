import { useState } from 'react';
import {
  Check, ChevronRight, ExternalLink, File, FileSpreadsheet, FileText, Film, Folder, Image as ImageIcon, LayoutGrid, List, Music, Presentation, Search, X,
} from 'lucide-react';
import { useDriveFolder } from '../api/hooks';
import { errorMessage } from '../lib/api';
import { Spinner } from './ui';

// What a Drive file is, from its type: label, icon and colour (like Drive's own icons)
export function fileKind(mime = '') {
  if (mime === 'application/vnd.google-apps.folder') return { label: 'Folder', icon: Folder, cls: 'text-slate-500' };
  if (mime.startsWith('image/')) return { label: 'Image', icon: ImageIcon, cls: 'text-red-500' };
  if (mime.startsWith('video/')) return { label: 'Video', icon: Film, cls: 'text-red-600' };
  if (mime.startsWith('audio/')) return { label: 'Audio', icon: Music, cls: 'text-orange-500' };
  if (mime === 'application/pdf') return { label: 'PDF', icon: FileText, cls: 'text-red-600' };
  if (mime.includes('spreadsheet') || mime.includes('excel') || mime === 'text/csv') return { label: 'Sheet', icon: FileSpreadsheet, cls: 'text-green-600' };
  if (mime.includes('presentation') || mime.includes('powerpoint')) return { label: 'Slides', icon: Presentation, cls: 'text-amber-500' };
  if (mime.includes('document') || mime.includes('word') || mime.startsWith('text/')) return { label: 'Doc', icon: FileText, cls: 'text-sky-600' };
  return { label: 'File', icon: File, cls: 'text-slate-500' };
}

const fmtSize = (n) => (!n ? '—' : n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : n < 1024 ** 3 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${(n / 1024 ** 3).toFixed(1)} GB`);
const fmtDate = (s) => (s ? new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—');
const thumb = (f, w = 400) => f.thumbnail?.replace(/=s\d+$/, `=w${w}`) || `https://drive.google.com/thumbnail?id=${f.id}&sz=w${w}`;

const NO_PICKS = new Map();
const VIEW_KEY = 'cc.driveView';
const readView = () => {
  try {
    return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid';
  }
};

/**
 * Browse a shared Drive folder inside the app: open subfolders, grid or list view, preview a file,
 * and tick files to add. `picked` is a Map of url → file; onToggle(file) ticks/unticks one.
 * Falls back to Google's own folder view when the server has no Google key (onFallback is then called).
 */
export default function DriveBrowser({ client, root, picked = NO_PICKS, onToggle = () => {}, readOnly = false, tall = false }) {
  const [path, setPath] = useState([{ id: root.id, name: root.title }]); // breadcrumb of opened folders
  const [view, setView] = useState(readView);
  const [q, setQ] = useState('');
  const [preview, setPreview] = useState(null);
  const current = path[path.length - 1];
  const { data, isLoading, error } = useDriveFolder(client.id, current.id);

  const changeView = (v) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* storage blocked */
    }
  };
  const openFolder = (f) => {
    setPath((p) => [...p, { id: f.id, name: f.name }]);
    setQ('');
  };

  if (data && !data.configured) return <EmbeddedFolder folderId={current.id} url={root.url} view={view} onView={changeView} />;

  const s = q.trim().toLowerCase();
  const files = (data?.files || []).filter((f) => !s || f.name.toLowerCase().includes(s));
  const folders = files.filter((f) => f.isFolder);
  const items = files.filter((f) => !f.isFolder);

  return (
    <div className="space-y-3">
      {/* breadcrumb + tools */}
      <div className="flex flex-wrap items-center gap-2">
        <nav className="flex min-w-0 flex-1 flex-wrap items-center gap-0.5 text-sm" aria-label="Folder path">
          {path.map((p, i) => (
            <span key={p.id} className="flex items-center gap-0.5">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
              {i < path.length - 1 ? (
                <button className="cursor-pointer rounded px-1.5 py-0.5 text-slate-600 hover:bg-slate-100" onClick={() => setPath((x) => x.slice(0, i + 1))}>{p.name}</button>
              ) : (
                <span className="px-1.5 py-0.5 font-semibold text-slate-800">{data?.folder?.name || p.name}</span>
              )}
            </span>
          ))}
        </nav>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input className="input w-40 py-1 pl-7 text-xs" placeholder="Search this folder" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <ViewToggle view={view} onView={changeView} />
      </div>

      <div className={`${tall ? 'max-h-[calc(100vh-190px)]' : 'max-h-[52vh]'} min-h-[200px] overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/60 p-2`}>
        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : error ? (
          <div className="px-4 py-10 text-center text-sm text-slate-600">
            {errorMessage(error)}
            <div className="mt-2">
              <a href={root.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-brand-600 hover:underline">Open the folder in Drive <ExternalLink className="h-3 w-3" /></a>
            </div>
          </div>
        ) : !files.length ? (
          <p className="py-12 text-center text-sm text-slate-500">{s ? 'No file in this folder matches your search.' : 'This folder is empty.'}</p>
        ) : view === 'grid' ? (
          <div className="space-y-3">
            {folders.length > 0 && (
              <div>
                <div className="mb-1.5 px-1 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Folders</div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {folders.map((f) => (
                    <button key={f.id} onClick={() => openFolder(f)} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-sm hover:bg-brand-50" title={f.name}>
                      <Folder className="h-5 w-5 shrink-0 fill-slate-400 text-slate-500" />
                      <span className="truncate font-medium text-slate-700">{f.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {items.length > 0 && (
              <div>
                <div className="mb-1.5 px-1 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Files</div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {items.map((f) => <GridCard key={f.id} f={f} on={picked.has(f.url)} onToggle={() => onToggle(f)} onPreview={() => setPreview(f)} readOnly={readOnly} />)}
                </div>
              </div>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
              <tr>
                <th className="w-8 px-2 py-1.5" />
                <th className="px-2 py-1.5">Name</th>
                <th className="hidden px-2 py-1.5 sm:table-cell">Type</th>
                <th className="hidden px-2 py-1.5 md:table-cell">Modified</th>
                <th className="hidden px-2 py-1.5 text-right md:table-cell">Size</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {[...folders, ...items].map((f) => {
                const k = fileKind(f.mimeType);
                const on = picked.has(f.url);
                return (
                  <tr key={f.id} className={`hover:bg-slate-50 ${on ? 'bg-brand-50/60' : ''}`}>
                    <td className="px-2 py-1.5 text-center">
                      {!f.isFolder && !readOnly && <input type="checkbox" className="h-4 w-4 accent-[#921259]" checked={on} onChange={() => onToggle(f)} aria-label={`Select ${f.name}`} />}
                    </td>
                    <td className="px-2 py-1.5">
                      <button className="flex max-w-full cursor-pointer items-center gap-2 text-left" onClick={() => (f.isFolder ? openFolder(f) : setPreview(f))}>
                        <k.icon className={`h-4 w-4 shrink-0 ${k.cls} ${f.isFolder ? 'fill-slate-400' : ''}`} />
                        <span className="truncate font-medium text-slate-800">{f.name}</span>
                      </button>
                    </td>
                    <td className="hidden px-2 py-1.5 text-slate-500 sm:table-cell">{k.label}</td>
                    <td className="hidden px-2 py-1.5 text-slate-500 md:table-cell">{fmtDate(f.modifiedTime)}</td>
                    <td className="hidden px-2 py-1.5 text-right text-slate-500 tabular-nums md:table-cell">{f.isFolder ? '—' : fmtSize(f.size)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {data?.nextPageToken && <p className="text-xs text-slate-500">Showing the first 200 items. Use search, or open a subfolder, to find others.</p>}

      {preview && <Preview f={preview} on={picked.has(preview.url)} onToggle={() => onToggle(preview)} onClose={() => setPreview(null)} readOnly={readOnly} />}
    </div>
  );
}

function ViewToggle({ view, onView }) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
      {[['grid', LayoutGrid, 'Grid view'], ['list', List, 'List view']].map(([v, Icon, label]) => (
        <button key={v} onClick={() => onView(v)} title={label} aria-label={label} className={`cursor-pointer rounded-md p-1.5 ${view === v ? 'bg-brand-700 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}

function GridCard({ f, on, onToggle, onPreview, readOnly }) {
  const [broken, setBroken] = useState(false);
  const k = fileKind(f.mimeType);
  return (
    <div className={`group relative overflow-hidden rounded-lg border bg-white ${on ? 'border-brand-500 ring-2 ring-brand-300' : 'border-slate-200 hover:border-slate-300'}`}>
      <button className="block w-full cursor-pointer" onClick={onPreview} title={`Preview ${f.name}`}>
        <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-slate-100">
          {!broken ? (
            <img src={thumb(f)} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" onError={() => setBroken(true)} />
          ) : (
            <k.icon className={`h-10 w-10 ${k.cls}`} />
          )}
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1.5 text-left">
          <k.icon className={`h-3.5 w-3.5 shrink-0 ${k.cls}`} />
          <span className="truncate text-xs font-medium text-slate-700">{f.name}</span>
        </div>
      </button>
      {!readOnly && <button
        onClick={onToggle}
        aria-label={on ? `Unselect ${f.name}` : `Select ${f.name}`}
        className={`absolute top-1.5 left-1.5 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border-2 shadow-sm ${on ? 'border-brand-600 bg-brand-600 text-white' : 'border-white bg-white/80 text-transparent opacity-0 group-hover:opacity-100 hover:text-slate-400'}`}
      >
        <Check className="h-3.5 w-3.5" />
      </button>}
    </div>
  );
}

// Big preview of one file, using Drive's own viewer (images, videos, PDFs, Docs, Sheets, Slides)
function Preview({ f, on, onToggle, onClose, readOnly }) {
  const k = fileKind(f.mimeType);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 p-2 backdrop-blur-sm sm:p-4" onMouseDown={onClose}>
      <div className="card flex h-full max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-2.5">
          <k.icon className={`h-4 w-4 shrink-0 ${k.cls}`} />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">{f.name}</span>
          <a href={f.url} target="_blank" rel="noreferrer" className="btn-ghost px-2 py-1 text-xs" title="Open in Google Drive"><ExternalLink className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Open in Drive</span></a>
          {!readOnly && (
            <button className={on ? 'btn-secondary px-2.5 py-1 text-xs' : 'btn-primary px-2.5 py-1 text-xs'} onClick={onToggle}>
              <Check className="h-3.5 w-3.5" /> {on ? 'Selected' : 'Select'}
            </button>
          )}
          <button className="btn-ghost p-1" onClick={onClose} aria-label="Close preview"><X className="h-4 w-4" /></button>
        </div>
        <iframe src={`https://drive.google.com/file/d/${f.id}/preview`} title={f.name} allow="autoplay" className="w-full flex-1 border-0 bg-slate-100" />
      </div>
    </div>
  );
}

// No Google key on the server: Google's own folder view, still with grid / list
function EmbeddedFolder({ folderId, url, view, onView }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <p className="flex-1 text-xs text-slate-500">Click a file to open it in Drive, copy its link (Share → Copy link) and paste it below.</p>
        <ViewToggle view={view} onView={onView} />
      </div>
      <iframe key={view} src={`https://drive.google.com/embeddedfolderview?id=${folderId}#${view}`} title="Drive folder" className="h-[50vh] w-full rounded-lg border border-slate-200 bg-white" />
      <p className="text-xs text-slate-500">
        If the folder looks empty, it isn’t shared as “Anyone with the link”:{' '}
        <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-brand-600 hover:underline">open it in Drive <ExternalLink className="h-3 w-3" /></a>
      </p>
    </div>
  );
}
