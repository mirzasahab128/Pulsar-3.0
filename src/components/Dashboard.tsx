import React, { useState } from 'react';
import { 
  Building2, 
  TrendingUp, 
  PhoneCall, 
  PhoneForwarded, 
  CheckCircle2, 
  Bell, 
  Sparkles, 
  Bot, 
  ArrowRight, 
  Flame, 
  ShieldCheck, 
  Clock, 
  Zap, 
  AlertCircle, 
  Network, 
  Activity,
  ArrowUpRight,
  ExternalLink,
  Layers,
  MapPin,
  Filter,
  CheckSquare
} from 'lucide-react';
import { RCMLead, DailyStats, WarmTransferRecord, ActionItem, PulsarSpatialModule, ManagerSettings } from '../types';
import { NicheTemplate } from '../data/nicheTemplates';
import { PulsarBrandHero } from './PulsarBrandHero';
import { PulsarIntelligencePanel } from './PulsarIntelligencePanel';
import { TelephonyStatusCard } from './TelephonyStatusCard';
import { DashboardProgress, useCountUp } from './DashboardProgress';

interface DashboardProps {
  stats: DailyStats;
  leads: RCMLead[];
  warmTransfers: WarmTransferRecord[];
  tasks: ActionItem[];
  nicheTemplate: NicheTemplate;
  onNavigate: (module: PulsarSpatialModule) => void;
  onTriggerCall: (lead: RCMLead) => void;
  onToggleTask: (taskId: string) => void;
  onOpenAI: () => void;
  onOpenNicheLibrary: () => void;
  settings?: ManagerSettings;
  onOpenSettings?: () => void;
}

const CountNum: React.FC<{ value: number; className?: string }> = ({ value, className }) => {
  const display = useCountUp(value);
  return <div className={className}>{display.toLocaleString()}</div>;
};

