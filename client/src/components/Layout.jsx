import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import {
  ArrowLeft, AtSign, BarChart3, Bell, CalendarDays, CheckCircle2, Inbox, CheckSquare, ChevronDown, Link2, RotateCcw, ChevronRight, ChevronsUpDown, Columns3, FileSpreadsheet, FolderOpen, LayoutDashboard, Lightbulb, LogOut, Menu, Moon, Rows3, Search, Settings2, Star, Sun, Table2, Tags,
  UserCircle, Users, X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useClients, useNotifications, useOverview, usePosts } from '../api/hooks';
import { CALENDAR_PAGES, calendarPagePath, openClientSwitcher, usePins } from '../lib/pins';
import { HOME_SLUG, useWorkspace } from '../lib/workspace';
import ClientSwitcher from './ClientSwitcher';
import { ClientMark } from './ui';
import { textOn, useBrandTheme } from '../lib/theme';
import { useTheme } from '../lib/darkMode';

const navCls = ({ isActive }) =>
  `flex items-center gap-2.5 rounded-lg border-l-[3px] px-2.5 py-1.5 text-sm transition-colors ${
    isActive ? 'border-brand-900 bg-brand-700 font-medium text-white shadow-sm' : 'border-transparent text-slate-600 hover:bg-brand-50 hover:text-brand-700'
  }`;

const sectionCls = 'mb-1.5 px-2.5 text-[11px] font-medium tracking-[0.08em] text-slate-500 uppercase';
const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform);


const stop = (e) => e.stopPropagation(); // clicks that should keep the phone menu open

// The coloured side bar of a calendar card: main colour on top, second colour below
const brandBar = (c) => ({
  background: `linear-gradient(${c?.brandColor || '#cbd5e1'} 50%, ${c?.secondaryColor || c?.brandColor || '#cbd5e1'} 50%)`,
});

