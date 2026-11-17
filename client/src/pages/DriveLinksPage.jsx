import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, ExternalLink, FileText, FolderOpen, Globe, Link2, Palette, Pencil, PlayCircle, Plus, Trash2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAdminMutation, useClient, useDriveLinks } from '../api/hooks';
import { api } from '../lib/api';
import { driveInfo } from '../lib/drive';
import { EmptyState, FullPageSpinner, Spinner } from '../components/ui';

const isLink = (s) => /^https?:\/\/\S+$/i.test(String(s || '').trim());

// What a link points to, for its icon and the small line under the title
function describe(url) {
  const d = driveInfo(url);
  if (d.kind === 'folder') return { icon: FolderOpen, label: 'Drive folder', cls: 'bg-amber-50 text-amber-700' };
  if (d.kind === 'file') return { icon: FileText, label: 'Drive file', cls: 'bg-sky-50 text-sky-700' };
  if (d.kind === 'doc') return { icon: FileText, label: 'Google Docs / Slides / Sheets', cls: 'bg-emerald-50 text-emerald-700' };
  let host = '';
  try {
    host = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return { icon: Link2, label: 'Link', cls: 'bg-slate-100 text-slate-600' };
  }
  if (/\.pdf($|\?)/i.test(url)) return { icon: FileText, label: `PDF · ${host}`, cls: 'bg-red-50 text-red-700' };
  if (host.endsWith('canva.com')) return { icon: Palette, label: 'Canva design', cls: 'bg-violet-50 text-violet-700' };
  if (/youtube\.com$|youtu\.be$|vimeo\.com$|tiktok\.com$/.test(host)) return { icon: PlayCircle, label: `Video · ${host}`, cls: 'bg-rose-50 text-rose-700' };
  if (/dropbox|onedrive|sharepoint|notion|figma|docs\.|sheets\./.test(host)) return { icon: FileText, label: host, cls: 'bg-sky-50 text-sky-700' };
  return { icon: Globe, label: `Website · ${host}`, cls: 'bg-teal-50 text-teal-700' };
}

// Text for the two kinds of link pages
const KINDS = {
  DRIVE: {
    title: 'Drive links',
    subtitle: 'shared Google Drive folders and files',
    addTitle: 'Add a Drive link',
    help: 'Share the folder or file as “Anyone with the link” (or with the right Google accounts) so everyone can open it and pick from it in “Add from Drive”.',
    urlLabel: 'Google Drive link',
    urlPlaceholder: 'https://drive.google.com/drive/folders/…',
    titlePlaceholder: 'e.g. November pubmats',
    empty: 'No Drive links yet',
    emptyHint: 'Add the first Drive folder above.',
    icon: FolderOpen,
  },
  FILE: {
    title: 'File links',
    subtitle: 'useful files, websites, references and online documents',
    addTitle: 'Add a file or website link',
    help: 'Any link that helps with the content: brand guidelines, a website, an article, a PDF, a Canva design, a reference post or an online document.',
    urlLabel: 'Link',
    urlPlaceholder: 'https://…',
    titlePlaceholder: 'e.g. Brand guidelines (PDF)',
    empty: 'No file links yet',
    emptyHint: 'Add the first link above.',
    icon: Link2,
  },
};

function LinkForm({ initial = { title: '', url: '' }, onSave, onCancel, busy, saveLabel, text }) {
  const [title, setTitle] = useState(initial.title);
  const [url, setUrl] = useState(initial.url);
  const badUrl = url.trim() && !isLink(url);
  const ok = title.trim() && isLink(url);
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
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={text.titlePlaceholder} maxLength={200} />
      </div>
      <div>
        <label className="label">{text.urlLabel}</label>
        <input className={`input ${badUrl ? 'border-red-400' : ''}`} value={url} onChange={(e) => setUrl(e.target.value)} placeholder={text.urlPlaceholder} />
        {badUrl && <p className="mt-1 text-xs text-red-600">The link should start with https://</p>}
      </div>
      <div className="flex items-end gap-2">
        {onCancel && <button type="button" className="btn-secondary" onClick={onCancel} aria-label="Cancel"><X className="h-4 w-4" /></button>}
        <button className="btn-primary" disabled={!ok || busy}>
          {saveLabel === 'Add' ? <Plus className="h-4 w-4" /> : <Check className="h-4 w-4" />} {saveLabel}
        </button>
      </div>
    </form>
  );
}

