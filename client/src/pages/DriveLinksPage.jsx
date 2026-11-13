import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, ExternalLink, FileText, FolderOpen, Link2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAdminMutation, useClient, useDriveLinks } from '../api/hooks';
import { api } from '../lib/api';
import { driveInfo, isHttps } from '../lib/drive';
import { EmptyState, FullPageSpinner, Spinner } from '../components/ui';

const KIND = {
  folder: { icon: FolderOpen, label: 'Drive folder', cls: 'bg-amber-50 text-amber-600' },
  file: { icon: FileText, label: 'Drive file', cls: 'bg-sky-50 text-sky-600' },
  doc: { icon: FileText, label: 'Google Docs / Slides / Sheets', cls: 'bg-emerald-50 text-emerald-600' },
  other: { icon: Link2, label: 'Link', cls: 'bg-slate-100 text-slate-500' },
};

function LinkForm({ initial = { title: '', url: '' }, onSave, onCancel, busy, saveLabel }) {
  const [title, setTitle] = useState(initial.title);
  const [url, setUrl] = useState(initial.url);
  const badUrl = url.trim() && !isHttps(url);
  const ok = title.trim() && isHttps(url);
  return (
    <form
      className="grid gap-3 md:grid-cols-[1fr_1.4fr_auto]"
      onSubmit={async (e) => {
        e.preventDefault();
        if (ok) await onSave({ title: title.trim(), url: url.trim() });
      }}
    >
      <div>
        <label className="label">Title (what everyone sees)</label>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. November pubmats" maxLength={200} />
      </div>
      <div>
        <label className="label">Google Drive link</label>
        <input className={`input ${badUrl ? 'border-red-400' : ''}`} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://drive.google.com/drive/folders/…" />
        {badUrl && <p className="mt-1 text-xs text-red-600">The link should start with https://</p>}
      </div>
      <div className="flex items-end gap-2">
        {onCancel && <button type="button" className="btn-secondary" onClick={onCancel}><X className="h-4 w-4" /></button>}
        <button className="btn-primary" disabled={!ok || busy}>
          {saveLabel === 'Add' ? <Plus className="h-4 w-4" /> : <Check className="h-4 w-4" />} {saveLabel}
        </button>
      </div>
    </form>
  );
}

function LinkCard({ link, isAdmin }) {
  const [editing, setEditing] = useState(false);
  const save = useAdminMutation((body) => api.patch(`/drive-links/${link.id}`, body), ['driveLinks'], 'Drive link saved');
  const del = useAdminMutation(() => api.delete(`/drive-links/${link.id}`), ['driveLinks'], 'Drive link removed');
  const kind = KIND[driveInfo(link.url).kind];

  if (editing) {
    return (
      <div className="card p-4 md:col-span-2 xl:col-span-3">
        <LinkForm initial={link} saveLabel="Save" busy={save.isPending} onCancel={() => setEditing(false)} onSave={async (b) => { await save.mutateAsync(b); setEditing(false); }} />
      </div>
    );
  }
  return (
    <article className="card group flex items-start gap-3 p-4 transition-colors hover:border-brand-500/40">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${kind.cls}`}>
        <kind.icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <a href={link.url} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1.5 text-base font-semibold break-words text-brand-700 hover:underline">
          <span className="min-w-0">{link.title}</span>
          <ExternalLink className="h-4 w-4 shrink-0 opacity-60" />
        </a>
        <p className="mt-0.5 text-xs text-slate-500">{kind.label}</p>
      </div>
      {isAdmin && (
        <div className="flex shrink-0 gap-1">
          <button className="btn-ghost p-1.5" title="Edit" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /></button>
          <button className="btn-ghost p-1.5 text-red-600" title="Remove" disabled={del.isPending} onClick={() => confirm(`Remove “${link.title}”? The Drive folder itself is not touched.`) && del.mutate()}>
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}
    </article>
  );
}

export default function DriveLinksPage() {
  const { slug } = useParams();
  const { isAdmin } = useAuth();
  const { data: client, isLoading } = useClient(slug);
  const { data: links = [], isLoading: loadingLinks } = useDriveLinks(client?.id);
  const add = useAdminMutation((body) => api.post('/drive-links', body), ['driveLinks'], 'Drive link added');
  const [formKey, setFormKey] = useState(0);

  if (isLoading) return <FullPageSpinner />;
  if (!client) return <EmptyState icon={FolderOpen} title="Client not found">You may not have access to this calendar.</EmptyState>;

  return (
    <div className="flex min-h-full flex-col">
      <div className="border-b border-slate-200 bg-white">
        <div className="h-1.5" style={{ background: client.brandColor }} />
        <div className="px-4 py-3 sm:px-6">
          <h1 className="text-lg leading-tight font-semibold tracking-tight text-brand-700 sm:text-xl">Drive links</h1>
          <p className="text-xs text-slate-500">{client.name} · shared Google Drive folders and files</p>
        </div>
      </div>

      <div className="flex-1 space-y-5 p-4 sm:p-6">
        {isAdmin && (
          <section className="card p-5">
            <h2 className="mb-1 text-sm font-semibold text-brand-700">Add a Drive link</h2>
            <p className="mb-3 text-xs text-slate-500">
              Share the folder or file as <b>Anyone with the link</b> (or with the client’s Google account) so everyone can open it and see it in “Add from Drive”.
            </p>
            <LinkForm
              key={formKey}
              saveLabel="Add"
              busy={add.isPending}
              onSave={async (b) => {
                await add.mutateAsync({ clientId: client.id, ...b });
                setFormKey((k) => k + 1);
              }}
            />
          </section>
        )}

        {loadingLinks ? (
          <div className="flex justify-center p-6"><Spinner /></div>
        ) : links.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {links.map((l) => <LinkCard key={l.id} link={l} isAdmin={isAdmin} />)}
          </div>
        ) : (
          <div className="card">
            <EmptyState icon={FolderOpen} title="No Drive links yet">
              {isAdmin ? 'Add the first Drive folder above.' : 'FBS hasn’t shared any Drive folders yet.'}
            </EmptyState>
          </div>
        )}
      </div>
    </div>
  );
}