export const Dashboard: React.FC<DashboardProps> = ({
  stats,
  leads,
  warmTransfers,
  tasks,
  nicheTemplate,
  onNavigate,
  onTriggerCall,
  onToggleTask,
  onOpenAI,
  onOpenNicheLibrary,
  settings,
  onOpenSettings
}) => {

  const [activeFilter, setActiveFilter] = useState<'all' | 'ready' | 'transferred' | 'scheduled'>('all');

  const qualifiedLeads = leads.filter(l => 
    l.status === 'Audit Scheduled' || l.status === 'Transferred to Manager' || l.status === 'Ready for Call'
  );

  const pendingTasks = tasks.filter(t => !t.completed);

  // Filtered leads for the priority outreach queue
  const displayLeads = leads.filter(l => {
    if (activeFilter === 'ready') return l.status === 'Ready for Call';
    if (activeFilter === 'transferred') return l.status === 'Transferred to Manager';
    if (activeFilter === 'scheduled') return l.status === 'Audit Scheduled';
    return true;
  });

  return (
    <div className="space-y-5">

      {/* Phases 1–3 (Part 2): one-screen progress — KPI strip + charts fed by
          GET /api/dashboard/stats over the workspace's real records */}
      <DashboardProgress leads={leads} tasks={tasks} warmTransfers={warmTransfers} />

      {/* 1. Workspace Context & Filter Bar */}
      <div className="pv-panel p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        {/* Left: Active Workspace / Niche Info */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={onOpenNicheLibrary}
            className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border font-semibold transition cursor-pointer bg-[var(--pv-mint)] border-[var(--pv-mint-2)] text-[var(--pv-green)] hover:bg-[var(--pv-mint-2)]"
            title="Switch industry templates & parameters"
          >
            <Layers className="w-3.5 h-3.5 text-[var(--pv-green)] group-hover:rotate-12 transition-transform duration-300" />
            <span>Workspace: {nicheTemplate.name.split('&')[0].trim()}</span>
            <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded-full bg-[var(--pv-card)] text-[var(--pv-green)]">
              Change
            </span>
          </button>

          <span className="text-[var(--pv-muted)] hidden sm:inline">·</span>

          {/* Quick Segmented Filter Tabs */}
          <div className="pv-seg hidden sm:inline-flex">
            <button
              onClick={() => setActiveFilter('all')}
              className={activeFilter === 'all' ? 'active' : ''}
            >
              All ({leads.length})
            </button>
            <button
              onClick={() => setActiveFilter('ready')}
              className={activeFilter === 'ready' ? 'active' : ''}
            >
              Ready to Call
            </button>
            <button
              onClick={() => setActiveFilter('scheduled')}
              className={activeFilter === 'scheduled' ? 'active' : ''}
            >
              Audits Scheduled
            </button>
          </div>
        </div>

        {/* Right: Telephony Status & Quick Action Triggers */}
        <div className="flex items-center gap-2 shrink-0">
          <TelephonyStatusCard 
            settings={settings}
            onOpenSettings={onOpenSettings}
            variant="compact"
            className="hidden lg:inline-flex"
          />

          <button
            onClick={() => onNavigate('leads')}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[var(--pv-green)] hover:bg-[var(--pv-accent)] text-white font-bold text-xs shadow-sm transition cursor-pointer"
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Prospect Radar</span>
          </button>

          <button
            onClick={() => onNavigate('call_studio')}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border font-semibold text-xs transition cursor-pointer bg-[var(--pv-card)] border-[var(--pv-border)] text-[var(--pv-ink)] hover:bg-[var(--pv-mint)]"
          >
            <PhoneCall className="w-3.5 h-3.5 text-[var(--pv-green)]" />
            <span>Dialer Studio</span>
          </button>

          <button
            onClick={() => onNavigate('territory_maps')}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border font-semibold text-xs transition cursor-pointer bg-[var(--pv-sky-tint)] border-[var(--pv-border)] text-[var(--pv-sky)] hover:brightness-95"
          >
            <MapPin className="w-3.5 h-3.5 text-[var(--pv-sky)]" />
            <span>Field Maps</span>
          </button>
        </div>
      </div>

      {/* 2. Executive Brand Hero — Pulsar Galaxy Mark, Live Indicators & Strategic Actions */}
      <PulsarBrandHero
        stats={stats}
        leads={leads}
        tasks={tasks}
        onNavigate={onNavigate}
        activeNicheTitle={nicheTemplate.name}
      />

      {/* 3. Horizontal Business-Growth KPI Strip (5 Scannable Metrics) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        
        {/* KPI 1: Prospects Discovered */}
        <div className="pv-card pv-card-hover p-5">
          <div className="flex items-center justify-between text-xs text-[var(--pv-muted)] mb-1.5 font-medium">
            <span>Discovered</span>
            <span className="pv-chip pv-tint-green" style={{ width: 32, height: 32, borderRadius: 10 }}><Building2 className="w-4 h-4" /></span>
          </div>
          <CountNum value={leads.length} className="text-[28px] font-black font-display tracking-tight tabular-nums text-[var(--pv-ink)]" />
          <div className="text-[11px] text-[var(--pv-muted)] mt-1 flex items-center justify-between">
            <span>+{stats.leadsScraped} today</span>
            <span className="text-[var(--pv-green)] font-mono text-[10px] font-semibold">Registry</span>
          </div>
        </div>

        {/* KPI 2: Qualified Leads */}
        <div className="pv-card pv-card-hover p-5">
          <div className="flex items-center justify-between text-xs text-[var(--pv-muted)] mb-1.5 font-medium">
            <span>Qualified Pipeline</span>
            <span className="pv-chip pv-tint-sky" style={{ width: 32, height: 32, borderRadius: 10 }}><ShieldCheck className="w-4 h-4" /></span>
          </div>
          <CountNum value={qualifiedLeads.length} className="text-[28px] font-black font-display tracking-tight tabular-nums text-[var(--pv-ink)]" />
          <div className="text-[11px] text-[var(--pv-muted)] mt-1 flex items-center justify-between">
            <span>{Math.round((qualifiedLeads.length / Math.max(1, leads.length)) * 100)}% match</span>
            <span className="text-[var(--pv-sky)] font-mono text-[10px] font-semibold">High Intent</span>
          </div>
        </div>

        {/* KPI 3: AI Telephony Connects */}
        <div className="pv-card pv-card-hover p-5">
          <div className="flex items-center justify-between text-xs text-[var(--pv-muted)] mb-1.5 font-medium">
            <span>Calls Placed</span>
            <span className="pv-chip pv-tint-green" style={{ width: 32, height: 32, borderRadius: 10 }}><PhoneCall className="w-4 h-4" /></span>
          </div>
          <CountNum value={stats.callsPlaced} className="text-[28px] font-black font-display tracking-tight tabular-nums text-[var(--pv-ink)]" />
          <div className="text-[11px] text-[var(--pv-muted)] mt-1 flex items-center justify-between">
            <span>{stats.humanConnects} connects</span>
            <span className="text-[var(--pv-green)] font-mono text-[10px] font-semibold">
              {Math.round((stats.humanConnects / Math.max(1, stats.callsPlaced)) * 100)}% pickup
            </span>
          </div>
        </div>

        {/* KPI 4: Warm Transfers Bridged */}
        <div className="pv-card pv-card-hover p-5">
          <div className="flex items-center justify-between text-xs text-[var(--pv-muted)] mb-1.5 font-medium">
            <span>Warm Transfers</span>
            <span className="pv-chip pv-tint-amber" style={{ width: 32, height: 32, borderRadius: 10 }}><PhoneForwarded className="w-4 h-4" /></span>
          </div>
          <CountNum value={warmTransfers.length} className="text-[28px] font-black font-display tracking-tight tabular-nums text-[var(--pv-ink)]" />
          <div className="text-[11px] text-[var(--pv-muted)] mt-1 flex items-center justify-between">
            <span>{stats.auditsBooked} audits booked</span>
            <span className="text-[var(--pv-amber)] font-mono text-[10px] font-semibold">Manager</span>
          </div>
        </div>

        {/* KPI 5: Pipeline Added */}
        <div className="pv-card pv-card-hover p-5 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-xs text-[var(--pv-muted)] mb-1.5 font-medium">
            <span>Pipeline Value</span>
            <span className="pv-chip pv-tint-violet" style={{ width: 32, height: 32, borderRadius: 10 }}><TrendingUp className="w-4 h-4" /></span>
          </div>
          <div className="text-xl sm:text-[28px] font-black font-display tracking-tight text-[var(--pv-ink)] tabular-nums truncate">
            {stats.pipelineAdded}
          </div>
          <div className="text-[11px] text-[var(--pv-muted)] mt-1 flex items-center justify-between">
            <span>Contract pipeline</span>
            <span className="text-[var(--pv-accent)] font-mono text-[10px] font-semibold">Active</span>
          </div>
        </div>

      </div>

      {/* 4. Main Spatial Workspace Grid: 2/3 Primary Zone & 1/3 Supporting Zone */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Left 2 Cols: Primary Zone (AI Intelligence Panel, Priority Outreach Queue & Stage Funnel) */}
        <div className="lg:col-span-2 space-y-5">
          
          {/* Prominent AI Business Intelligence Panel */}
          <PulsarIntelligencePanel
            leads={leads}
            tasks={tasks}
            stats={stats}
            onNavigate={onNavigate}
            onTriggerCall={onTriggerCall}
            onOpenCopilot={onOpenAI}
          />

          {/* Priority Outreach & Lead Queue */}
          <div className="pv-panel p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold tracking-tight font-display text-[var(--text-primary)]">
                  Priority Outreach & Target Accounts
                </h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  Verified decision-makers ready for autonomous telephony engagement
                </p>
              </div>

              <button
                onClick={() => onNavigate('leads')}
                className="text-xs font-semibold text-[var(--pv-green)] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Full Prospect Database ({leads.length})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Leads List */}
            <div className="space-y-2.5">
              {displayLeads.length === 0 ? (
                <div className="py-8 text-center text-xs text-[var(--text-secondary)]">
                  No prospects match the selected filter.
                </div>
              ) : (
                displayLeads.slice(0, 4).map((lead) => (
                  <div 
                    key={lead.id}
                    className="p-3.5 rounded-2xl border border-[var(--pv-border)] bg-[var(--pv-card-soft)] hover:bg-[var(--pv-mint)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs sm:text-sm text-[var(--text-primary)] truncate">
                          {lead.practiceName}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--pv-mint)] text-[var(--pv-green)] border border-[var(--pv-mint-2)] font-semibold shrink-0">
                          {lead.status}
                        </span>
                      </div>
                      
                      <div className="text-xs text-[var(--text-secondary)] flex flex-wrap items-center gap-2">
                        <span className="font-medium text-slate-800 dark:text-slate-200">{lead.doctorName}</span>
                        <span>·</span>
                        <span>{lead.specialty}</span>
                        <span>·</span>
                        <span className="font-mono">{lead.monthlyClaimVolume}</span>
                        <span>·</span>
                        <span className="text-slate-500">{lead.state}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        onClick={() => onTriggerCall(lead)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[var(--pv-green)] hover:bg-[var(--pv-accent)] text-white font-bold text-xs transition cursor-pointer shadow-sm"
                      >
                        <PhoneCall className="w-3.5 h-3.5" />
                        <span>Dial</span>
                      </button>

                      <button
                        onClick={() => onNavigate('territory_maps')}
                        className="p-1.5 rounded-full border transition cursor-pointer bg-[var(--pv-card)] border-[var(--pv-border)] text-[var(--pv-muted)] hover:text-[var(--pv-ink)]"
                        title="Locate on Territory Map"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Revenue Stage Conversion Funnel */}
          <div className="pv-panel p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold tracking-tight font-display text-[var(--text-primary)]">
                  Sales Pipeline & Stage Conversion
                </h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  {stats.pipelineAdded} Pipeline Added across {leads.length} accounts
                </p>
              </div>

              <button
                onClick={() => onNavigate('pipeline')}
                className="text-xs font-semibold text-[var(--pv-sky)] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Velocity Hub</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] mb-1 font-medium">
                  <span>Stage 1: Discovery & Radar Ingestion</span>
                  <span className="font-mono tabular-nums text-[var(--text-primary)] font-bold">{leads.length} accounts</span>
                </div>
                <div className="pv-track">
                  <div style={{ width: '100%', background: 'var(--pv-sky)' }} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] mb-1 font-medium">
                  <span>Stage 2: AI Voice Decision-Maker Engagement</span>
                  <span className="font-mono tabular-nums text-[var(--text-primary)] font-bold">{stats.humanConnects} connects</span>
                </div>
                <div className="pv-track">
                  <div style={{ width: `${Math.round((stats.humanConnects / Math.max(1, leads.length)) * 100)}%` }} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] mb-1 font-medium">
                  <span>Stage 3: Manager Warm Handoff & Complimentary Audits</span>
                  <span className="font-mono tabular-nums text-[var(--text-primary)] font-bold">{warmTransfers.length} bridged</span>
                </div>
                <div className="pv-track">
                  <div style={{ width: `${Math.round((warmTransfers.length / Math.max(1, leads.length)) * 100)}%`, background: 'var(--pv-violet)' }} />
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Right 1 Col: Supporting Zone (Telephony Status, Warm Transfers, Approvals, Autonomous Fleet) */}
        <div className="space-y-5">
          
          {/* Dedicated Telephony Status: Current SIP Gateway & WhatsApp Link Status */}
          <TelephonyStatusCard 
            settings={settings}
            onOpenSettings={onOpenSettings}
          />

          {/* Live Warm Transfers */}
          <div className="pv-panel p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PhoneForwarded className="w-4 h-4 text-[var(--pv-accent)]" />
                <h3 className="font-bold text-sm text-[var(--text-primary)]">Live Warm Transfers</h3>
              </div>

              <button
                onClick={() => onNavigate('briefing')}
                className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer font-medium"
              >
                Briefing →
              </button>
            </div>

            <div className="space-y-2.5">
              {warmTransfers.length === 0 ? (
                <div className="py-6 text-center text-xs text-[var(--text-secondary)]">
                  No warm transfers bridged yet today.
                </div>
              ) : (
                warmTransfers.slice(0, 3).map((record) => (
                  <div 
                    key={record.id}
                    className="p-3 rounded-2xl border border-[var(--pv-border)] bg-[var(--pv-card-soft)] text-xs space-y-1.5 transition"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[var(--text-primary)]">{record.leadName}</span>
                      <span className="text-[10px] font-mono text-[var(--pv-accent)] font-semibold">{record.bridgedAt}</span>
                    </div>
                    <div className="text-[var(--text-secondary)] text-[11px]">{record.practiceName} · {record.phone}</div>
                    <div className="text-[11px] text-[var(--pv-green)] bg-[var(--pv-mint)] px-2 py-0.5 rounded-full border border-[var(--pv-mint-2)] font-semibold">
                      Outcome: {record.outcome}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Pending Tasks & Approvals Queue */}
          <div className="pv-panel p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-[var(--pv-amber)]" />
                <h3 className="font-bold text-sm text-[var(--text-primary)]">Action Items & Due Tasks</h3>
              </div>

              <button
                onClick={() => onNavigate('reminders')}
                className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer font-medium"
              >
                All Tasks →
              </button>
            </div>

            <div className="space-y-2">
              {pendingTasks.length === 0 ? (
                <div className="py-6 text-center text-xs text-[var(--text-secondary)]">
                  All action items completed. No pending approvals.
                </div>
              ) : (
                pendingTasks.slice(0, 4).map((task) => (
                  <div 
                    key={task.id}
                    className="p-3 rounded-2xl border border-[var(--pv-border)] bg-[var(--pv-card-soft)] text-xs flex items-center justify-between gap-3 transition"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-[var(--text-primary)] truncate">{task.task}</div>
                      <div className="text-[10px] text-[var(--text-secondary)] font-mono mt-0.5">
                        Due: {task.due} · {task.priority} Priority
                      </div>
                    </div>

                    <button
                      onClick={() => onToggleTask(task.id)}
                      className="p-1.5 rounded-full border border-[var(--pv-mint-2)] bg-[var(--pv-mint)] hover:bg-[var(--pv-mint-2)] text-[var(--pv-green)] transition cursor-pointer shrink-0"
                      title="Mark Completed"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Autonomous Fleet Guardrails Status */}
          <div className="pv-panel p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-[var(--pv-violet)]" />
                <h3 className="font-bold text-sm text-[var(--text-primary)]">Autonomous Fleet</h3>
              </div>

              <button
                onClick={() => onNavigate('ai_agents')}
                className="text-xs text-[var(--pv-violet)] hover:underline font-semibold cursor-pointer"
              >
                Guardrails →
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-2xl border border-[var(--pv-border)] bg-[var(--pv-card-soft)] flex items-center justify-between">
                <div>
                  <div className="font-bold text-[var(--text-primary)]">Skiper Radar Scraper</div>
                  <div className="text-[11px] text-[var(--text-secondary)]">Registry specialty discovery</div>
                </div>
                <span className="text-[10px] font-mono text-[var(--pv-accent)] font-bold">ACTIVE</span>
              </div>

              <div className="p-2.5 rounded-2xl border border-[var(--pv-border)] bg-[var(--pv-card-soft)] flex items-center justify-between">
                <div>
                  <div className="font-bold text-[var(--text-primary)]">Zoey Telephony Caller</div>
                  <div className="text-[11px] text-[var(--text-secondary)]">Inbound & outbound telephony</div>
                </div>
                <span className="text-[10px] font-mono text-[var(--pv-green)] font-bold">READY</span>
              </div>

              <div className="p-2.5 rounded-2xl border border-[var(--pv-border)] bg-[var(--pv-card-soft)] flex items-center justify-between">
                <div>
                  <div className="font-bold text-[var(--text-primary)]">PST Executive Dispatcher</div>
                  <div className="text-[11px] text-[var(--text-secondary)]">Automated 4:00 PM briefing</div>
                </div>
                <span className="text-[10px] font-mono text-[var(--pv-amber)] font-bold">4:00 PM</span>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
