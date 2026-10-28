import React, { useState, useMemo } from 'react';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip 
} from 'recharts';
import { 
  PieChart as PieChartIcon, 
  CheckCircle2, 
  Filter, 
  ArrowUpRight, 
  Layers, 
  ChevronDown, 
  ChevronUp, 
  Sparkles,
  PhoneCall,
  CalendarCheck,
  TrendingUp
} from 'lucide-react';
import { RCMLead } from '../types';

interface LeadStatusDistributionChartProps {
  leads: RCMLead[];
  activeStatusFilter: string;
  onSelectStatus: (status: string) => void;
}

const STATUS_METRICS_CONFIG: Record<string, { label: string; color: string; bgClass: string; borderClass: string; textClass: string; desc: string }> = {
  'Ready for Call': {
    label: 'Ready for Call',
    color: '#64748b', // Slate
    bgClass: 'bg-slate-800/80',
    borderClass: 'border-slate-700',
    textClass: 'text-slate-300',
    desc: 'New leads scrubbed from NPI & Places awaiting outbound AI dialer'
  },
  'Calling': {
    label: 'Calling / Dialing',
    color: '#06b6d4', // Cyan
    bgClass: 'bg-cyan-950/60',
    borderClass: 'border-cyan-500/40',
    textClass: 'text-cyan-300',
    desc: 'Currently in queue or engaged in live AI qualification turn'
  },
  'Transferred to Manager': {
    label: 'Transferred to Manager',
    color: '#10b981', // Emerald
    bgClass: 'bg-emerald-950/60',
    borderClass: 'border-emerald-500/40',
    textClass: 'text-emerald-300',
    desc: 'Live physician / practice manager warm transferred to phone'
  },
  'Audit Scheduled': {
    label: 'Audit Scheduled',
    color: '#f59e0b', // Amber
    bgClass: 'bg-amber-950/60',
    borderClass: 'border-amber-500/40',
    textClass: 'text-amber-300',
    desc: 'Complimentary 50-claim forensic billing audit booked'
  },
  'Follow-up': {
    label: 'Contacted / Follow-up',
    color: '#6366f1', // Indigo
    bgClass: 'bg-indigo-950/60',
    borderClass: 'border-indigo-500/40',
    textClass: 'text-indigo-300',
    desc: 'Gatekeeper callback or decision maker requested follow-up'
  },
  'Voicemail': {
    label: 'Voicemail Left',
    color: '#f97316', // Orange
    bgClass: 'bg-orange-950/60',
    borderClass: 'border-orange-500/40',
    textClass: 'text-orange-300',
    desc: 'Automated AI voicemail delivered with direct callback number'
  },
  'Not Interested': {
    label: 'Not Interested',
    color: '#f43f5e', // Rose
    bgClass: 'bg-rose-950/60',
    borderClass: 'border-rose-500/40',
    textClass: 'text-rose-300',
    desc: 'In-house satisfaction or opt-out requested'
  }
};

const DEFAULT_COLOR = '#94a3b8';

