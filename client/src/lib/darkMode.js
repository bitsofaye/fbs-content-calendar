import { useEffect, useState } from 'react';

// Night mode: remembered per browser; the first time it follows the computer's own light/dark setting.
// index.html applies the saved choice before the page draws, so there is no white flash.
const KEY = 'cc_theme';

export function savedTheme() {
  try {
    const t = localStorage.getItem(KEY);
    if (t === 'dark' || t === 'light') return t;
  } catch {
    /* storage blocked: fall back to the system setting */
  }
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

/** [theme, toggle] — 'light' or 'dark' */
export function useTheme() {
  const [theme, setTheme] = useState(savedTheme);
  useEffect(() => applyTheme(theme), [theme]);
  const toggle = () =>
    setTheme((t) => {
      const next = t === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(KEY, next);
      } catch {
        /* keep it for this visit only */
      }
      return next;
    });
  return [theme, toggle];
}
