import { useState } from 'react';
import { ExternalLink, FileText, Folder, ImageOff, Link2, PlayCircle } from 'lucide-react';

// Turns a pubmat / reference link into something you can look at:
//   pictures and videos (direct files), Google Drive & Docs files, Canva designs, YouTube.
// Anything else is shown as a link card. Previews only work when the file is shared ("anyone with the link").
export function describeLink(raw) {
  const url = String(raw || '').trim();
  if (!/^https?:\/\//i.test(url)) return null;
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, '');
  const path = u.pathname;

  if (/\.(png|jpe?g|gif|webp|avif|svg)$/i.test(path)) return { kind: 'image', url, src: url, label: 'Image' };
  if (/\.(mp4|webm|mov|m4v)$/i.test(path)) return { kind: 'video', url, src: url, label: 'Video' };

  if (host === 'drive.google.com' || host === 'docs.google.com') {
    if (/\/folders\//.test(path)) return { kind: 'card', url, icon: Folder, label: 'Google Drive folder' };
    const id = path.match(/\/d\/([\w-]{10,})/)?.[1] || u.searchParams.get('id');
    if (id) {
      const label = host === 'docs.google.com' ? (path.includes('/presentation/') ? 'Google Slides' : path.includes('/spreadsheets/') ? 'Google Sheets' : 'Google Docs') : 'Google Drive file';
      return { kind: 'image', url, src: `https://drive.google.com/thumbnail?id=${id}&sz=w1000`, label };
    }
    return { kind: 'card', url, icon: FileText, label: 'Google Drive' };
  }

  if (host.endsWith('canva.com')) {
    const id = path.match(/\/design\/([\w-]+)/)?.[1];
    if (id) return { kind: 'frame', url, src: `https://www.canva.com/design/${id}/view?embed`, label: 'Canva design' };
    return { kind: 'card', url, icon: Link2, label: 'Canva' };
  }

  const yt = host === 'youtu.be' ? path.slice(1) : /youtube\.com$/.test(host) ? u.searchParams.get('v') || path.match(/\/(shorts|embed|live)\/([\w-]+)/)?.[2] : null;
  if (yt) return { kind: 'image', url, src: `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`, label: 'YouTube video', play: true };

  return { kind: 'card', url, icon: Link2, label: host };
}

function Frame({ item, i, total }) {
  const [failed, setFailed] = useState(false);
  const name = `${item.label}${total > 1 ? ` · ${i + 1}` : ''}`;

  let body;
  if (item.kind === 'image' && !failed) {
    body = (
      <div className="relative flex max-h-80 items-center justify-center overflow-hidden bg-slate-100">
        <img src={item.src} alt={name} loading="lazy" referrerPolicy="no-referrer" className="max-h-80 w-full object-contain" onError={() => setFailed(true)} />
        {item.play && <PlayCircle className="absolute h-12 w-12 text-white drop-shadow-lg" />}
      </div>
    );
  } else if (item.kind === 'video') {
    body = <video src={item.src} controls preload="metadata" className="max-h-80 w-full bg-black" />;
  } else if (item.kind === 'frame') {
    body = <iframe src={item.src} title={name} loading="lazy" allowFullScreen className="aspect-square max-h-96 w-full border-0 bg-slate-100" />;
  } else {
    const Icon = failed ? ImageOff : item.icon || Link2;
    body = (
      <div className="flex items-center gap-3 bg-slate-50 px-4 py-5">
        <Icon className="h-6 w-6 shrink-0 text-slate-400" />
        <p className="min-w-0 text-xs text-slate-500">
          {failed ? 'No preview: the file may not be shared with “Anyone with the link”. Open it to view.' : 'No preview for this kind of link. Open it to view.'}
        </p>
      </div>
    );
  }

  return (
    <figure className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      {body}
      <figcaption className="flex items-center gap-2 border-t border-slate-100 px-3 py-2 text-xs">
        <span className="font-medium text-slate-700">{name}</span>
        <a href={item.url} target="_blank" rel="noreferrer" className="ml-auto inline-flex min-w-0 items-center gap-1 text-brand-600 hover:underline">
          <span className="truncate">Open</span> <ExternalLink className="h-3.5 w-3.5 shrink-0" />
        </a>
      </figcaption>
    </figure>
  );
}

/** Previews of every link in `links` (array or newline/comma separated text). */
export default function MaterialPreview({ links, title = 'Preview of attached materials' }) {
  const list = (Array.isArray(links) ? links : String(links || '').split(/[\n,]+/)).map(describeLink).filter(Boolean);
  if (!list.length) return null;
  return (
    <div>
      <div className="label">{title}</div>
      <div className={`grid gap-3 ${list.length > 1 ? 'sm:grid-cols-2' : ''}`}>
        {list.map((item, i) => <Frame key={`${item.url}-${i}`} item={item} i={i} total={list.length} />)}
      </div>
    </div>
  );
}