export const LeadStatusDistributionChart: React.FC<LeadStatusDistributionChartProps> = ({
  leads,
  activeStatusFilter,
  onSelectStatus
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Calculate aggregation
  const { chartData, totalLeads, auditScheduledCount, warmTransferredCount, conversionRate } = useMemo(() => {
    const total = leads.length;
    if (total === 0) {
      return {
        chartData: [],
        totalLeads: 0,
        auditScheduledCount: 0,
        warmTransferredCount: 0,
        conversionRate: 0
      };
    }

    const counts: Record<string, number> = {};
    leads.forEach(l => {
      const st = l.status || 'Ready for Call';
      counts[st] = (counts[st] || 0) + 1;
    });

    const data = Object.keys(counts).map(statusKey => {
      const cfg = STATUS_METRICS_CONFIG[statusKey] || {
        label: statusKey,
        color: DEFAULT_COLOR,
        bgClass: 'bg-slate-800',
        borderClass: 'border-slate-700',
        textClass: 'text-slate-300',
        desc: ''
      };
      const count = counts[statusKey];
      const percentage = Math.round((count / total) * 100);
      return {
        name: cfg.label,
        rawStatus: statusKey,
        value: count,
        percentage,
        color: cfg.color,
        desc: cfg.desc,
        bgClass: cfg.bgClass,
        borderClass: cfg.borderClass,
        textClass: cfg.textClass
      };
    }).sort((a, b) => b.value - a.value);

    const audits = counts['Audit Scheduled'] || 0;
    const transfers = counts['Transferred to Manager'] || 0;
    const qualified = audits + transfers;
    const rate = Math.round((qualified / total) * 100);

    return {
      chartData: data,
      totalLeads: total,
      auditScheduledCount: audits,
      warmTransferredCount: transfers,
      conversionRate: rate
    };
  }, [leads]);

  // Custom Recharts Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="p-3 bg-slate-950/95 border border-white/20 rounded-xl shadow-2xl backdrop-blur-xl text-xs z-50 pointer-events-none min-w-[200px]">
          <div className="flex items-center gap-2 mb-1.5">
            <span 
              className="w-2.5 h-2.5 rounded-full ring-2 ring-white/20" 
              style={{ backgroundColor: data.color }} 
            />
            <span className="font-bold text-white text-sm">{data.name}</span>
          </div>
          <div className="space-y-1 text-slate-300">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Total Prospects:</span>
              <span className="font-mono font-bold text-white">{data.value} leads</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Share of Pipeline:</span>
              <span className="font-mono font-bold text-teal-300">{data.percentage}%</span>
            </div>
            {data.desc && (
              <p className="text-[11px] text-slate-400 pt-1 border-t border-white/10 mt-1">
                {data.desc}
              </p>
            )}
          </div>
          <div className="mt-2 text-[10px] text-teal-400 font-medium">
            Click slice to filter table by this status
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="relative overflow-hidden rounded-2xl glass-panel bg-gradient-to-r from-slate-950/90 via-slate-900/80 to-teal-950/40 border border-white/10 shadow-2xl backdrop-blur-xl transition-all">
      {/* Decorative background glow */}
      <div className="absolute top-0 right-1/4 w-72 h-72 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-10 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header bar */}
      <div className="relative z-10 px-5 py-4 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500/20 to-emerald-500/20 border border-teal-500/30 flex items-center justify-center text-teal-300 shadow-md shadow-teal-500/10">
            <PieChartIcon className="w-5 h-5 text-teal-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-black text-white tracking-tight flex items-center gap-2">
                Pipeline Lead Status Distribution
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 text-[10px] font-mono font-bold">
                {totalLeads} Total Prospects
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Real-time distribution across sales stages. Click any status slice or legend item to filter the directory.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeStatusFilter !== 'All' && (
            <button
              type="button"
              onClick={() => onSelectStatus('All')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40 text-xs font-semibold cursor-pointer transition"
            >
              <Filter className="w-3 h-3" />
              <span>Clear Filter ({activeStatusFilter})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg bg-slate-900 border border-white/10 text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title={isExpanded ? 'Collapse Status Chart' : 'Expand Status Chart'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {isExpanded && (
        <div className="relative z-10 p-5 space-y-5">
          {/* Key KPI Metric Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Total In Pipeline</span>
                <span className="text-xl font-black text-white font-mono">{totalLeads}</span>
              </div>
              <Layers className="w-5 h-5 text-slate-500" />
            </div>

            <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/20 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400 block">Audits Scheduled</span>
                <span className="text-xl font-black text-amber-300 font-mono">{auditScheduledCount}</span>
              </div>
              <CalendarCheck className="w-5 h-5 text-amber-400" />
            </div>

            <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/20 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 block">Warm Transferred</span>
                <span className="text-xl font-black text-emerald-300 font-mono">{warmTransferredCount}</span>
              </div>
              <PhoneCall className="w-5 h-5 text-emerald-400" />
            </div>

            <div className="p-3 rounded-xl bg-teal-950/30 border border-teal-500/20 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-teal-400 block">Qualified Conversion</span>
                <span className="text-xl font-black text-teal-300 font-mono">{conversionRate}%</span>
              </div>
              <TrendingUp className="w-5 h-5 text-teal-400" />
            </div>
          </div>

          {/* Chart & Legend Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
            {/* Visual Pie Chart (5 columns) */}
            <div className="lg:col-span-5 flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-950/70 border border-white/10 relative min-h-[260px]">
              {chartData.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-xs">
                  No lead records found to display status distribution.
                </div>
              ) : (
                <>
                  <div className="w-full h-56 relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Tooltip content={<CustomTooltip />} />
                        <Pie
                          data={chartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={88}
                          paddingAngle={3}
                          dataKey="value"
                          onClick={(entry: any) => {
                            const rawStatus = entry?.rawStatus || entry?.payload?.rawStatus;
                            if (rawStatus) {
                              onSelectStatus(rawStatus === activeStatusFilter ? 'All' : rawStatus);
                            }
                          }}
                          cursor="pointer"
                        >
                          {chartData.map((entry, index) => {
                            const isSelected = activeStatusFilter.toLowerCase() === entry.rawStatus.toLowerCase();
                            const isHovered = hoveredIndex === index;
                            return (
                              <Cell
                                key={`cell-${index}`}
                                fill={entry.color}
                                stroke={isSelected ? '#ffffff' : 'rgba(15, 23, 42, 0.8)'}
                                strokeWidth={isSelected ? 3 : 1.5}
                                opacity={
                                  activeStatusFilter === 'All' 
                                    ? (hoveredIndex === null || isHovered ? 1 : 0.6) 
                                    : (isSelected ? 1 : 0.35)
                                }
                                onMouseEnter={() => setHoveredIndex(index)}
                                onMouseLeave={() => setHoveredIndex(null)}
                              />
                            );
                          })}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>

                    {/* Donut Center Display */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                      <span className="text-[11px] text-slate-400 font-medium">Active Leads</span>
                      <span className="text-2xl font-black text-white font-mono tracking-tight">{totalLeads}</span>
                      <span className="text-[10px] text-teal-400 font-semibold">{chartData.length} Stages</span>
                    </div>
                  </div>

                  <div className="text-center text-[11px] text-slate-400 mt-1">
                    <span className="text-teal-300 font-bold">Interactive Pie:</span> Hover for percentages or click a segment to isolate records.
                  </div>
                </>
              )}
            </div>

            {/* Interactive Status Pills Legend (7 columns) */}
            <div className="lg:col-span-7 space-y-2.5">
              <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase tracking-wider px-1">
                <span>Sales Pipeline Status</span>
                <span>Prospects & Share</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[250px] overflow-y-auto pr-1">
                {chartData.map((item, idx) => {
                  const isSelected = activeStatusFilter.toLowerCase() === item.rawStatus.toLowerCase();
                  return (
                    <button
                      key={item.rawStatus}
                      type="button"
                      onClick={() => onSelectStatus(isSelected ? 'All' : item.rawStatus)}
                      onMouseEnter={() => setHoveredIndex(idx)}
                      onMouseLeave={() => setHoveredIndex(null)}
                      className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between gap-2.5 transition cursor-pointer ${
                        isSelected 
                          ? `${item.bgClass} ${item.borderClass} ring-2 ring-white/30 shadow-lg` 
                          : 'bg-slate-900/60 hover:bg-slate-900 border-white/5 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span 
                          className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" 
                          style={{ backgroundColor: item.color }} 
                        />
                        <div className="truncate">
                          <span className={`text-xs font-bold block truncate ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                            {item.name}
                          </span>
                          <span className="text-[10px] text-slate-400 block truncate">
                            {item.rawStatus === 'Audit Scheduled' ? 'Audit booked' : item.rawStatus === 'Transferred to Manager' ? 'Live phone bridge' : `${item.value} accounts`}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xs font-mono font-black text-white block">
                          {item.value}
                        </span>
                        <span className={`text-[10px] font-mono font-bold block ${item.textClass}`}>
                          {item.percentage}%
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Status explanation footnote */}
              <div className="p-2.5 rounded-xl bg-slate-950/50 border border-white/5 flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Pro Tip: Leads auto-advance statuses in real time during AI calls, warm transfers, and audit scheduling.</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
