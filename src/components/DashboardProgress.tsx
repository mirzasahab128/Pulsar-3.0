import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  PhoneCall,
  Users,
  BadgeCheck,
  Megaphone,
  Send,
  Reply,
  CalendarCheck2,
  CalendarClock,
  AlertTriangle,
  X
} from 'lucide-react';
import { RCMLead, WarmTransferRecord, ActionItem } from '../types';
import { useTheme } from '../context/ThemeContext';
import { apiService, DashboardStatsResponse } from '../services/api';

interface DashboardProgressProps {
  leads: RCMLead[];
  tasks: ActionItem[];
  warmTransfers: WarmTransferRecord[];
}

type RangeKey = '7d' | '30d' | '90d';

const OUTCOME_COLORS: Record<string, string> = {
  answered: '#1DA068',
  voicemail: '#DE9A2E',
  no_answer: '#9AA79C',
  callback_booked: '#2E7FA8'
};

function toIsoOrNull(v?: string | null): string | null {
  if (!v) return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

/** Count-up animation for KPI values; respects prefers-reduced-motion. */
export function useCountUp(target: number, duration = 750): number {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(0);
  useEffect(() => {
    const from = prevRef.current;
    const to = target;
    prevRef.current = target;
    if (from === to) {
      setDisplay(to);
      return;
    }
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(to);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return display;
}

const Sparkline: React.FC<{ values: number[]; color: string }> = ({ values, color }) => {
  if (values.length === 0) return null;
  const width = 96;
  const height = 28;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const stepX = values.length > 1 ? width / (values.length - 1) : width;
  const pts = values
    .map((v, i) => `${(i * stepX).toFixed(1)},${(height - 3 - ((v - min) / span) * (height - 6)).toFixed(1)}`)
    .join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0" aria-hidden="true">
      <polygon points={`0,${height} ${pts} ${width},${height}`} fill={color} opacity={0.13} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

const KpiValue: React.FC<{ value: number; className?: string }> = ({ value, className }) => {
  const display = useCountUp(value);
  return (
    <div className={`font-display text-[34px] leading-none font-bold tabular-nums mt-2.5 ${className ?? ''}`}>
      {display.toLocaleString()}
    </div>
  );
};

type Stats = DashboardStatsResponse['stats'];

interface KpiSeries {
  kind: 'area' | 'bar';
  data: Array<Record<string, any>>;
  xKey: string;
  yKey: string;
  unit: string;
  values: number[];
  emptyNote: string;
}

/**
 * Maps each KPI to the real series the stats API already returns for it.
 * Nothing is invented: leads KPIs read leadsOverTime / funnel, outreach
 * KPIs read campaignPerformance, call KPIs read callActivity.perDay, and
 * task KPIs read followUpHealth.completedSeries.
 */
function seriesFor(key: string, stats: Stats): KpiSeries {
  switch (key) {
    case 'totalLeads':
      return {
        kind: 'area',
        data: stats.leadsOverTime as any,
        xKey: 'date',
        yKey: 'count',
        unit: 'per day',
        values: stats.leadsOverTime.map(d => d.count),
        emptyNote: 'No dated leads in this range yet.'
      };
    case 'qualifiedLeads':
      return {
        kind: 'bar',
        data: stats.funnel as any,
        xKey: 'stage',
        yKey: 'count',
        unit: 'per stage',
        values: stats.funnel.map(f => f.count),
        emptyNote: 'No leads yet — the funnel is empty.'
      };
    case 'activeCampaigns':
    case 'outreachSent':
      return {
        kind: 'bar',
        data: stats.campaignPerformance as any,
        xKey: 'name',
        yKey: 'sent',
        unit: 'per campaign',
        values: stats.campaignPerformance.map(c => c.sent),
        emptyNote: 'No campaigns recorded yet. Open Campaigns once to sync its real counters.'
      };
    case 'outreachReplies':
      return {
        kind: 'bar',
        data: stats.campaignPerformance as any,
        xKey: 'name',
        yKey: 'replied',
        unit: 'per campaign',
        values: stats.campaignPerformance.map(c => c.replied),
        emptyNote: 'No campaigns recorded yet. Open Campaigns once to sync its real counters.'
      };
    case 'callsMade':
    case 'meetingsBooked':
      return {
        kind: 'bar',
        data: stats.callActivity.perDay as any,
        xKey: 'date',
        yKey: 'count',
        unit: 'per day',
        values: stats.callActivity.perDay.map(d => d.count),
        emptyNote: 'No Call Studio sessions in this range.'
      };
    default:
      // tasksDueToday / tasksOverdue
      return {
        kind: 'bar',
        data: stats.followUpHealth.completedSeries as any,
        xKey: 'date',
        yKey: 'completed',
        unit: 'per day',
        values: stats.followUpHealth.completedSeries.map(d => d.completed),
        emptyNote: 'No completed tasks with completion dates in this range.'
      };
  }
}

function summarize(values: number[]): { min: number; avg: string; max: number; total: number } | null {
  if (values.length === 0) return null;
  const total = values.reduce((a, b) => a + b, 0);
  const avg = total / values.length;
  return {
    min: Math.min(...values),
    avg: Number.isInteger(avg) ? String(avg) : avg.toFixed(1),
    max: Math.max(...values),
    total
  };
}

/** Natural warning levels only: overdue work and today's queue. */
function thresholdFor(key: string, value: number): 'warn' | 'crit' | null {
  if (key === 'tasksOverdue') return value >= 5 ? 'crit' : value >= 1 ? 'warn' : null;
  if (key === 'tasksDueToday') return value >= 1 ? 'warn' : null;
  return null;
}

/**
 * Phases 1–3 (Part 2) — one-screen progress layer for the Dashboard.
 *
 * All figures come from GET /api/dashboard/stats, which aggregates the
 * workspace's real records server-side. This component first syncs the
 * records the app actually holds (leads, tasks, and Call Studio sessions
 * derived from warm transfers + lead outcomes) to POST /api/dashboard/
 * snapshot, then renders the aggregated result. Nothing is fabricated:
 * an empty workspace renders zeros and empty states.
 *
 * Theme Phase 1: Field & Sage styling; KPI cards expand in place into a
 * detail panel (real series chart + range switch + min/avg/max).
 */
export const DashboardProgress: React.FC<DashboardProgressProps> = ({ leads, tasks, warmTransfers }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [range, setRange] = useState<RangeKey>('30d');
  const [data, setData] = useState<DashboardStatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const snapshotPayload = useMemo(() => {
    const callSessions: Array<{ at: string; outcome: string }> = [];
    for (const wt of warmTransfers) {
      const at = toIsoOrNull(wt.bridgedAt);
      if (at) callSessions.push({ at, outcome: 'answered' });
    }
    for (const lead of leads) {
      const at = toIsoOrNull(lead.lastContacted || undefined);
      if (!at) continue;
      if (lead.status === 'Voicemail') callSessions.push({ at, outcome: 'voicemail' });
      if (lead.status === 'Audit Scheduled') callSessions.push({ at, outcome: 'callback_booked' });
    }
    return {
      leads: leads.map(l => ({
        id: l.id,
        status: l.status,
        createdAt: (l as any).createdAt ?? null,
        lastContacted: toIsoOrNull(l.lastContacted || undefined)
      })),
      tasks: tasks.map(t => ({
        id: t.id,
        dueAt: toIsoOrNull(t.scheduledDateTime || t.due),
        completed: t.completed,
        completedAt: t.completedAt ?? null
      })),
      callSessions
    };
  }, [leads, tasks, warmTransfers]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        await apiService.syncDashboardSnapshot(snapshotPayload);
        const stats = await apiService.getDashboardStats(range);
        if (!cancelled) setData(stats);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Could not load dashboard stats');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [snapshotPayload, range]);

  const axisColor = isDark ? '#93A696' : '#6C7A6E';
  const gridColor = isDark ? 'rgba(147,166,150,0.15)' : 'rgba(108,122,110,0.15)';
  const GREEN = isDark ? '#25B878' : '#0B5D3B';
  const ACCENT = isDark ? '#35CC8A' : '#1DA068';
  const MID = isDark ? '#4CAF7D' : '#63B184';
  const AMBER = isDark ? '#E5AC45' : '#DE9A2E';
  const RED = isDark ? '#E0685F' : '#CF4B45';
  const SKY = isDark ? '#5FB3D9' : '#2E7FA8';
  const VIOLET = isDark ? '#B79CED' : '#7C5CBF';

  const kpiDefs: Array<{
    key: string;
    label: string;
    detailTitle: string;
    icon: React.ComponentType<{ className?: string }>;
    tint: string;
    color: string;
    invertDelta?: boolean;
    callCaption?: boolean;
  }> = [
    { key: 'totalLeads', label: 'Total Leads', detailTitle: 'Leads over time', icon: Users, tint: 'pv-tint-green', color: ACCENT },
    { key: 'qualifiedLeads', label: 'Qualified Leads', detailTitle: 'Lead pipeline funnel — leads per stage', icon: BadgeCheck, tint: 'pv-tint-green', color: GREEN },
    { key: 'activeCampaigns', label: 'Active Campaigns', detailTitle: 'Sends per campaign (campaign context)', icon: Megaphone, tint: 'pv-tint-violet', color: VIOLET },
    { key: 'outreachSent', label: 'Outreach Sent', detailTitle: 'Sends per campaign', icon: Send, tint: 'pv-tint-sky', color: SKY },
    { key: 'outreachReplies', label: 'Outreach Replies', detailTitle: 'Replies per campaign', icon: Reply, tint: 'pv-tint-sky', color: SKY },
    { key: 'callsMade', label: 'Calls (Call Studio)', detailTitle: 'Call Studio sessions per day', icon: PhoneCall, tint: 'pv-tint-green', color: ACCENT, callCaption: true },
    { key: 'meetingsBooked', label: 'Meetings Booked', detailTitle: 'Call Studio sessions per day — bookings are callback outcomes', icon: CalendarCheck2, tint: 'pv-tint-amber', color: AMBER, callCaption: true },
    { key: 'tasksDueToday', label: 'Tasks Due Today', detailTitle: 'Tasks completed per day', icon: CalendarClock, tint: 'pv-tint-amber', color: AMBER },
    { key: 'tasksOverdue', label: 'Tasks Overdue', detailTitle: 'Tasks completed per day', icon: AlertTriangle, tint: 'pv-tint-red', color: RED, invertDelta: true }
  ];

  const stats = data?.stats;
  const hasAnyData = !!stats && (
    stats.kpis.totalLeads.value > 0 ||
    stats.campaignPerformance.length > 0 ||
    stats.callActivity.perDay.some(d => d.count > 0)
  );

  const renderDelta = (delta: number | null, invert = false) => {
    if (delta === null || delta === undefined) {
      return <span className="pv-delta flat"><Minus className="w-3 h-3" /> —</span>;
    }
    if (delta === 0) {
      return <span className="pv-delta flat"><Minus className="w-3 h-3" /> 0</span>;
    }
    const isGood = invert ? delta < 0 : delta > 0;
    const Icon = delta > 0 ? TrendingUp : TrendingDown;
    return (
      <span className={`pv-delta ${isGood ? 'up' : 'down'}`}>
        <Icon className="w-3 h-3" /> {delta > 0 ? `+${delta}` : delta}
      </span>
    );
  };

  const rangeSwitch = (
    <div className="pv-seg" role="group" aria-label="Stats range">
      {(['7d', '30d', '90d'] as RangeKey[]).map(r => (
        <button key={r} onClick={() => setRange(r)} className={range === r ? 'active' : ''} aria-pressed={range === r}>
          {r}
        </button>
      ))}
    </div>
  );

  return (
    <section className="space-y-4">
      {/* Header + range switch */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold flex items-center gap-2 text-[var(--pv-ink)]">
            <TrendingUp className="w-4 h-4 text-[var(--pv-green)]" /> Progress — all in one screen
          </h3>
          <p className="text-[11px] text-[var(--pv-muted)] mt-0.5">Server-aggregated workspace stats. Click any metric card to expand it.</p>
        </div>
        {rangeSwitch}
      </div>

      {error && (
        <div className="pv-panel p-4 text-xs text-[var(--pv-red)]">
          Dashboard stats could not be loaded: {error}
        </div>
      )}

      {loading && !stats && (
        <div className="pv-kpi-grid">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="pv-panel animate-pulse h-[132px]" style={{ flex: '1 1 208px' }} />
          ))}
        </div>
      )}

      {stats && (
        <>
          {!hasAnyData && (
            <div className="pv-panel p-4 text-xs text-[var(--pv-muted)]">
              No activity recorded for this workspace yet. Panels below show real zeros — as leads, campaigns,
              Call Studio sessions, and tasks are recorded, they will appear here.
            </div>
          )}

          {/* KPI strip — cards expand in place (Field & Sage theme) */}
          <div className="pv-kpi-grid">
            {kpiDefs.map(def => {
              const kpi = stats.kpis[def.key];
              const value = kpi?.value ?? 0;
              const series = seriesFor(def.key, stats);
              const thresh = thresholdFor(def.key, value);
              const expanded = expandedKey === def.key;
              const summary = summarize(series.values);
              const seriesEmpty = series.values.length === 0 || series.values.every(v => v === 0);
              const Icon = def.icon;
              return (
                <div
                  key={def.key}
                  role="button"
                  tabIndex={0}
                  aria-expanded={expanded}
                  onClick={() => setExpandedKey(expanded ? null : def.key)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setExpandedKey(expanded ? null : def.key);
                    }
                  }}
                  className={`pv-card pv-kpi relative p-5 ${expanded ? 'expanded' : ''} ${thresh ?? ''}`}
                  title={expanded ? 'Click to collapse' : 'Click to expand'}
                >
                  {expanded && (
                    <button
                      type="button"
                      aria-label={`Collapse ${def.label}`}
                      onClick={e => {
                        e.stopPropagation();
                        setExpandedKey(null);
                      }}
                      className="absolute top-3.5 right-3.5 w-7 h-7 rounded-full bg-[var(--pv-pill-bg)] text-[var(--pv-muted)] hover:text-[var(--pv-ink)] flex items-center justify-center cursor-pointer z-10"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  <div className="flex items-start justify-between gap-2 pr-6">
                    <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--pv-muted)]">{def.label}</span>
                    <span className={`pv-chip ${def.tint}`} style={{ width: 36, height: 36, borderRadius: 12 }}>
                      <Icon className="w-[18px] h-[18px]" />
                    </span>
                  </div>
                  <KpiValue
                    value={value}
                    className={thresh === 'crit' ? 'text-[var(--pv-red)]' : thresh === 'warn' ? 'text-[var(--pv-amber)]' : ''}
                  />
                  <div className="mt-2.5 flex items-end justify-between gap-2">
                    <div className="flex flex-col items-start gap-1">
                      {renderDelta(kpi?.delta ?? null, def.invertDelta)}
                      {kpi?.newInRange !== null && kpi?.newInRange !== undefined && (
                        <span className="text-[10.5px] text-[var(--pv-muted)]">+{kpi.newInRange} in range</span>
                      )}
                    </div>
                    <Sparkline values={series.values} color={thresh === 'crit' ? RED : def.color} />
                  </div>

                  {/* Expanded detail — real series, range switch, min/avg/max */}
                  <div className="pv-kpi-detail" onClick={e => e.stopPropagation()}>
                    {expanded && (
                      <div className="border-t border-[var(--pv-border)] pt-4 cursor-default">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                          <div className="text-[13px] font-bold text-[var(--pv-ink)]">{def.detailTitle}</div>
                          {rangeSwitch}
                        </div>
                        {seriesEmpty ? (
                          <div className="h-[160px] flex items-center justify-center text-xs text-[var(--pv-muted)]">
                            {series.emptyNote}
                          </div>
                        ) : series.kind === 'area' ? (
                          <ResponsiveContainer width="100%" height={210}>
                            <AreaChart data={series.data} margin={{ left: 0, right: 12 }}>
                              <CartesianGrid stroke={gridColor} />
                              <XAxis dataKey={series.xKey} tick={{ fill: axisColor, fontSize: 10 }} minTickGap={24} />
                              <YAxis tick={{ fill: axisColor, fontSize: 11 }} allowDecimals={false} width={32} />
                              <Tooltip />
                              <Area type="monotone" dataKey={series.yKey} stroke={def.color} fill={def.color} fillOpacity={0.22} />
                            </AreaChart>
                          </ResponsiveContainer>
                        ) : (
                          <ResponsiveContainer width="100%" height={210}>
                            <BarChart data={series.data} margin={{ left: 0, right: 12 }}>
                              <CartesianGrid stroke={gridColor} />
                              <XAxis dataKey={series.xKey} tick={{ fill: axisColor, fontSize: 10 }} minTickGap={16} interval="preserveStartEnd" />
                              <YAxis tick={{ fill: axisColor, fontSize: 11 }} allowDecimals={false} width={32} />
                              <Tooltip />
                              <Bar dataKey={series.yKey} fill={def.color} radius={[5, 5, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        )}
                        {summary && (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3">
                            <div className="pv-statbox">
                              <div className="pv-statbox-label">Min · {series.unit}</div>
                              <div className="pv-statbox-value">{summary.min}</div>
                            </div>
                            <div className="pv-statbox">
                              <div className="pv-statbox-label">Avg · {series.unit}</div>
                              <div className="pv-statbox-value">{summary.avg}</div>
                            </div>
                            <div className="pv-statbox">
                              <div className="pv-statbox-label">Max · {series.unit}</div>
                              <div className="pv-statbox-value">{summary.max}</div>
                            </div>
                            <div className="pv-statbox">
                              <div className="pv-statbox-label">Total in range</div>
                              <div className="pv-statbox-value">{summary.total}</div>
                            </div>
                          </div>
                        )}
                        {def.callCaption && (
                          <div className="text-[10.5px] text-[var(--pv-muted)] mt-3">
                            {stats.callActivity.caption} — sessions recorded in the app (simulated in-browser; not carrier calls).
                          </div>
                        )}
                        {def.callCaption && (
                          <div className="flex flex-wrap gap-3 mt-2">
                            {stats.callActivity.outcomes.map(o => (
                              <span key={o.outcome} className="flex items-center gap-1.5 text-[10.5px] text-[var(--pv-muted)]">
                                <span className="w-2 h-2 rounded-full" style={{ background: OUTCOME_COLORS[o.outcome] || '#9AA79C' }} />
                                {o.outcome.replace('_', ' ')}: <strong className="tabular-nums text-[var(--pv-ink)]">{o.count}</strong>
                              </span>
                            ))}
                          </div>
                        )}
                        {(def.key === 'tasksDueToday' || def.key === 'tasksOverdue') && (
                          <div className="text-[10.5px] text-[var(--pv-muted)] mt-3">
                            Follow-up health now: <strong className="text-[var(--pv-ink)]">{stats.followUpHealth.dueToday}</strong> due today ·{' '}
                            <strong className={stats.followUpHealth.overdue > 0 ? 'text-[var(--pv-red)]' : 'text-[var(--pv-ink)]'}>{stats.followUpHealth.overdue}</strong> overdue ·{' '}
                            <strong className="text-[var(--pv-ink)]">{stats.followUpHealth.completedInRange}</strong> completed in range.
                            Overdue cards flag amber at 1+ and red at 5+.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Charts grid */}
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="pv-panel p-5">
              <div className="text-[13px] font-bold mb-2">Lead Pipeline Funnel</div>
              {stats.funnel.every(f => f.count === 0) ? (
                <div className="h-[220px] flex items-center justify-center text-xs text-[var(--pv-muted)]">No leads yet — the funnel is empty.</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={stats.funnel} layout="vertical" margin={{ left: 24, right: 12 }}>
                    <CartesianGrid stroke={gridColor} horizontal={false} />
                    <XAxis type="number" tick={{ fill: axisColor, fontSize: 11 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="stage" width={130} tick={{ fill: axisColor, fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill={GREEN} radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="pv-panel p-5">
              <div className="text-[13px] font-bold mb-2">Leads Over Time</div>
              {stats.leadsOverTime.every(d => d.count === 0) ? (
                <div className="h-[220px] flex items-center justify-center text-xs text-[var(--pv-muted)]">No dated leads in this range yet.</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={stats.leadsOverTime} margin={{ left: 0, right: 12 }}>
                    <CartesianGrid stroke={gridColor} />
                    <XAxis dataKey="date" tick={{ fill: axisColor, fontSize: 10 }} minTickGap={24} />
                    <YAxis tick={{ fill: axisColor, fontSize: 11 }} allowDecimals={false} width={32} />
                    <Tooltip />
                    <Area type="monotone" dataKey="count" stroke={ACCENT} fill={ACCENT} fillOpacity={0.22} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="pv-panel p-5">
              <div className="text-[13px] font-bold mb-2">Campaign Performance</div>
              {stats.campaignPerformance.length === 0 ? (
                <div className="h-[220px] flex items-center justify-center text-xs text-[var(--pv-muted)]">No campaigns recorded yet. Open Campaigns once to sync its real counters.</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={stats.campaignPerformance} margin={{ left: 0, right: 12 }}>
                    <CartesianGrid stroke={gridColor} />
                    <XAxis dataKey="name" tick={{ fill: axisColor, fontSize: 10 }} interval={0} angle={-12} textAnchor="end" height={48} />
                    <YAxis tick={{ fill: axisColor, fontSize: 11 }} allowDecimals={false} width={32} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="sent" fill={GREEN} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="opened" fill={MID} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="replied" fill={AMBER} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="pv-panel p-5">
              <div className="text-[13px] font-bold mb-1 flex items-center gap-1.5">
                <PhoneCall className="w-3.5 h-3.5 text-[var(--pv-sky)]" /> Call Activity &amp; Outcomes
              </div>
              {/* Honest caption: Call Studio sessions are simulated in-browser,
                  not carrier/PSTN calls (prompt Part 2 §5). */}
              <div className="text-[10px] text-[var(--pv-muted)] mb-2">
                {stats.callActivity.caption} — sessions recorded in the app (simulated in-browser; not carrier calls).
              </div>
              {stats.callActivity.perDay.every(d => d.count === 0) ? (
                <div className="h-[196px] flex items-center justify-center text-xs text-[var(--pv-muted)]">No Call Studio sessions in this range.</div>
              ) : (
                <div className="grid grid-cols-[1fr_140px] gap-2 items-center">
                  <ResponsiveContainer width="100%" height={196}>
                    <BarChart data={stats.callActivity.perDay} margin={{ left: 0, right: 8 }}>
                      <CartesianGrid stroke={gridColor} />
                      <XAxis dataKey="date" tick={{ fill: axisColor, fontSize: 10 }} minTickGap={24} />
                      <YAxis tick={{ fill: axisColor, fontSize: 11 }} allowDecimals={false} width={28} />
                      <Tooltip />
                      <Bar dataKey="count" fill={ACCENT} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <ResponsiveContainer width="100%" height={196}>
                    <PieChart>
                      <Pie
                        data={stats.callActivity.outcomes.filter(o => o.count > 0)}
                        dataKey="count"
                        nameKey="outcome"
                        innerRadius={34}
                        outerRadius={56}
                        paddingAngle={2}
                      >
                        {stats.callActivity.outcomes.filter(o => o.count > 0).map(o => (
                          <Cell key={o.outcome} fill={OUTCOME_COLORS[o.outcome] || '#9AA79C'} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="flex flex-wrap gap-3 mt-1">
                {stats.callActivity.outcomes.map(o => (
                  <span key={o.outcome} className="flex items-center gap-1.5 text-[10px] text-[var(--pv-muted)]">
                    <span className="w-2 h-2 rounded-full" style={{ background: OUTCOME_COLORS[o.outcome] || '#9AA79C' }} />
                    {o.outcome.replace('_', ' ')}: <strong className="tabular-nums">{o.count}</strong>
                  </span>
                ))}
              </div>
            </div>

            <div className="pv-panel p-5 lg:col-span-2">
              <div className="text-[13px] font-bold mb-2">Follow-up Health</div>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--pv-muted)]">Due today</div>
                  <div className="text-xl font-extrabold tabular-nums">{stats.followUpHealth.dueToday}</div>
                </div>
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--pv-muted)]">Overdue</div>
                  <div className="text-xl font-extrabold tabular-nums text-[var(--pv-red)]">{stats.followUpHealth.overdue}</div>
                </div>
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--pv-muted)]">Completed in range</div>
                  <div className="text-xl font-extrabold tabular-nums text-[var(--pv-accent)]">{stats.followUpHealth.completedInRange}</div>
                </div>
              </div>
              {stats.followUpHealth.completedSeries.every(d => d.completed === 0) ? (
                <div className="h-[120px] flex items-center justify-center text-xs text-[var(--pv-muted)]">No completed tasks with completion dates in this range.</div>
              ) : (
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={stats.followUpHealth.completedSeries} margin={{ left: 0, right: 12 }}>
                    <CartesianGrid stroke={gridColor} />
                    <XAxis dataKey="date" tick={{ fill: axisColor, fontSize: 10 }} minTickGap={24} />
                    <YAxis tick={{ fill: axisColor, fontSize: 11 }} allowDecimals={false} width={28} />
                    <Tooltip />
                    <Bar dataKey="completed" fill={ACCENT} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {stats.snapshotUpdatedAt && (
            <div className="text-[10px] text-[var(--pv-muted)]">
              Aggregated server-side from workspace records synced {new Date(stats.snapshotUpdatedAt).toLocaleString()}.
            </div>
          )}
        </>
      )}
    </section>
  );
};