function LinkCard({ link, canChange, text }) {
  const [editing, setEditing] = useState(false);
  const save = useAdminMutation((body) => api.patch(`/drive-links/${link.id}`, body), ['driveLinks'], 'Link saved');
  const del = useAdminMutation(() => api.delete(`/drive-links/${link.id}`), ['driveLinks'], 'Link removed');
  const info = describe(link.url);
  const by = link.createdBy;

  if (editing) {
    return (
      <div className="card p-4 md:col-span-2 xl:col-span-3">
        <LinkForm initial={link} text={text} saveLabel="Save" busy={save.isPending} onCancel={() => setEditing(false)} onSave={async (b) => { await save.mutateAsync(b); setEditing(false); }} />
      </div>
    );
  }
  return (
    <article className="card group flex items-start gap-3 p-4 transition-colors hover:border-brand-500/40">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${info.cls}`}>
        <info.icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <a href={link.url} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1.5 text-base font-semibold break-words text-brand-700 hover:underline">
          <span className="min-w-0">{link.title}</span>
          <ExternalLink className="h-4 w-4 shrink-0 opacity-60" />
        </a>
        <p className="mt-0.5 truncate text-xs text-slate-500">{info.label}</p>
        {by && (
          <p className="mt-0.5 text-[11px] text-slate-500">
            Added by {by.name}
            {by.role === 'CLIENT' && <span className="ml-1 rounded bg-amber-50 px-1 font-medium text-amber-800">client</span>}
          </p>
        )}
      </div>
      {canChange && (
        <div className="flex shrink-0 gap-1">
          <button className="btn-ghost p-1.5" title="Edit" aria-label="Edit" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /></button>
          <button
            className="btn-ghost p-1.5 text-red-600"
            title="Remove"
            aria-label="Remove"
            disabled={del.isPending}
            onClick={() => confirm(`Remove “${link.title}”? Only the link is removed; the file or page itself is not touched.`) && del.mutate()}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}
    </article>
  );
}

/** One links page of a calendar: kind DRIVE (Drive links) or FILE (File links). FBS and the client can both add. */
export function LinksPage({ kind }) {
  const text = KINDS[kind];
  const { slug } = useParams();
  const { isAdmin, user } = useAuth();
  const { data: client, isLoading } = useClient(slug);
  const { data: links = [], isLoading: loadingLinks } = useDriveLinks(client?.id, kind);
  const add = useAdminMutation((body) => api.post('/drive-links', body), ['driveLinks'], 'Link added');
  const [formKey, setFormKey] = useState(0);

  if (isLoading) return <FullPageSpinner />;
  if (!client) return <EmptyState icon={text.icon} title="Client not found">You may not have access to this calendar.</EmptyState>;

  return (
    <div className="flex min-h-full flex-col">
      <div className="border-b border-slate-200 bg-white">
        <div className="h-1.5" style={{ background: client.secondaryColor ? `linear-gradient(90deg, ${client.brandColor} 50%, ${client.secondaryColor} 50%)` : client.brandColor }} />
        <div className="px-4 py-3 sm:px-6">
          <h1 className="text-lg leading-tight font-semibold tracking-tight text-brand-700 sm:text-xl">{text.title}</h1>
          <p className="text-xs text-slate-500">{client.name} · {text.subtitle}</p>
        </div>
      </div>

      <div className="flex-1 space-y-5 p-4 sm:p-6">
        <section className="card p-5">
          <h2 className="mb-1 text-sm font-semibold text-brand-700">{text.addTitle}</h2>
          <p className="mb-3 text-xs text-slate-500">
            {text.help} {isAdmin ? 'The client can see these links and add their own.' : 'FBS sees every link you add.'}
          </p>
          <LinkForm
            key={formKey}
            text={text}
            saveLabel="Add"
            busy={add.isPending}
            onSave={async (b) => {
              await add.mutateAsync({ clientId: client.id, kind, ...b });
              setFormKey((k) => k + 1);
            }}
          />
        </section>

        {loadingLinks ? (
          <div className="flex justify-center p-6"><Spinner /></div>
        ) : links.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {links.map((l) => (
              <LinkCard key={l.id} link={l} text={text} canChange={isAdmin || l.createdById === user?.id} />
            ))}
          </div>
        ) : (
          <div className="card">
            <EmptyState icon={text.icon} title={text.empty}>{text.emptyHint}</EmptyState>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DriveLinksPage() {
  return <LinksPage kind="DRIVE" />;
}

export function FileLinksPage() {
  return <LinksPage kind="FILE" />;
}
