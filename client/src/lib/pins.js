// Pinned clients: a per-person shortcut list kept in this browser.
// It is only a convenience — if storage is unavailable the app still works, nothing is pinned.
import { useCallback, useEffect, useState } from 'react';

const EVENT = 'cc-pins-changed';
const keyFor = (userId) => `cc.pins.${userId || 'anon'}`;
const viewsKeyFor = (userId) => `cc.pinViews.${userId || 'anon'}`;

// The pages of a calendar a pinned client can open on
export const CALENDAR_PAGES = [
  { id: 'daily', label: "What's today" },
  { id: 'calendar', label: 'Calendar' },
  { id: 'sheet', label: 'Content plan' },
  { id: 'board', label: 'Board' },
  { id: 'ideas', label: 'Idea bank' },
  { id: 'results', label: 'Results' },
  { id: 'drive', label: 'Drive links' },
];
export const DEFAULT_PAGE = 'calendar';

/** The address of one page of a client's calendar. */
export function calendarPagePath(slug, page) {
  if (page === 'results' || page === 'drive') return `/c/${slug}/${page}`;
  if (!page || page === 'calendar') return `/c/${slug}`;
  return `/c/${slug}?view=${page}`;
}

function read(userId) {
  try {
    const v = JSON.parse(localStorage.getItem(keyFor(userId)) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function readViews(userId) {
  try {
    const v = JSON.parse(localStorage.getItem(viewsKeyFor(userId)) || '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage blocked: pins just won't persist */
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}

const write = (userId, ids) => save(keyFor(userId), ids);

export function usePins(userId) {
  const [pins, setPins] = useState(() => read(userId));
  const [views, setViews] = useState(() => readViews(userId));
  useEffect(() => {
    const sync = () => {
      setPins(read(userId));
      setViews(readViews(userId));
    };
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, [userId]);

  // pin / unpin; pinning can say right away which page the pin opens
  const toggle = useCallback(
    (id, page) => {
      const cur = read(userId);
      if (!cur.includes(id) && page) save(viewsKeyFor(userId), { ...readViews(userId), [id]: page });
      write(userId, cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
    },
    [userId],
  );

  // which page a pinned client opens on
  const setPage = useCallback(
    (id, page) => save(viewsKeyFor(userId), { ...readViews(userId), [id]: page }),
    [userId],
  );
  const pageOf = (id) => (CALENDAR_PAGES.some((p) => p.id === views[id]) ? views[id] : DEFAULT_PAGE);

  return { pins, isPinned: (id) => pins.includes(id), toggle, pageOf, setPage };
}

// open the client switcher from anywhere (sidebar, dashboard header, Ctrl+K)
export const openClientSwitcher = () => window.dispatchEvent(new CustomEvent('cc-open-switcher'));
