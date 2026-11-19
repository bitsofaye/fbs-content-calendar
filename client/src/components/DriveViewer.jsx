import { useEffect, useState } from 'react';
import { ExternalLink, FileText, FolderOpen, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { driveEmbedUrl, driveInfo, openInApp, opensInApp } from '../lib/drive';
import DriveBrowser from './DriveBrowser';

/**
 * Full-screen viewer for Google Drive links, inside the app (the page behind is blurred).
 * Files, Docs, Sheets and Slides use Google's own viewer; folders use the in-app folder browser.
 * Everything is read straight from Google Drive; nothing is stored in the app's database.
 * Mounted once in the layout; open it with openInApp(url) or <InAppLink>.
 */
export function DriveViewerHost() {
  const { user } = useAuth();
  const [item, setItem] = useState(null); // { url, title, clientId }
  useEffect(() => {
    const onOpen = (e) => setItem(e.detail);
    window.addEventListener('cc-open-drive', onOpen);
    return () => window.removeEventListener('cc-open-drive', onOpen);
  }, []);
  useEffect(() => {
    if (!item) return;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation(); // close only the viewer, not a post window under it
      setItem(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [item]);
  if (!item) return null;

  const info = driveInfo(item.url);
  const embed = driveEmbedUrl(item.url);
  const isFolder = info.kind === 'folder';
  const title = item.title || (isFolder ? 'Drive folder' : 'Drive file');
  const Icon = isFolder ? FolderOpen : FileText;
  return (
    <div className="fixed inset-0 z-[70] flex items-stretch justify-center sm:p-4 lg:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-md" onClick={() => setItem(null)} />
      <div className="relative flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2.5 sm:px-5">
          <Icon className={`h-5 w-5 shrink-0 ${isFolder ? 'text-amber-500' : 'text-sky-600'}`} />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800 sm:text-base">{title}</span>
          <a href={item.url} target="_blank" rel="noreferrer" className="btn-ghost px-2 py-1 text-xs" title="Open in Google Drive (new tab)">
            <ExternalLink className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Open in Google Drive</span>
          </a>
          <button className="btn-ghost p-1.5" onClick={() => setItem(null)} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        {isFolder ? (
          <div className="flex-1 overflow-hidden p-3 sm:p-5">
            <DriveBrowser
              client={{ id: item.clientId || user?.clientId || 'all' }}
              root={{ id: info.id, title, url: item.url }}
              readOnly
              tall
            />
          </div>
        ) : embed ? (
          <iframe key={embed} src={embed} title={title} allow="autoplay; fullscreen" allowFullScreen className="w-full flex-1 border-0 bg-slate-100" />
        ) : (
          <p className="p-8 text-center text-sm text-slate-500">This link can’t be shown inside the app.</p>
        )}
        <p className="border-t border-slate-100 px-4 py-1.5 text-center text-[11px] text-slate-500">
          Shown from Google Drive. If it doesn’t load, the file isn’t shared as “Anyone with the link”, so open it in Google Drive instead.
        </p>
      </div>
    </div>
  );
}

/**
 * A link that opens Drive / Google Docs links inside the app, and anything else in a new tab.
 * Use it instead of <a target="_blank"> wherever a pubmat / Drive link is shown.
 */
export function InAppLink({ href, title, clientId, className, children, ...rest }) {
  if (!opensInApp(href)) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <a
      href={href}
      className={className}
      onClick={(e) => {
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) return; // Ctrl/⌘-click still opens Drive in a new tab
        e.preventDefault();
        e.stopPropagation();
        openInApp(href, { title, clientId });
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
