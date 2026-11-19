// What kind of Google Drive link is this? (folder / file / doc / other) and its id
export function driveInfo(raw) {
  let u;
  try {
    u = new URL(String(raw || '').trim());
  } catch {
    return { kind: 'other', id: null };
  }
  const host = u.hostname.replace(/^www\./, '');
  if (host !== 'drive.google.com' && host !== 'docs.google.com') return { kind: 'other', id: null };
  const folder = u.pathname.match(/\/folders\/([\w-]{10,})/)?.[1];
  if (folder) return { kind: 'folder', id: folder };
  const id = u.pathname.match(/\/d\/([\w-]{10,})/)?.[1] || u.searchParams.get('id');
  if (host === 'docs.google.com') return { kind: 'doc', id };
  return { kind: id ? 'file' : 'other', id };
}

// Google's own "folder view" that can be shown inside the app (needs "Anyone with the link" sharing)
export const folderEmbedUrl = (id) => `https://drive.google.com/embeddedfolderview?id=${id}#grid`;

export const isHttps = (s) => /^https:\/\/\S+$/i.test(String(s || '').trim());

/**
 * Google's viewer address for a Drive file or a Docs / Sheets / Slides file, so it can be shown inside the app.
 * Nothing is copied: the file is streamed from Google Drive. Null for folders and non-Google links.
 */
export function driveEmbedUrl(raw) {
  const info = driveInfo(raw);
  if (!info.id) return null;
  if (info.kind === 'file') return `https://drive.google.com/file/d/${info.id}/preview`;
  if (info.kind === 'doc') {
    const type = new URL(String(raw).trim()).pathname.match(/^\/(document|spreadsheets|presentation|forms)\//)?.[1];
    if (type === 'forms') return `https://docs.google.com/forms/d/${info.id}/viewform?embedded=true`;
    return `https://docs.google.com/${type || 'document'}/d/${info.id}/preview`;
  }
  return null;
}

/** Can this link be opened inside the app (a Drive file / folder or a Google Docs file)? */
export const opensInApp = (raw) => {
  const info = driveInfo(raw);
  return info.kind === 'folder' ? Boolean(info.id) : Boolean(driveEmbedUrl(raw));
};

/** Open a Drive link in the app's viewer (the viewer is mounted once, in the page layout). */
export function openInApp(url, { title, clientId } = {}) {
  window.dispatchEvent(new CustomEvent('cc-open-drive', { detail: { url, title, clientId } }));
}
