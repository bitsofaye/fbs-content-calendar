import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ExternalLink, FileText, FolderOpen, Link2, Plus } from 'lucide-react';
import { useDriveLinks } from '../api/hooks';
import { driveInfo, folderEmbedUrl, isHttps } from '../lib/drive';
import { Modal, Spinner } from './ui';

const ICON = { folder: FolderOpen, file: FileText, doc: FileText, other: Link2 };

/**
 * "Add from Drive": pick saved Drive links of this client, or browse a shared folder and paste a file's link.
 * onAdd(urls[]) receives the links to add to the post.
 */
export default function DrivePicker({ open, onClose, client, isAdmin, onAdd }) {
  const { data: links = [], isLoading } = useDriveLinks(open ? client.id : null);
  const [picked, setPicked] = useState(() => new Set());
  const [browsing, setBrowsing] = useState(null); // a Drive link whose folder is shown
  const [pasted, setPasted] = useState('');

  const close = () => {
    setPicked(new Set());
    setBrowsing(null);
    setPasted('');
    onClose();
  };
  const toggle = (id) => setPicked((s) => {
    const n = new Set(s);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });
  const addPicked = () => {
    onAdd(links.filter((l) => picked.has(l.id)).map((l) => l.url));
    close();
  };
  const addPasted = () => {
    onAdd([pasted.trim()]);
    close();
  };

  const folderId = browsing ? driveInfo(browsing.url).id : null;

  return (
    <Modal
      open={open}
      onClose={close}
      wide
      title={browsing ? browsing.title : 'Add from Drive'}
      footer={
        browsing ? (
          <div className="flex w-full flex-wrap items-center gap-2">
            <button className="btn-secondary" onClick={() => { setBrowsing(null); setPasted(''); }}>
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <input
              className={`input min-w-[220px] flex-1 ${pasted.trim() && !isHttps(pasted) ? 'border-red-400' : ''}`}
              placeholder="Paste the link of a file from this folder"
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
            />
            <button className="btn-primary" disabled={!isHttps(pasted)} onClick={addPasted}>
              <Plus className="h-4 w-4" /> Add file
            </button>
          </div>
        ) : (
          <>
            <button className="btn-secondary" onClick={close}>Cancel</button>
            <button className="btn-primary" disabled={!picked.size} onClick={addPicked}>
              <Plus className="h-4 w-4" /> Add {picked.size || ''} selected
            </button>
          </>
        )
      }
    >
      {browsing ? (
        <div className="space-y-2">
          <iframe src={folderEmbedUrl(folderId)} title={browsing.title} className="h-[50vh] w-full rounded-lg border border-slate-200 bg-slate-50" />
          <p className="text-xs text-slate-500">
            Click a file to open it in Drive, copy its link (Share → Copy link) and paste it below. If the folder looks empty, it isn’t shared as “Anyone with the link”:{' '}
            <a href={browsing.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-brand-600 hover:underline">
              open it in Drive <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        </div>
      ) : isLoading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : links.length ? (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">Tick the links to add to this post, or <b>Browse</b> a folder to pick one file from it.</p>
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {links.map((l) => {
              const info = driveInfo(l.url);
              const Icon = ICON[info.kind];
              return (
                <li key={l.id} className="flex items-center gap-3 px-3 py-2.5">
                  <input type="checkbox" className="h-4 w-4 accent-[#921259]" checked={picked.has(l.id)} onChange={() => toggle(l.id)} aria-label={`Select ${l.title}`} />
                  <Icon className={`h-5 w-5 shrink-0 ${info.kind === 'folder' ? 'text-amber-500' : 'text-sky-500'}`} />
                  <button type="button" className="min-w-0 flex-1 cursor-pointer text-left text-sm font-medium break-words text-slate-800" onClick={() => toggle(l.id)}>
                    {l.title}
                  </button>
                  {info.kind === 'folder' && info.id && (
                    <button className="btn-secondary px-2.5 py-1 text-xs" onClick={() => setBrowsing(l)}>
                      <FolderOpen className="h-3.5 w-3.5" /> Browse
                    </button>
                  )}
                  <a href={l.url} target="_blank" rel="noreferrer" className="btn-ghost p-1.5" title="Open in Drive"><ExternalLink className="h-4 w-4" /></a>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className="py-6 text-center text-sm text-slate-500">
          No Drive links saved for {client.name} yet.{' '}
          {isAdmin && <Link to={`/c/${client.slug}/drive`} className="font-medium text-brand-600 hover:underline" onClick={close}>Add one on the Drive links page</Link>}
        </p>
      )}
    </Modal>
  );
}
