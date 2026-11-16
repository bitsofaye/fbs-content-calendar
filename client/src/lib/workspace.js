import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

// Which calendar the admin is working in. Taken from the page (/c/<slug>…) when there is one,
// otherwise the last one used in this browser, otherwise FBS's own calendar.
export const HOME_SLUG = 'fbs';

export function homeClient(clients) {
  return clients.find((c) => c.slug === HOME_SLUG) || clients[0] || null;
}

export function useWorkspace(clients, userId) {
  const { pathname } = useLocation();
  const routeSlug = pathname.startsWith('/c/') ? pathname.split('/')[2] : null;
  const key = `cc.workspace.${userId || 'anon'}`;
  const [remembered, setRemembered] = useState(() => {
    try {
      return localStorage.getItem(key) || '';
    } catch {
      return '';
    }
  });
  useEffect(() => {
    if (!routeSlug) return;
    setRemembered(routeSlug);
    try {
      localStorage.setItem(key, routeSlug);
    } catch {
      /* storage blocked */
    }
  }, [routeSlug, key]);
  // another calendar picked in the sidebar card (see useWorkspacePicker)
  useEffect(() => {
    const onPick = (e) => setRemembered(e.detail);
    window.addEventListener('cc-workspace-changed', onPick);
    return () => window.removeEventListener('cc-workspace-changed', onPick);
  }, []);
  const slug = routeSlug || remembered;
  return clients.find((c) => c.slug === slug) || homeClient(clients);
}

/** Like useWorkspace, plus a way to pick another calendar without opening it (the dashboard's sidebar card). */
export function useWorkspacePicker(clients, userId) {
  const key = `cc.workspace.${userId || 'anon'}`;
  const workspace = useWorkspace(clients, userId);
  const choose = (slug) => {
    try {
      localStorage.setItem(key, slug);
    } catch {
      /* storage blocked */
    }
    window.dispatchEvent(new CustomEvent('cc-workspace-changed', { detail: slug }));
  };
  return [workspace, choose];
}
