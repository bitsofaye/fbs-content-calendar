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
