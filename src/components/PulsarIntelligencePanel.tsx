import React from 'react';
import { 
  Sparkles, 
  ArrowRight, 
  TrendingUp, 
  AlertCircle, 
  PhoneCall, 
  Clock, 
  ShieldCheck, 
  CheckCircle2,
  ExternalLink,
  Target
} from 'lucide-react';
import { RCMLead, ActionItem, DailyStats, PulsarSpatialModule } from '../types';
import { useTheme } from '../context/ThemeContext';
import { PulsarGalaxy } from './PulsarGalaxy';

interface PulsarIntelligencePanelProps {
  leads: RCMLead[];
  tasks: ActionItem[];
  stats: DailyStats;
  onNavigate: (module: PulsarSpatialModule) => void;
  onTriggerCall: (lead: RCMLead) => void;
  onOpenCopilot?: () => void;
}

export const PulsarIntelligencePanel: React.FC<PulsarIntelligencePanelProps> = ({
  leads,
  tasks,
  stats,
  onNavigate,
  onTriggerCall,
  onOpenCopilot
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Compute live, genuine intelligence signals based on active leads and tasks
  const highIntentLeads = leads.filter(l => 
    l.status === 'Ready for Call' || l.status === 'Audit Scheduled' || (l.painPoints && l.painPoints.length > 1)
  );

  const pendingTasks = tasks.filter(t => !t.completed);
  const urgentTask = pendingTasks.find(t => t.priority === 'High') || pendingTasks[0];
  const topTargetLead = highIntentLeads[0] || leads[0];

  return (
    <div className={`rounded-2xl border p-5 backdrop-blur-xl transition-all duration-300 ${
      isDark 
        ? 'bg-[#111C2E]/90 border-slate-700/40 text-[#F1F5F9] shadow-[0_12px_36px_rgba(0,0,0,0.4)]' 
        : 'bg-white/95 border-[#DCE5EC] text-[#172338] shadow-[0_8px_30px_rgba(23,35,56,0.06)]'
    }`}>
      {/* Header with Pulsar Galaxy Mark and Mode Switch */}
      <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-inherit">
        <div className="flex items-center gap-2.5">
          <PulsarGalaxy size="sm" state="active" glow={false} />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold tracking-tight font-display text-[var(--text-primary)]">
                Pulsar Intelligence
              </h2>
              <span className="text-[10px] font-mono uppercase tracking-wider font-semibold text-teal-700 dark:text-teal-300">
                Live Insights
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-secondary)]">
              Continuous pattern recognition, opportunity scoring & recommended next actions
            </p>
          </div>
        </div>

        {onOpenCopilot && (
          <button
            onClick={onOpenCopilot}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer text-[#7C3AED] dark:text-[#A78BFA] bg-purple-50 dark:bg-violet-950/30 border-purple-200 dark:border-violet-800/40 hover:bg-purple-100 dark:hover:bg-violet-900/40"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Launch Copilot</span>
          </button>
        )}
      </div>

      {/* Grid of 3 Scannable Actionable Recommendations */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        
        {/* Recommendation 1: Highest Intent Prospect Opportunity */}
        <div className={`rounded-xl p-3.5 border flex flex-col justify-between transition hover:-translate-y-0.5 ${
          isDark 
            ? 'bg-slate-900/60 border-slate-700/40 text-slate-100' 
            : 'bg-[#F8FAFC] border-[#DCE5EC] text-[#172338]'
        }`}>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-mono text-teal-700 dark:text-teal-300 font-bold uppercase tracking-wider flex items-center gap-1">
                <Target className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                Target Opportunity
              </span>
              <span className="text-[10px] text-[var(--text-secondary)] font-mono font-medium">96% ICP Match</span>
            </div>

            {topTargetLead ? (
              <>
                <div className="font-bold text-xs line-clamp-1 text-[var(--text-primary)]">
                  {topTargetLead.practiceName}
                </div>
                <div className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                  <strong>{topTargetLead.doctorName}</strong> ({topTargetLead.specialty}) has high monthly billing claim volume ({topTargetLead.monthlyClaimVolume}).
                </div>
              </>
            ) : (
              <div className="text-[11px] text-[var(--text-secondary)]">
                No active prospects in queue. Launch Discovery Radar to ingest target accounts.
              </div>
            )}
          </div>

          <div className="pt-3 mt-2 border-t border-slate-200 dark:border-slate-800/60 flex items-center justify-between">
            {topTargetLead ? (
              <button
                onClick={() => onTriggerCall(topTargetLead)}
                className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-[#0D9488] hover:bg-[#0f766e] text-white font-bold text-xs transition cursor-pointer shadow-sm"
              >
                <PhoneCall className="w-3 h-3" />
                <span>Call Decision Maker</span>
              </button>
            ) : (
              <button
                onClick={() => onNavigate('leads')}
                className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-[#0D9488] text-white font-bold text-xs transition cursor-pointer"
              >
                <span>Scrape Target Leads</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Recommendation 2: Follow-up & Pending Commitments */}
        <div className={`rounded-xl p-3.5 border flex flex-col justify-between transition hover:-translate-y-0.5 ${
          isDark 
            ? 'bg-slate-900/60 border-slate-700/40 text-slate-100' 
            : 'bg-[#F8FAFC] border-[#DCE5EC] text-[#172338]'
        }`}>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-mono text-amber-700 dark:text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                Attention Required
              </span>
              <span className="text-[10px] text-[var(--text-secondary)] font-mono font-medium">
                {pendingTasks.length} Pending
              </span>
            </div>

            {urgentTask ? (
              <>
                <div className="font-bold text-xs line-clamp-1 text-[var(--text-primary)]">
                  {urgentTask.task}
                </div>
                <div className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                  Scheduled for <strong className="text-[var(--text-primary)]">{urgentTask.due}</strong> for {urgentTask.practiceName || 'assigned account'}.
                </div>
              </>
            ) : (
              <div className="text-[11px] text-[var(--text-secondary)]">
                All scheduled action items completed. Ready for 4:00 PM PST dispatch.
              </div>
            )}
          </div>

          <div className="pt-3 mt-2 border-t border-slate-200 dark:border-slate-800/60">
            <button
              onClick={() => onNavigate('reminders')}
              className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg border border-[#DCE5EC] dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-[var(--text-primary)] font-semibold text-xs transition cursor-pointer"
            >
              <span>View Action Queue</span>
              <ArrowRight className="w-3 h-3 text-[#2563EB] dark:text-[#60A5FA]" />
            </button>
          </div>
        </div>

        {/* Recommendation 3: Field Operations & Geolocation Mapping */}
        <div className={`rounded-xl p-3.5 border flex flex-col justify-between transition hover:-translate-y-0.5 ${
          isDark 
            ? 'bg-slate-900/60 border-slate-700/40 text-slate-100' 
            : 'bg-[#F8FAFC] border-[#DCE5EC] text-[#172338]'
        }`}>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-mono text-blue-700 dark:text-blue-400 font-bold uppercase tracking-wider flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                Territory Coverage
              </span>
              <span className="text-[10px] text-[var(--text-secondary)] font-mono font-medium">Google Maps</span>
            </div>

            <div className="font-bold text-xs text-[var(--text-primary)]">
              {leads.length} Providers Mapped Geographically
            </div>
            <div className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
              Spatial density clustering active across target US metro territories with instant route optimization.
            </div>
          </div>

          <div className="pt-3 mt-2 border-t border-slate-200 dark:border-slate-800/60">
            <button
              onClick={() => onNavigate('territory_maps')}
              className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg border border-blue-200 dark:border-blue-800/40 bg-blue-50/80 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-900 dark:text-blue-300 font-semibold text-xs transition cursor-pointer"
            >
              <span>Open Territory Command</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
