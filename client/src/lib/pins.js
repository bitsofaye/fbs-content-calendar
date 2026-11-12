// Pinned clients: a per-person shortcut list kept in this browser.
// It is only a convenience — if storage is unavailable the app still works, nothing is pinned.
import { useCallback, useEffect, useState } from 'react';

const EVENT = 'cc-pins-changed';
const keyFor = (userId) => `cc.pins.${userId || 'anon'}`;

function read(userId) {
  try {
    const v = JSON.parse(localStorage.getItem(keyFor(userId)) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function write(userId, ids) {
  try {
    localStorage.setItem(keyFor(userId), JSON.stringify(ids));
  } catch {
    /* storage blocked: pins just won't persist */
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function usePins(userId) {
  const [pins, setPins] = useState(() => read(userId));
  useEffect(() => {
    const sync = () => setPins(read(userId));
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, [userId]);

  const toggle = useCallback(
    (id) => {
      const cur = read(userId);
      write(userId, cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
    },
    [userId],
  );

  return { pins, isPinned: (id) => pins.includes(id), toggle };
}

// open the client switcher from anywhere (sidebar, dashboard header, Ctrl+K)
export const openClientSwitcher = () => window.dispatchEvent(new CustomEvent('cc-open-switcher'));
