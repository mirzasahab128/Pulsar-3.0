import React from 'react';
import { 
  ArrowRight, 
  Sparkles, 
  MapPin, 
  ShieldCheck, 
  TrendingUp, 
  PhoneCall, 
  Building2,
  Users,
  CheckCircle2,
  Activity
} from 'lucide-react';
import { PulsarGalaxy } from './PulsarGalaxy';
import { PulsarSpatialModule, DailyStats, RCMLead, ActionItem } from '../types';
import { useTheme } from '../context/ThemeContext';

interface PulsarBrandHeroProps {
  stats: DailyStats;
  leads: RCMLead[];
  tasks: ActionItem[];
  onNavigate: (module: PulsarSpatialModule) => void;
  onOpenRadar?: () => void;
  activeNicheTitle?: string;
}

export const PulsarBrandHero: React.FC<PulsarBrandHeroProps> = ({
  stats,
  leads,
  tasks,
  onNavigate,
  onOpenRadar,
  activeNicheTitle = 'All Industries'
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Live genuine indicators based on application data
  const hasLeads = leads.length > 0;
  const pendingTasksCount = tasks.filter(t => !t.completed).length;
  const readyForCallCount = leads.filter(l => l.status === 'Ready for Call').length;
  const auditScheduledCount = leads.filter(l => l.status === 'Audit Scheduled').length;

  // System status text derived from genuine state
  const systemStatus = hasLeads 
    ? 'Intelligence Engine Active'
    : 'Prospecting Ready';

  return (
    <section 
      className={`relative rounded-3xl p-6 sm:p-8 border transition-all duration-300 overflow-hidden ${
        isDark
          ? 'bg-gradient-to-r from-[#111C2E]/95 via-[#17263B]/90 to-[#111C2E]/95 border-slate-700/40 shadow-[0_20px_50px_rgba(0,0,0,0.45)]'
          : 'bg-gradient-to-r from-white/95 via-[#EAF5F7]/80 to-white/95 border-[#DCE5EC] shadow-[0_12px_36px_rgba(23,35,56,0.06)]'
      }`}
      aria-label="Pulsar Executive Command Hero"
    >
      {/* Subtle Atmospheric Depth Gradients */}
      <div 
        className="absolute top-0 right-0 w-96 h-96 pointer-events-none rounded-full transition-opacity duration-500 opacity-20 dark:opacity-25"
        style={{
          background: 'radial-gradient(circle, rgba(56, 189, 248, 0.4) 0%, rgba(13, 148, 136, 0.25) 40%, transparent 70%)',
          filter: 'blur(45px)',
          transform: 'translate(25%, -25%)'
        }}
      />
      <div 
        className="absolute bottom-0 left-1/3 w-80 h-80 pointer-events-none rounded-full transition-opacity duration-500 opacity-15 dark:opacity-20"
        style={{
          background: 'radial-gradient(circle, rgba(37, 99, 235, 0.35) 0%, transparent 65%)',
          filter: 'blur(40px)',
          transform: 'translateY(40%)'
        }}
      />

      {/* Main Content Layout */}
      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6 lg:gap-8">
        
        {/* Left: Brand Identity, Pulsar Galaxy Mark, Headline & Purpose */}
        <div className="flex-1 min-w-0 space-y-4">
          
          {/* Top Status Bar & Genuine System Health */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {/* Live Operational Status */}
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border backdrop-blur-md font-mono text-[11px] font-semibold tracking-wide ${
              isDark 
                ? 'bg-teal-950/40 border-teal-500/30 text-teal-300' 
                : 'bg-teal-50 border-teal-200 text-teal-800'
            }`}>
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse shadow-[0_0_8px_#2dd4bf]" />
              <span>{systemStatus}</span>
            </div>

            <span className="text-slate-400 dark:text-slate-600">·</span>
            
            {/* Contextual Niche Tag (clean unboxed text) */}
            <span className="text-slate-500 dark:text-slate-400 font-medium">
              Target: <strong className="text-slate-800 dark:text-slate-200">{activeNicheTitle.split('&')[0].trim()}</strong>
            </span>

            {/* Quick Live Counters */}
            <span className="hidden sm:inline text-slate-400 dark:text-slate-600">·</span>
            <span className="hidden sm:inline text-slate-500 dark:text-slate-400">
              <span className="tabular-nums font-bold text-slate-800 dark:text-slate-200">{leads.length}</span> verified records in radar
            </span>
          </div>

          {/* Headline & Description */}
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight font-display text-[#172338] dark:text-[#F1F5F9] leading-tight">
              Your Business Growth, Connected.
            </h1>
            <p className="text-sm sm:text-base text-[#64748B] dark:text-[#A7B5C8] max-w-2xl leading-relaxed">
              Discover qualified prospects, enrich client intelligence, build meaningful networks, and turn outreach into measurable growth — from one intelligent workspace.
            </p>
          </div>

          {/* Actions Bar */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            {/* Primary Action (Teal Accent) */}
            <button
              onClick={() => onNavigate('leads')}
              type="button"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-[#0D9488] hover:bg-[#0f766e] dark:bg-[#0D9488] dark:hover:bg-[#14b8a6] shadow-lg shadow-teal-500/20 hover:shadow-teal-500/30 transition-all duration-200 cursor-pointer active:scale-98"
            >
              <Building2 className="w-4 h-4 shrink-0" />
              <span>Discover Qualified Prospects</span>
              <ArrowRight className="w-4 h-4 shrink-0" />
            </button>

            {/* Secondary Action (Trust Blue Accent) */}
            <button
              onClick={() => onNavigate('territory_maps')}
              type="button"
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm border transition-all duration-200 cursor-pointer ${
                isDark
                  ? 'bg-slate-800/60 hover:bg-slate-700/60 border-slate-700 text-slate-200 hover:text-white'
                  : 'bg-white hover:bg-slate-50 border-[#DCE5EC] text-slate-700 shadow-sm'
              }`}
            >
              <MapPin className="w-4 h-4 text-[#2563EB] dark:text-[#60A5FA] shrink-0" />
              <span>Territory & Field Maps</span>
            </button>

            {/* AI Insights Action (Violet Accent) */}
            <button
              onClick={() => onNavigate('network')}
              type="button"
              className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl font-medium text-xs border transition-all duration-200 cursor-pointer ${
                isDark
                  ? 'bg-violet-950/30 hover:bg-violet-900/40 border-violet-800/40 text-violet-300'
                  : 'bg-purple-50 hover:bg-purple-100/80 border-purple-200 text-purple-900'
              }`}
            >
              <Users className="w-3.5 h-3.5 shrink-0" />
              <span>Network Builder</span>
            </button>
          </div>
        </div>

        {/* Right: Signature Animated Galaxy Mark & Compact Telemetry Badge */}
        <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-4 shrink-0 lg:pl-6 border-t sm:border-t-0 sm:border-l border-slate-200 dark:border-slate-800/60 pt-4 sm:pt-0">
          
          {/* Animated Galaxy Mark */}
          <div className="relative group cursor-pointer" onClick={() => onNavigate('leads')}>
            <PulsarGalaxy size="hero" state="active" glow={true} />
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-mono uppercase font-bold tracking-wider text-teal-600 dark:text-teal-400 opacity-90">
              Pulsar Core
            </div>
          </div>

          {/* Compact System Health Pill */}
          <div className={`p-2.5 rounded-xl border text-xs font-mono backdrop-blur-md text-right ${
            isDark 
              ? 'bg-[#111C2E]/80 border-slate-700/40 text-slate-300' 
              : 'bg-white/80 border-[#DCE5EC] text-slate-700 shadow-sm'
          }`}>
            <div className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400">
              Pipeline Health
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
              {stats.auditsBooked || auditScheduledCount} Audits Active
            </div>
            <div className="text-[11px] text-teal-600 dark:text-teal-400 tabular-nums">
              {readyForCallCount} Ready for Outreach
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};
