// All post dates travel as "YYYY-MM-DD" strings; these helpers never involve timezones.

export const pad = (n) => String(n).padStart(2, '0');
export const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`; // m is 1-based

export function parseISO(s) {
  const [y, m, d] = s.split('-').map(Number);
  return { y, m, d };
}

export function todayISO() {
  const n = new Date();
  return iso(n.getFullYear(), n.getMonth() + 1, n.getDate());
}

export function addDays(s, days) {
  const { y, m, d } = parseISO(s);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return iso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function weekday(s) {
  const { y, m, d } = parseISO(s);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export const monthKey = (s) => s.slice(0, 7); // "2026-02"

export function monthBounds(key) {
  const [y, m] = key.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: iso(y, m, 1), to: iso(y, m, last), year: y, month: m, days: last };
}

export function shiftMonth(key, delta) {
  const [y, m] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}`;
}

/** Weeks (Sun..Sat) covering the month, each day an ISO string. */
export function monthGrid(key) {
  const { from, to } = monthBounds(key);
  const start = addDays(from, -weekday(from));
  const end = addDays(to, 6 - weekday(to));
  const weeks = [];
  let cur = start;
  while (cur <= end) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      week.push(cur);
      cur = addDays(cur, 1);
    }
    weeks.push(week);
  }
  return { weeks, start, end };
}

/** Sun..Sat week containing the date. */
export function weekOf(s) {
  const start = addDays(s, -weekday(s));
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const monthName = (m) => MONTHS[m - 1];
export const monthLabel = (key) => {
  const [y, m] = key.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
};

export function formatDate(s, { withDay = true, withYear = false } = {}) {
  if (!s) return '';
  const { y, m, d } = parseISO(s);
  return `${withDay ? `${SHORT_DAYS[weekday(s)]}, ` : ''}${MONTHS[m - 1].slice(0, 3)} ${d}${withYear ? `, ${y}` : ''}`;
}

export function formatDateTime(isoString) {
  if (!isoString) return '';
  return new Date(isoString).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