// Dashboard sidebar: the last calendar used, shown as a card (like inside a calendar). Clicking the card
// opens it; the arrow drops down every other client, and clicking one opens that client's calendar.
// Inside a calendar the same card keeps that client on top, and its arrow switches to another calendar.
function CalendarCard({ client, clients, pins }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const page = pins.pageOf(client.id);
  const pageLabel = CALENDAR_PAGES.find((p) => p.id === page)?.label;
  const s = q.trim().toLowerCase();
  const others = clients
    .filter((c) => c.id !== client.id)
    .filter((c) => !s || c.name.toLowerCase().includes(s) || (c.industry || '').toLowerCase().includes(s))
    .sort((a, b) => Number(pins.isPinned(b.id)) - Number(pins.isPinned(a.id)) || a.name.localeCompare(b.name));
  const firstUnpinned = others.findIndex((c) => !pins.isPinned(c.id));

  return (
    <div>
      <div className={`relative flex overflow-hidden rounded-xl border bg-slate-50 transition-colors ${open ? 'border-brand-200' : 'border-slate-200 hover:border-brand-200'}`}>
        <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={brandBar(client)} />
        <Link to={calendarPagePath(client.slug, page)} className="min-w-0 flex-1 py-3 pr-1 pl-4" title={`Open ${client.name} · ${pageLabel}`}>
          <div className="eyebrow">{client.slug === 'fbs' ? 'FBS calendar' : 'Client calendar'}</div>
          <div className="mt-1 flex items-start gap-2">
            {client.logoUrl && <ClientMark client={client} size="h-7 w-7" />}
            <div className="min-w-0">
              <div className="text-sm leading-snug font-semibold break-words text-slate-800">{client.name}</div>
              {client.industry && <div className="text-[11px] text-slate-500">{client.industry}</div>}
              {page !== 'calendar' && <div className="text-[10px] text-slate-500">Opens on {pageLabel}</div>}
            </div>
          </div>
        </Link>
        <button
          type="button"
          className={`flex w-8 shrink-0 cursor-pointer items-center justify-center ${open ? 'text-brand-700' : 'text-slate-500 hover:bg-brand-50 hover:text-brand-700'}`}
          aria-expanded={open}
          aria-label={open ? 'Hide other clients' : 'Show other clients'}
          title="Other clients"
          onClick={(e) => {
            stop(e);
            setOpen((v) => !v);
          }}
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && (
        <div className="mt-1.5 rounded-xl border border-slate-200 bg-white p-1.5 shadow-card">
          {/* every other client: clicking one opens its calendar (come back to the Dashboard to switch again) */}
          <div className="px-1.5 pt-0.5 pb-1 text-[10px] font-medium tracking-[0.08em] text-slate-500 uppercase">
            Switch calendar · {clients.length - 1}
          </div>
          {clients.length > 7 && (
            <div className="relative mb-1">
              <Search className="pointer-events-none absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                className="w-full rounded-md border border-slate-200 bg-white py-1 pr-2 pl-7 text-[12px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-brand-500"
                placeholder="Search clients…"
                value={q}
                onClick={stop}
                onKeyDown={stop}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          )}
          <ul className="max-h-64 space-y-0.5 overflow-y-auto">
            {others.map((c, i) => {
              const pinned = pins.isPinned(c.id);
              return (
                <li key={c.id}>
                  {i === firstUnpinned && firstUnpinned > 0 && <div className="mx-2 my-1 border-t border-dashed border-slate-200" />}
                  <div className="flex items-center gap-0.5">
                    <Link
                      to={calendarPagePath(c.slug, pins.pageOf(c.id))}
                      className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1 text-[13px] text-slate-600 hover:bg-brand-50 hover:text-brand-700"
                      title={`Open ${c.name}`}
                    >
                      <ClientMark client={c} />
                      <span className="min-w-0 flex-1 leading-snug break-words">{c.name}</span>
                    </Link>
                    <button
                      type="button"
                      className={`flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded ${pinned ? 'text-brand-600' : 'text-slate-400 hover:text-brand-700'}`}
                      title={pinned ? 'Pinned: listed first. Click to unpin' : 'Pin: list this client first'}
                      aria-label={pinned ? `Unpin ${c.name}` : `Pin ${c.name}`}
                      aria-pressed={pinned}
                      onClick={(e) => {
                        stop(e);
                        pins.toggle(c.id);
                      }}
                    >
                      <Star className="h-3.5 w-3.5" fill={pinned ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                </li>
              );
            })}
            {!others.length && <li className="px-2 py-2 text-[12px] text-slate-500">{s ? 'No client matches.' : 'No other clients yet.'}</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

// A sidebar link to one view of a calendar (?view=…). Active only when that view is open.
function ViewLink({ slug, view, icon: Icon, children }) {
  const { pathname, search } = useLocation();
  const current = new URLSearchParams(search).get('view') || 'calendar';
  const active = pathname === `/c/${slug}` && current === view;
  return (
    <NavLink to={`/c/${slug}${view === 'calendar' ? '' : `?view=${view}`}`} className={() => navCls({ isActive: active })}>
      <Icon className="h-4 w-4" /> {children}
    </NavLink>
  );
}

// "What's today": the headline button on top of a calendar's buttons
// With `all` (FBS team on the dashboards) it opens today across every calendar instead of one client's.
function TodayLink({ slug, all = false }) {
  const { pathname, search } = useLocation();
  const active = all ? pathname === '/admin/today' : pathname === `/c/${slug}` && new URLSearchParams(search).get('view') === 'daily';
  return (
    <Link
      to={all ? '/admin/today' : `/c/${slug}?view=daily`}
      title={all ? 'Today on every calendar, FBS included' : undefined}
      className={`mb-1.5 flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[15px] font-semibold tracking-tight transition-colors ${
        active
          ? 'bg-gradient-to-br from-brand-800 to-brand-700 text-white shadow-sm'
          : 'border border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100'
      }`}
    >
      <Sun className="h-[18px] w-[18px]" /> What's today
    </Link>
  );
}

// The buttons of one calendar — shared by the FBS team (any client) and client logins (their own)
function CalendarLinks({ slug, showBoard, ideaAlerts = 0 }) {
  return (
    <div className="space-y-3">
      <TodayLink slug={slug} />
      <div>
        <div className={sectionCls}>Plan</div>
        <div className="space-y-0.5">
          <ViewLink slug={slug} view="calendar" icon={CalendarDays}>Calendar</ViewLink>
          <ViewLink slug={slug} view="sheet" icon={Table2}>Content plan</ViewLink>
          {showBoard && <ViewLink slug={slug} view="board" icon={Columns3}>Status board</ViewLink>}
        </div>
      </div>
      <div>
        <div className={sectionCls}>Ideas & files</div>
        <div className="space-y-0.5">
          <ViewLink slug={slug} view="ideas" icon={Lightbulb}>
            <span className="flex-1">Idea bank</span>
            {ideaAlerts > 0 && <span className="rounded-full bg-amber-400 px-1.5 text-[11px] font-semibold text-amber-950 tabular-nums" title="Ideas that need attention">{ideaAlerts}</span>}
          </ViewLink>
          <NavLink to={`/c/${slug}/drive`} className={navCls}>
            <FolderOpen className="h-4 w-4" /> Drive links
          </NavLink>
          <NavLink to={`/c/${slug}/files`} className={navCls}>
            <Link2 className="h-4 w-4" /> File links
          </NavLink>
        </div>
      </div>
      <div>
        <div className={sectionCls}>Report</div>
        <NavLink to={`/c/${slug}/results`} className={navCls}>
          <BarChart3 className="h-4 w-4" /> Results
        </NavLink>
      </div>
    </div>
  );
}

// Dashboard and Approvals stay at the top of the sidebar on every page, inside a calendar too
function MainLinks({ isAdmin = false, clientId }) {
  const { data: overview } = useOverview({ enabled: isAdmin });
  const { data: waiting = [] } = usePosts({ clientId, status: 'FOR_APPROVAL', limit: 300 }, { enabled: !isAdmin && !!clientId });
  const { user } = useAuth();
  const approvals = isAdmin ? (overview ? (overview.myApprovals?.length || 0) + (overview.myEdits?.length || 0) : 0) : waiting.filter((p) => !p.approver?.id || p.approver.id === user?.id).length;
  return (
    <div className="space-y-0.5">
      <NavLink to={isAdmin ? '/admin' : '/overview'} end className={navCls}>
        <LayoutDashboard className="h-4 w-4" /> Dashboard
      </NavLink>
      <NavLink to={isAdmin ? '/admin/approvals' : '/approvals'} className={navCls}>
        <CheckSquare className="h-4 w-4" /> <span className="flex-1">Approvals</span>
        {approvals > 0 && <span className="rounded-full bg-brand-500 px-1.5 text-[11px] font-semibold text-white tabular-nums">{approvals}</span>}
      </NavLink>
    </div>
  );
}

// Inside a calendar: the client's name stays pinned on top and only that calendar's buttons show.
// The one way back to the system menu is the Dashboard (here, or the Dashboard icon in the top bar).
function CalendarNav({ slug, isAdmin, clients, user }) {
  const { data: overview } = useOverview({ enabled: isAdmin });
  const client = isAdmin ? clients.find((c) => c.slug === slug) : user?.client;
  const name = client?.name || (isAdmin ? '…' : '');
  const ideaAlerts = isAdmin && client ? (overview?.ideasNeedingAttention || []).filter((p) => p.client.id === client.id).length : 0;
  const pinStore = usePins(user?.id);
  return (
    <>
      <MainLinks isAdmin={isAdmin} clientId={user?.clientId} />
      {/* FBS team: the card's arrow drops down every other calendar to switch to */}
      {isAdmin && client ? (
        <CalendarCard client={client} clients={clients} pins={pinStore} />
      ) : (
      <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50 py-3 pr-3 pl-4">
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-1"
          style={{ background: `linear-gradient(${client?.brandColor || '#cbd5e1'} 50%, ${client?.secondaryColor || client?.brandColor || '#cbd5e1'} 50%)` }}
        />
        <div className="eyebrow">{isAdmin ? (client?.slug === 'fbs' ? 'FBS calendar' : 'Client calendar') : 'My calendar'}</div>
        <div className="mt-1 flex items-start gap-2">
          {client?.logoUrl && <ClientMark client={client} size="h-7 w-7" />}
          <div className="min-w-0">
            <div className="text-sm leading-snug font-semibold break-words text-slate-800">{name}</div>
            {client?.industry && <div className="text-[11px] text-slate-500">{client.industry}</div>}
          </div>
        </div>
      </div>
      )}
      <CalendarLinks slug={slug} showBoard={isAdmin} ideaAlerts={ideaAlerts} />
    </>
  );
}

// FBS team, outside a calendar: the agency-wide pages and the list of calendars to open
function AdminNav({ user, clients, onNavigate }) {
  const pinStore = usePins(user?.id);
  const workspace = useWorkspace(clients, user?.id);
  const switcher = (e) => {
    e.stopPropagation();
    onNavigate?.();
    openClientSwitcher();
  };

  return (
    <>
      <MainLinks isAdmin />

      <div>
        <div className="mb-1.5 flex items-center gap-1.5 pr-1 pl-2.5">
          <span className="text-[11px] font-medium tracking-[0.08em] text-slate-500 uppercase">Calendars</span>
          <span className="rounded-full bg-slate-100 px-1.5 text-[10px] font-medium text-slate-500 tabular-nums">{clients?.length || 0}</span>
          <button
            type="button"
            onClick={switcher}
            title={`Find a client (${isMac ? '⌘K' : 'Ctrl K'})`}
            aria-label="Find a client"
            className="ml-auto cursor-pointer rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <Search className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="space-y-0.5">
          {workspace && <CalendarCard client={workspace} clients={clients} pins={pinStore} />}
        </div>
      </div>

      <div>
        <div className={sectionCls}>Manage</div>
        <div className="space-y-0.5">
          <NavLink to="/admin/clients" className={navCls}>
            <Settings2 className="h-4 w-4" /> Clients
          </NavLink>
          <NavLink to="/admin/pillars" className={navCls}>
            <Tags className="h-4 w-4" /> Pillars & themes
          </NavLink>
          <NavLink to="/admin/users" className={navCls}>
            <Users className="h-4 w-4" /> Users
          </NavLink>
          <NavLink to="/admin/import" className={navCls}>
            <FileSpreadsheet className="h-4 w-4" /> Import CSV
          </NavLink>
        </div>
      </div>
    </>
  );
}

// Client login, outside the calendar: their overview and approvals, and the way into their calendar
function ClientNav({ client, clientId }) {
  if (!client?.slug) return null;
  return (
    <>
      <MainLinks clientId={clientId} />
      <TodayLink slug={client.slug} />
      <div>
        <div className={sectionCls}>My calendar</div>
        <NavLink to={`/c/${client.slug}?view=daily`} className={navCls}>
          <ClientMark client={client} />
          <span className="min-w-0 text-[13px] leading-snug break-words">{client.name}</span>
        </NavLink>
      </div>
    </>
  );
}

// Top of the sidebar: "FBS Content Calendar" with the FBS logo, or, once a client's calendar is open
// (and always for a client's own login), that client's name and logo instead
function BrandHeader({ client }) {
  const fbs = !client || client.slug === HOME_SLUG;
  const color = client?.brandColor || '#921259';
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {fbs || client.logoUrl ? (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#fff] shadow-sm ring-1 ring-slate-200">
          <img src={fbs ? '/brand/fbs-mark.png' : client.logoUrl} alt="" className={fbs ? 'h-6 w-6 object-contain' : 'h-full w-full object-contain'} />
        </span>
      ) : (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold shadow-sm" style={{ background: color, color: textOn(color) }}>
          {(client.name || '?').trim().charAt(0).toUpperCase()}
        </span>
      )}
      <div className="min-w-0 leading-tight">
        <div className="text-sm font-semibold tracking-tight text-slate-800">Content Calendar</div>
        <div className="truncate text-[11px] text-slate-500">{fbs ? 'Frontline Business Solutions' : client.name}</div>
      </div>
    </div>
  );
}

function Sidebar({ onNavigate }) {
  const { user, isAdmin, logout } = useAuth();
  const { data: clients = [] } = useClients();
  // inside a calendar (/c/slug…) the sidebar shows only that calendar's buttons
  const { pathname } = useLocation();
  const calendarSlug = pathname.startsWith('/c/') ? pathname.split('/')[2] : null;

  return (
    <div className="flex h-full flex-col border-r border-slate-200/80 bg-white text-slate-700">
      <div className="flex min-h-12 items-center border-b border-slate-100 px-4 py-2">
        <BrandHeader client={isAdmin ? (calendarSlug ? clients.find((c) => c.slug === calendarSlug) : null) : user?.client} />
      </div>

      <nav className="sidebar-scroll flex-1 space-y-4 overflow-y-auto px-3 py-3" onClick={onNavigate}>
        {calendarSlug ? (
          <CalendarNav slug={calendarSlug} isAdmin={isAdmin} clients={clients} user={user} />
        ) : isAdmin ? (
          <AdminNav user={user} clients={clients} onNavigate={onNavigate} />
        ) : (
          <ClientNav client={user?.client} clientId={user?.clientId} />
        )}
      </nav>

      <div className="border-t border-slate-100 px-3 py-2">
        {calendarSlug ? (
          // inside a calendar the account page is not offered (it belongs to the system menu)
          <div className="flex items-center gap-2.5 px-2.5 py-1.5 text-sm text-slate-600">
            <UserCircle className="h-4 w-4" />
            <span className="min-w-0 flex-1">
              <span className="block truncate">{user?.name}</span>
              <span className="block text-[11px] opacity-70">{isAdmin ? 'FBS team' : 'Client'}</span>
            </span>
          </div>
        ) : (
          <NavLink to="/account" className={navCls} onClick={onNavigate}>
            <UserCircle className="h-4 w-4" />
            <span className="min-w-0 flex-1">
              <span className="block truncate">{user?.name}</span>
              <span className="block text-[11px] opacity-70">{isAdmin ? 'FBS team' : 'Client'}</span>
            </span>
          </NavLink>
        )}
        <button onClick={logout} className="mt-1 flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-800">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </div>
  );
}

const VIEW_LABEL = { calendar: 'Calendar', sheet: 'Content plan', daily: "What's today", board: 'Status board', ideas: 'Idea bank' };
const ADMIN_PAGES = {
  '/admin/today': ["What's today"],
  '/admin/approvals': ['Approvals'],
  '/admin/clients': ['Manage', 'Clients'],
  '/admin/pillars': ['Manage', 'Pillars & themes'],
  '/admin/users': ['Manage', 'Users'],
  '/admin/import': ['Manage', 'Import CSV'],
  '/account': ['My account'],
  '/approvals': ['Approvals'],
  '/results': ['Results'],
};

// Where am I? → a short trail like "Dashboard › Sample Bakery Co. › Content plan"
function useTrail(clients, dashboardPath) {
  const { pathname, search } = useLocation();
  if (pathname === dashboardPath) return [];
  if (pathname.startsWith('/c/')) {
    const [, , slug, sub] = pathname.split('/');
    const c = clients.find((x) => x.slug === slug);
    const view = new URLSearchParams(search).get('view') || 'calendar';
    return [{ label: c?.name || 'Calendar', to: `/c/${slug}` }, { label: sub === 'results' ? 'Results' : sub === 'drive' ? 'Drive links' : sub === 'files' ? 'File links' : VIEW_LABEL[view] || 'Calendar' }];
  }
  return (ADMIN_PAGES[pathname] || []).map((label) => ({ label }));
}

// Bell in the top bar: what needs someone right now, newest first
// Night / day mode switch in the top bar (same for FBS and client logins)
function ThemeToggle() {
  const [theme, toggle] = useTheme();
  const dark = theme === 'dark';
  return (
    <button className="btn-ghost h-8 w-8 p-0" onClick={toggle} aria-label={dark ? 'Switch to day mode' : 'Switch to night mode'} title={dark ? 'Day mode' : 'Night mode'}>
      {dark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
    </button>
  );
}

function NotificationBell() {
  const { isAdmin, user } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { data: overview } = useOverview({ enabled: isAdmin });
  const { data: waitingMine = [] } = usePosts({ clientId: user?.clientId, status: 'FOR_APPROVAL', limit: 100 }, { enabled: !isAdmin });
  const { data: assigned = [] } = useNotifications();
  // "assigned to you" items count as new until the bell is opened
  const seenKey = `cc_seen_assigned_${user?.id}`;
  const [seenAt, setSeenAt] = useState(() => {
    try {
      return localStorage.getItem(seenKey) || '';
    } catch {
      return '';
    }
  });
  useEffect(() => {
    if (!open || !assigned.length) return;
    const latest = assigned[0].at;
    if (latest <= seenAt) return;
    try {
      localStorage.setItem(seenKey, latest);
    } catch {
      /* private mode: just keep it for this visit */
    }
    // keep the "new" marks visible while the bell is open; the count clears next time
    const t = setTimeout(() => setSeenAt(latest), 4000);
    return () => clearTimeout(t);
  }, [open, assigned, seenAt, seenKey]);
  useEffect(() => {
    if (!open) return;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const postLink = (p) => `/c/${p.client.slug}?post=${p.id}${p.date ? `&month=${p.date.slice(0, 7)}` : ''}`;
  // one group of personal notices (newest first), e.g. everything of type "mention"
  const noticeGroup = (title, icon, keep, sub, tab) => {
    const list = assigned.filter(keep);
    return {
      title,
      icon,
      counted: list.filter((a) => a.at > seenAt).length,
      items: list.map((a) => ({ ...a.post, id: a.id, postId: a.post.id, isNew: a.at > seenAt, sub: sub(a), tone: a.status })),
      link: (p) => postLink({ ...p, id: p.postId }) + (tab ? `&ptab=${tab}` : ''),
    };
  };
  const by = (a) => (a.by ? ` by ${a.by}` : '');
  const personal = [
    noticeGroup('Mentioned you', AtSign, (a) => a.type === 'mention', (a) => `${a.by || 'Someone'} mentioned you${a.excerpt ? `: “${a.excerpt}”` : ''}`, 'discussion'),
    noticeGroup(
      'Needs edits',
      RotateCcw,
      (a) => a.type === 'status' && a.status !== 'APPROVED',
      (a) => (a.status === 'REJECTED' ? `Rejected${by(a)}` : `Changes requested${by(a)}`),
      'discussion',
    ),
    noticeGroup('Approved', CheckCircle2, (a) => a.type === 'status' && a.status === 'APPROVED', (a) => `Approved${by(a)}`),
    noticeGroup('Assigned to you', UserCircle, (a) => a.type === 'assigned', (a) => `${a.as === 'approver' ? 'You are the approver' : 'Assigned to you'}${by(a)}`),
  ];
  const groups = isAdmin
    ? [
        ...personal,
        { title: 'Ideas that need attention', icon: Lightbulb, items: overview?.ideasNeedingAttention || [], link: (p) => `/c/${p.client.slug}?view=ideas` },
        { title: 'New posts from clients', icon: Inbox, items: (overview?.clientRequests || []).filter((p) => !p.needsAttention), link: (p) => `/c/${p.client.slug}?post=${p.id}${p.date ? `&month=${p.date.slice(0, 7)}` : ''}` },
        { title: 'Waiting for your approval', icon: CheckSquare, items: overview?.myApprovals || [], link: (p) => `/c/${p.client.slug}?post=${p.id}${p.date ? `&month=${p.date.slice(0, 7)}` : ''}` },
      ]
    : [...personal, { title: 'Waiting for your approval', icon: CheckSquare, items: waitingMine, link: () => '/approvals' }];
  const total = groups.reduce((n, g) => n + (g.counted ?? g.items.length), 0);
  const anything = groups.some((g) => g.items.length);

  return (
    <div ref={ref} className="relative">
      <button className="btn-ghost relative h-8 w-8 p-0" onClick={() => setOpen((v) => !v)} aria-label={`Notifications (${total})`} title="Notifications">
        <Bell className="h-[18px] w-[18px]" />
        {total > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-semibold text-white tabular-nums">{total > 99 ? '99+' : total}</span>
        )}
      </button>
      {open && (
        <div className="absolute top-full right-0 z-50 mt-2 w-[340px] max-w-[calc(100vw-24px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lift">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-brand-700">Notifications</div>
          <div className="max-h-[60vh] overflow-y-auto">
            {!anything && <p className="px-4 py-8 text-center text-sm text-slate-500">You’re all caught up.</p>}
            {groups.filter((g) => g.items.length).map((g) => (
              <div key={g.title} className="border-b border-slate-100 last:border-0">
                <div className="flex items-center gap-1.5 px-4 pt-3 pb-1 eyebrow">
                  <g.icon className="h-3.5 w-3.5" /> {g.title} · {g.items.length}
                </div>
                <ul className="pb-2">
                  {g.items.slice(0, 6).map((p) => (
                    <li key={p.id}>
                      <Link to={g.link(p)} onClick={() => setOpen(false)} className="block px-4 py-2 hover:bg-brand-50">
                        <span className="flex items-start gap-1.5 text-sm font-medium break-words text-slate-800">
                          {p.isNew && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" title="New" />}
                          <span className="min-w-0">{p.title}</span>
                        </span>
                        <span className={`block text-xs ${p.tone === 'APPROVED' ? 'text-emerald-700' : p.tone ? 'text-orange-700' : 'text-slate-500'}`}>
                          {p.client?.name ? `${p.client.name} · ` : ''}
                          {p.sub || (p.createdBy?.name ? `by ${p.createdBy.name}` : p.date ? p.date : 'No date')}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Sticky bar above every page: menu (phones), Back, and the Dashboard › … trail
function TopBar({ onMenu, menuOpen, onSearch }) {
  const { isAdmin } = useAuth();
  const { data: clients = [] } = useClients();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const dashboardPath = isAdmin ? '/admin' : '/overview';
  const trail = useTrail(clients, dashboardPath);
  const onDashboard = pathname === dashboardPath;
  // inside a calendar only the Dashboard leads back to the system pages (no Back, no client search)
  const inCalendar = pathname.startsWith('/c/');
  // go back inside the app when there is history, otherwise to the dashboard
  const canGoBack = typeof window !== 'undefined' && (window.history.state?.idx ?? 0) > 0;
  const back = () => (canGoBack ? navigate(-1) : navigate(dashboardPath));

  return (
    <div className="sticky top-0 z-30 flex h-12 items-center gap-1.5 border-b border-slate-200/80 bg-white/85 px-3 backdrop-blur-md sm:px-5">
      <button className="btn-ghost p-1.5 lg:hidden" onClick={onMenu} aria-label="Open menu">
        {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>
      {!onDashboard && !inCalendar && (
        <button className="btn-ghost h-8 w-8 p-0" onClick={back} title="Back" aria-label="Back">
          <ArrowLeft className="h-[18px] w-[18px]" />
        </button>
      )}
      {!onDashboard && !inCalendar && <span className="mx-1 hidden h-5 w-px bg-slate-200 sm:block" />}
      <nav aria-label="You are here" className="flex min-w-0 flex-1 items-center gap-1 text-sm">
        {/* on the dashboard itself the label says where you are; elsewhere it's just the icon */}
        {onDashboard ? (
          <span className="flex shrink-0 items-center gap-1.5 px-1.5 py-1 font-semibold text-brand-700">
            <LayoutDashboard className="h-4 w-4" /> Dashboard
          </span>
        ) : (
          <Link to={dashboardPath} title="Dashboard" aria-label="Dashboard" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-brand-50 hover:text-brand-700">
            <LayoutDashboard className="h-[18px] w-[18px]" />
          </Link>
        )}
        {trail.map((t, i) => (
          <span key={i} className={`flex min-w-0 items-center gap-1 ${i < trail.length - 1 ? 'hidden sm:flex' : ''}`}>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" />
            {t.to && i < trail.length - 1 ? (
              <Link to={t.to} className="truncate rounded-md px-1.5 py-1 text-slate-500 hover:bg-brand-50 hover:text-brand-700">
                {t.label}
              </Link>
            ) : (
              <span className={`truncate px-1.5 py-1 ${i === trail.length - 1 ? 'font-semibold text-brand-700' : 'text-slate-500'}`}>{t.label}</span>
            )}
          </span>
        ))}
      </nav>
      <ThemeToggle />
      <NotificationBell />
      {onSearch && !inCalendar && (
        <button className="btn-ghost gap-2 px-2 py-1 text-sm text-slate-500" onClick={onSearch} aria-label="Find a client">
          <Search className="h-4 w-4" />
          <span className="hidden md:inline">Find a client</span>
          <kbd className="hidden rounded border border-slate-200 px-1 text-[10px] text-slate-500 md:inline">{isMac ? '⌘K' : 'Ctrl K'}</kbd>
        </button>
      )}
    </div>
  );
}

// The page scrolls inside <main>, so the browser can't remember positions by itself.
// Every history entry keeps its own scroll position: a new page starts at the top,
// and Back / Forward returns to exactly where you were.
const scrollPositions = new Map();
function useScrollMemory(ref) {
  const location = useLocation();
  const navType = useNavigationType();

  // keep saving the position of the current entry while the user scrolls
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const save = () => scrollPositions.set(location.key, el.scrollTop);
    el.addEventListener('scroll', save, { passive: true });
    return () => el.removeEventListener('scroll', save);
  }, [ref, location.key]);

  // on arrival: top for a new page, the saved spot when going back/forward
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const target = navType === 'POP' ? scrollPositions.get(location.key) ?? 0 : 0;
    el.scrollTop = target;
    if (!target) return;
    // content may still be loading: keep trying briefly until the page is tall enough,
    // and stop as soon as the user scrolls themselves
    let tries = 0;
    let userMoved = false;
    const stop = () => (userMoved = true);
    el.addEventListener('wheel', stop, { passive: true });
    el.addEventListener('touchmove', stop, { passive: true });
    const timer = setInterval(() => {
      tries += 1;
      if (userMoved || tries > 40) return clearInterval(timer);
      if (Math.abs(el.scrollTop - target) > 2) el.scrollTop = target;
      else if (el.scrollHeight - el.clientHeight >= target) clearInterval(timer);
    }, 50);
    return () => {
      clearInterval(timer);
      el.removeEventListener('wheel', stop);
      el.removeEventListener('touchmove', stop);
    };
  }, [location.key, navType, ref]);
}

export default function Layout() {
  const { isAdmin, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [switcher, setSwitcher] = useState(false);
  const location = useLocation();

  // a client's own login is shown in that client's colour; FBS accounts always use the FBS colours
  useBrandTheme(isAdmin ? null : user?.client?.brandColor, user?.client?.secondaryColor);
  const mainRef = useRef(null);
  useScrollMemory(mainRef);

  useEffect(() => {
    if (!isAdmin) return;
    const onOpen = () => setSwitcher(true);
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && !window.location.pathname.startsWith('/c/')) {
        e.preventDefault();
        setSwitcher(true);
      }
    };
    window.addEventListener('cc-open-switcher', onOpen);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('cc-open-switcher', onOpen);
      window.removeEventListener('keydown', onKey);
    };
  }, [isAdmin]);

  return (
    <div className="flex h-full">
      <aside className="hidden w-60 shrink-0 lg:block">
        <Sidebar />
      </aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64">
            <Sidebar onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
      <main ref={mainRef} className="min-w-0 flex-1 overflow-y-auto">
        <TopBar onMenu={() => setOpen(true)} menuOpen={open} onSearch={isAdmin ? () => setSwitcher(true) : null} />
        <Outlet key={location.pathname} />
      </main>
      {isAdmin && <ClientSwitcher open={switcher} onClose={() => setSwitcher(false)} />}
    </div>
  );
}
