import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { BarChart3, ChevronLeft, ChevronRight, Heart, Link2, MessageCircle, Share2, Sparkles, TrendingUp } from 'lucide-react';
import { useClientDashboard, usePosts } from '../../api/hooks';
import { FEEDBACK, PLACEMENT } from '../../lib/constants';
import { formatDate, monthBounds, monthKey, monthLabel, shiftMonth, todayISO } from '../../lib/dates';
import { EmptyState, fmtNumber, FullPageSpinner, KpiTile, PlacementChips } from '../../components/ui';
import PillarMix from '../../components/PillarMix';
import PostDrawer from '../../components/PostDrawer';
import { useMyClient } from './useMyClient';

// How the month performed: totals, best posts, and where the posts went.
export default function ClientResults() {
  const { slug } = useParams();
  const { client, isLoading, openId, open, close } = useMyClient(slug);
  const [month, setMonth] = useState(monthKey(todayISO()));
  const bounds = monthBounds(month);
  const dash = useClientDashboard(client?.id, { from: bounds.from, to: bounds.to });
  const posts = usePosts({ clientId: client?.id, from: bounds.from, to: bounds.to, limit: 500 });
  if (isLoading || !client || !dash.data) return <FullPageSpinner />;

  const d = dash.data;
  const m = d.metrics || {};
  const withResults = (posts.data || []).filter((p) => p.reach || p.engagement || p.reacts);
  const top = [...withResults].sort((a, b) => (b.reach || 0) - (a.reach || 0) || (b.engagement || 0) - (a.engagement || 0)).slice(0, 10);
  const platforms = Object.entries(d.placementMix || {}).sort((a, b) => b[1] - a[1]);
  const platformTotal = platforms.reduce((s, [, n]) => s + n, 0);
  const hasAny = Boolean(m.reach || m.engagement || m.reacts || m.comments || m.shares || m.linkClicks);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="page-title">Results · {client.name}</h1>
          <p className="text-sm text-slate-500">How the posts performed. FBS fills in the numbers after each post goes live.</p>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button className="btn-ghost p-1.5" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month"><ChevronLeft className="h-5 w-5" /></button>
          <span className="min-w-[150px] text-center font-semibold text-slate-700">{monthLabel(month)}</span>
          <button className="btn-ghost p-1.5" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month"><ChevronRight className="h-5 w-5" /></button>
        </div>
      </div>

      {!hasAny ? (
        <div className="card">
          <EmptyState icon={BarChart3} title={`No results recorded for ${monthLabel(month)} yet`}>
            Numbers appear here once FBS adds the reach and engagement from Meta Business Suite. Try an earlier month.
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <KpiTile solid label="Reach" value={fmtNumber(m.reach)} icon={Sparkles} hint="people reached" />
            <KpiTile label="Engagement" value={fmtNumber(m.engagement)} icon={TrendingUp} tone="brand" />
            <KpiTile label="Reacts" value={fmtNumber(m.reacts)} icon={Heart} tone="brand" />
            <KpiTile label="Comments" value={fmtNumber(m.comments)} icon={MessageCircle} tone="brand" />
            <KpiTile label="Shares" value={fmtNumber(m.shares)} icon={Share2} tone="brand" />
            <KpiTile label="Link clicks" value={fmtNumber(m.linkClicks)} icon={Link2} tone="brand" />
          </div>

          <section className="card overflow-hidden">
            <header className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5">
              <TrendingUp className="h-4 w-4 text-brand-600" />
              <h2 className="text-sm font-semibold text-brand-700">Top posts by reach</h2>
              <span className="text-xs text-slate-500">{withResults.length} of {posts.data?.length || 0} posts have results</span>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-brand-50 text-left text-xs font-semibold text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Post</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2 text-right">Reach</th>
                    <th className="px-3 py-2 text-right">Engagement</th>
                    <th className="hidden px-3 py-2 text-right md:table-cell">Reacts</th>
                    <th className="hidden px-3 py-2 text-right md:table-cell">Comments</th>
                    <th className="hidden px-3 py-2 text-right md:table-cell">Shares</th>
                    <th className="px-3 py-2">Feedback</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {top.map((p) => (
                    <tr key={p.id} className="cursor-pointer hover:bg-slate-50" onClick={() => open(p)}>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: p.pillar?.color || '#cbd5e1' }} />
                          <span className="min-w-0">
                            <span className="block max-w-[320px] truncate font-medium text-slate-800">{p.title}</span>
                            <span className="mt-0.5 block"><PlacementChips placements={p.placements} size="xs" /></span>
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-slate-600">{formatDate(p.date)}</td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">{fmtNumber(p.reach)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtNumber(p.engagement)}</td>
                      <td className="hidden px-3 py-2 text-right tabular-nums md:table-cell">{fmtNumber(p.reacts)}</td>
                      <td className="hidden px-3 py-2 text-right tabular-nums md:table-cell">{fmtNumber(p.comments)}</td>
                      <td className="hidden px-3 py-2 text-right tabular-nums md:table-cell">{fmtNumber(p.shares)}</td>
                      <td className="px-3 py-2 text-xs">
                        {p.feedback ? (
                          <span className={`rounded-full px-2 py-0.5 font-medium ${p.feedback === 'EXCELLENT' ? 'bg-emerald-50 text-emerald-700' : p.feedback === 'GOOD' ? 'bg-sky-50 text-sky-700' : 'bg-red-50 text-red-700'}`}>
                            {FEEDBACK.find((f) => f.value === p.feedback)?.label}
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <PillarMix mix={d.pillarMix} total={d.totals.total} title="Posts per pillar" />
            {platformTotal > 0 && (
              <div className="card px-4 py-3">
                <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-500">
                  <span>Where the posts went</span>
                  <span className="tabular-nums">{platformTotal} placements</span>
                </div>
                <ul className="space-y-1.5">
                  {platforms.map(([k, n]) => (
                    <li key={k} className="grid grid-cols-[110px_1fr_32px] items-center gap-2 text-xs">
                      <span className="truncate text-slate-600">{PLACEMENT[k]?.label || k}</span>
                      <span className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <span className="block h-full rounded-full" style={{ width: `${(n / platformTotal) * 100}%`, background: PLACEMENT[k]?.color || '#94a3b8' }} />
                      </span>
                      <span className="text-right font-medium tabular-nums">{n}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </>
      )}

      {openId && <PostDrawer key={openId} client={client} postId={openId} onClose={close} />}
    </div>
  );
}
