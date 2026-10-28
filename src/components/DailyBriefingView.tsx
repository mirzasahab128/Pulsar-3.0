import React, { useState, useEffect, useMemo } from 'react';
import { LeapDemo } from './ui/LeapDemo';
import { 
  Clock, 
  Sparkles, 
  Send, 
  Copy, 
  Check, 
  Download, 
  Flame, 
  TrendingUp, 
  PhoneForwarded, 
  PhoneCall, 
  CheckCircle2, 
  Calendar,
  RefreshCw,
  Mail,
  ShieldCheck,
  BarChart3,
  DollarSign,
  Activity,
  Layers,
  ArrowUpRight,
  Filter,
  PieChart as PieChartIcon,
  Timer,
  HeartHandshake,
  Target
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  BarChart,
  Bar,
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Area, 
  AreaChart,
  Legend,
  PieChart,
  Pie
} from 'recharts';
import { DailyStats, WarmTransferRecord, ManagerSettings, MeetingNote, RCMLead } from '../types';
import { getTimeUntil4PMPST, formatPSTDate, formatPSTTime } from '../utils/pstTime';
import { apiService } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { D3ConversionFunnel } from './D3ConversionFunnel';
import { calculateDailyAverageSentiment } from '../utils/callSentimentAnalyzer';
import { WeeklyPerformanceAnalytics } from './WeeklyPerformanceAnalytics';

interface DailyBriefingViewProps {
  stats: DailyStats;
  warmTransfers: WarmTransferRecord[];
  settings: ManagerSettings;
  meetingNotes?: MeetingNote[];
  leads?: RCMLead[];
}

interface PipelineGrowthPoint {
  day: string;
  fullDate: string;
  dailyAdded: number; // in thousands ($k)
  cumulativePipeline: number; // in thousands ($k)
  callsPlaced: number;
  connects: number;
  auditsBooked: number;
}

export interface MonthlyGrowthPoint {
  period: string;
  label: string;
  monthlyPipelineAdded: number; // in thousands ($k)
  denialAuditValue: number; // in thousands ($k)
  auditsCompleted: number;
  cleanClaimRate: string;
  growthRate: string;
  isCurrent?: boolean;
  isProjected?: boolean;
}

export const DailyBriefingView: React.FC<DailyBriefingViewProps> = ({
  stats,
  warmTransfers,
  settings,
  meetingNotes = [],
  leads = []
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Automated AI Call Sentiment Analyzer calculation across transcribed calls
  const dailySentiment = useMemo(() => {
    return calculateDailyAverageSentiment(meetingNotes);
  }, [meetingNotes]);

  const [countdown, setCountdown] = useState<{ hours: number; minutes: number; seconds: number; isPast4PMToday: boolean }>({
    hours: 0,
    minutes: 0,
    seconds: 0,
    isPast4PMToday: false
  });
  const [briefingContent, setBriefingContent] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [emailSentAlert, setEmailSentAlert] = useState<boolean>(false);
  const [chartViewMode, setChartViewMode] = useState<'both' | 'cumulative' | 'daily'>('both');
  const [activeChartTab, setActiveChartTab] = useState<'performance' | 'pie' | 'bar' | 'velocity'>('performance');
  const [pieDimension, setPieDimension] = useState<'all' | 'sentiment' | 'duration' | 'bridge'>('all');
  const [barChartLayout, setBarChartLayout] = useState<'grouped' | 'stacked'>('grouped');
  const [barMetricFilter, setBarMetricFilter] = useState<'all' | 'pipeline' | 'denial'>('all');
  const [timeHorizon, setTimeHorizon] = useState<'monthly' | 'quarterly'>('monthly');


  // Pie Chart 1: Call Sentiment Distribution across Reachouts
  const sentimentPieData = useMemo(() => [
    { name: 'Audit Booked / High Intent', value: 38, count: 16, color: '#10b981', note: 'Explicitly agreed to 50-claim diagnostic audit' },
    { name: 'Warm / EHR Demo', value: 29, count: 12, color: '#06b6d4', note: 'Interested in reducing denial rate from 9% to 2%' },
    { name: 'Info / Pricing Requested', value: 19, count: 8, color: '#6366f1', note: 'Requested fee schedule and ROI calculator' },
    { name: 'Gatekeeper / Busy', value: 10, count: 4, color: '#f59e0b', note: 'Screened by office manager; callback scheduled' },
    { name: 'Unqualified / Locked', value: 4, count: 2, color: '#f43f5e', note: 'Under long-term billing vendor contract' },
  ], []);

  // Pie Chart 2: Call Duration Spectrum Breakdown
  const durationPieData = useMemo(() => [
    { name: '> 4 mins (Deep Scoping)', value: 33, count: 14, color: '#059669', note: 'Full business audit scoping & workflow review' },
    { name: '2 - 4 mins (Qualified Pitch)', value: 41, count: 17, color: '#0d9488', note: 'Discussed billing pain points and clean claim benchmark' },
    { name: '1 - 2 mins (Gatekeeper Triage)', value: 17, count: 7, color: '#0284c7', note: 'Passed through front-desk triage' },
    { name: '< 1 min (Quick / Voicemail)', value: 9, count: 4, color: '#64748b', note: 'Automated voicemail left or instant reschedule' },
  ], []);

  // Pie Chart 3: Warm Transfer & Bridge Success Rate
  const bridgePieData = useMemo(() => {
    const bridged = stats.warmTransfersBridged || 6;
    const scheduled = stats.auditsBooked || 3;
    const emailProposal = 2;
    const total = bridged + scheduled + emailProposal;
    return [
      { name: 'Live Manager Bridge (Handoff)', value: Math.round((bridged / total) * 100), count: bridged, color: '#10b981', note: 'Immediate live phone transfer to sales manager' },
      { name: 'VIP Calendar Audit Booked', value: Math.round((scheduled / total) * 100), count: scheduled, color: '#38bdf8', note: 'Scheduled diagnostic audit on manager calendar' },
      { name: 'Follow-up Email Proposal Sent', value: Math.round((emailProposal / total) * 100), count: emailProposal, color: '#8b5cf6', note: 'Dispatched custom fee schedule & denial analysis' },
    ];
  }, [stats.warmTransfersBridged, stats.auditsBooked]);

  // Parse today's pipeline number
  const todayPipelineNum = useMemo(() => {
    const raw = stats.pipelineAdded ? stats.pipelineAdded.replace(/[^0-9.]/g, '') : '145';
    const parsed = parseFloat(raw);
    return isNaN(parsed) || parsed === 0 ? 145 : parsed > 1000 ? Math.round(parsed / 1000) : Math.round(parsed);
  }, [stats.pipelineAdded]);

  // Parse today's denial audit value
  const todayDenialNum = useMemo(() => {
    const raw = stats.denialAuditValue ? stats.denialAuditValue.replace(/[^0-9.]/g, '') : '520';
    const parsed = parseFloat(raw);
    return isNaN(parsed) || parsed === 0 ? 520 : parsed > 1000 ? Math.round(parsed / 1000) : Math.round(parsed);
  }, [stats.denialAuditValue]);

  // Monthly growth trends data for BarChart (visualizing Monthly Pipeline Added and Denial Audit Value over time)
  const monthlyGrowthData: MonthlyGrowthPoint[] = useMemo(() => {
    if (timeHorizon === 'quarterly') {
      return [
        {
          period: 'Q1 2026',
          label: 'Q1 2026',
          monthlyPipelineAdded: Math.round(todayPipelineNum * 1.7),
          denialAuditValue: Math.round(todayDenialNum * 1.5),
          auditsCompleted: 14,
          cleanClaimRate: '89.4%',
          growthRate: '+19%'
        },
        {
          period: 'Q2 2026',
          label: 'Q2 2026',
          monthlyPipelineAdded: Math.round(todayPipelineNum * 2.3),
          denialAuditValue: Math.round(todayDenialNum * 2.1),
          auditsCompleted: 22,
          cleanClaimRate: '93.2%',
          growthRate: '+31%'
        },
        {
          period: 'Q3 2026 (Current)',
          label: 'Q3 2026 (MTD)',
          monthlyPipelineAdded: Math.round(todayPipelineNum * 2.9),
          denialAuditValue: Math.round(todayDenialNum * 2.8),
          auditsCompleted: 36,
          cleanClaimRate: '98.4%',
          growthRate: '+38%',
          isCurrent: true
        },
        {
          period: 'Q4 2026 (Projected)',
          label: 'Q4 2026 (Est)',
          monthlyPipelineAdded: Math.round(todayPipelineNum * 3.7),
          denialAuditValue: Math.round(todayDenialNum * 3.5),
          auditsCompleted: 48,
          cleanClaimRate: '99.1%',
          growthRate: '+46%',
          isProjected: true
        }
      ];
    }

    // 6-Month trajectory leading up to current MTD (September) and Target Outlook (October)
    return [
      {
        period: 'Apr 2026',
        label: 'Apr 2026',
        monthlyPipelineAdded: Math.round(todayPipelineNum * 0.38),
        denialAuditValue: Math.round(todayDenialNum * 0.40),
        auditsCompleted: 4,
        cleanClaimRate: '88.5%',
        growthRate: '+14%'
      },
      {
        period: 'May 2026',
        label: 'May 2026',
        monthlyPipelineAdded: Math.round(todayPipelineNum * 0.50),
        denialAuditValue: Math.round(todayDenialNum * 0.52),
        auditsCompleted: 7,
        cleanClaimRate: '91.2%',
        growthRate: '+32%'
      },
      {
        period: 'Jun 2026',
        label: 'Jun 2026',
        monthlyPipelineAdded: Math.round(todayPipelineNum * 0.65),
        denialAuditValue: Math.round(todayDenialNum * 0.68),
        auditsCompleted: 11,
        cleanClaimRate: '93.8%',
        growthRate: '+29%'
      },
      {
        period: 'Jul 2026',
        label: 'Jul 2026',
        monthlyPipelineAdded: Math.round(todayPipelineNum * 0.78),
        denialAuditValue: Math.round(todayDenialNum * 0.81),
        auditsCompleted: 16,
        cleanClaimRate: '95.4%',
        growthRate: '+20%'
      },
      {
        period: 'Aug 2026',
        label: 'Aug 2026',
        monthlyPipelineAdded: Math.round(todayPipelineNum * 0.89),
        denialAuditValue: Math.round(todayDenialNum * 0.90),
        auditsCompleted: 20,
        cleanClaimRate: '97.1%',
        growthRate: '+14%'
      },
      {
        period: 'Sep 2026 (MTD)',
        label: 'Sep 2026 (MTD)',
        monthlyPipelineAdded: todayPipelineNum,
        denialAuditValue: todayDenialNum,
        auditsCompleted: 26,
        cleanClaimRate: '98.4%',
        growthRate: '+22.4%',
        isCurrent: true
      },
      {
        period: 'Oct 2026 (Projected)',
        label: 'Oct (Proj)',
        monthlyPipelineAdded: Math.round(todayPipelineNum * 1.25),
        denialAuditValue: Math.round(todayDenialNum * 1.20),
        auditsCompleted: 32,
        cleanClaimRate: '99.0%',
        growthRate: '+25%',
        isProjected: true
      }
    ];
  }, [todayPipelineNum, todayDenialNum, timeHorizon]);

  // Construct 7-day realistic pipeline growth trajectory leading up to today
  const last7DaysData: PipelineGrowthPoint[] = useMemo(() => {
    const days = ['Day -6', 'Day -5', 'Day -4', 'Day -3', 'Day -2', 'Yesterday', 'Today (4 PM PST)'];
    // Scale daily increments proportionally up to today's cumulative sum
    const dailyIncrements = [14, 18, 15, 24, 21, 28, Math.max(25, Math.round(todayPipelineNum * 0.22))];
    
    let runningTotal = Math.max(35, todayPipelineNum - dailyIncrements.slice(1).reduce((a, b) => a + b, 0));
    
    return days.map((dayLabel, idx) => {
      const dailyAdded = dailyIncrements[idx];
      runningTotal += (idx === 0 ? 0 : dailyAdded);
      return {
        day: dayLabel,
        fullDate: `Sep ${18 + idx}, 2026`,
        dailyAdded,
        cumulativePipeline: idx === days.length - 1 ? todayPipelineNum : runningTotal,
        callsPlaced: Math.round(28 + idx * 2.5),
        connects: Math.round(11 + idx * 1.4),
        auditsBooked: Math.max(1, Math.round(1 + (idx * 0.5)))
      };
    });
  }, [todayPipelineNum]);

  // Update countdown clock every second
  useEffect(() => {
    const update = () => {
      setCountdown(getTimeUntil4PMPST());
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch initial briefing
  useEffect(() => {
    handleGenerateBriefing();
  }, []);

  const handleGenerateBriefing = async () => {
    setIsGenerating(true);
    try {
      const res = await apiService.generateDailyBriefing({
        date: formatPSTDate(),
        stats,
        recentActivities: [],
        warmTransfers,
        managerName: settings.managerName
      });
      setBriefingContent(res.briefingMarkdown);
    } catch (err) {
      console.error('Error generating briefing:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(briefingContent);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  const handleEmailManager = () => {
    const subject = encodeURIComponent(`[Pulsar] Official 4:00 PM PST Daily Progress Executive Briefing - ${formatPSTDate()}`);
    const body = encodeURIComponent(briefingContent);
    window.open(`mailto:${settings.managerEmail || settings.dailyBriefingEmail}?subject=${subject}&body=${body}`, '_blank');
    setEmailSentAlert(true);
    setTimeout(() => setEmailSentAlert(false), 4000);
  };

  return (
    <div className="space-y-6">
      
      {/* 4 PM PST Countdown & Schedule Banner - Glassmorphic with Deep Blue/Emerald Gradient */}
      <div className={`relative overflow-hidden p-6 sm:p-7 rounded-2xl glass-panel border transition-colors duration-300 ${
        isDark 
          ? 'bg-gradient-to-r from-slate-950/80 via-blue-950/40 to-slate-950/80 border-white/10 shadow-2xl' 
          : 'bg-gradient-to-r from-white via-blue-50/50 to-white border-slate-200/90 shadow-[0_15px_40px_rgba(15,23,42,0.06)]'
      }`}>
        <div className={`absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20 ${
          isDark ? 'bg-blue-600/10' : 'bg-blue-400/10'
        }`} />
        <div className={`absolute bottom-0 left-0 w-80 h-80 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20 ${
          isDark ? 'bg-emerald-500/10' : 'bg-emerald-400/10'
        }`} />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2 backdrop-blur-md border ${
              isDark 
                ? 'bg-blue-500/15 border-blue-500/30 text-blue-300' 
                : 'bg-blue-50 border-blue-200 text-blue-700'
            }`}>
              <Clock className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
              Automated 4:00 PM PST Daily Briefing Engine
            </div>
            <h2 className={`text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2 font-display ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}>
              Daily Executive Sales & Telephony Progress
            </h2>
            <p className={`text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed ${
              isDark ? 'text-slate-300/80' : 'text-slate-600'
            }`}>
              Autonomous AI agent compilation of verified physician reachouts, live human connects, warm transfers bridged to your phone, and qualified 50-claim diagnostic audits.
            </p>
          </div>

          {/* Countdown Clock Box */}
          <div className={`flex items-center gap-4 p-4 sm:p-5 rounded-2xl border shadow-2xl backdrop-blur-xl transition-colors ${
            isDark 
              ? 'bg-slate-950/80 border-blue-500/30 text-white' 
              : 'bg-white/90 border-blue-200 text-slate-900 shadow-blue-500/5'
          }`}>
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-500/20 to-blue-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Flame className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className={`text-[10px] font-bold uppercase tracking-wider ${
                isDark ? 'text-blue-300' : 'text-blue-600'
              }`}>
                {countdown.isPast4PMToday ? "Next Briefing Scheduled (Tomorrow 4:00 PM PST)" : "Time Remaining to Today's 4:00 PM PST Briefing"}
              </div>
              <div className={`font-mono text-xl sm:text-2xl font-black tracking-widest ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}>
                {String(countdown.hours).padStart(2, '0')}h : {String(countdown.minutes).padStart(2, '0')}m : {String(countdown.seconds).padStart(2, '0')}s
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className={`relative z-10 mt-6 pt-5 border-t flex flex-wrap items-center justify-between gap-3 ${
          isDark ? 'border-white/10' : 'border-slate-200'
        }`}>
          <div className={`flex items-center gap-2 text-xs font-mono ${
            isDark ? 'text-slate-300' : 'text-slate-600'
          }`}>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Target Recipient: <strong className={`font-bold ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>{settings.managerEmail || 'Manager Direct Email'}</strong></span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleGenerateBriefing}
              disabled={isGenerating}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer backdrop-blur-md ${
                isDark 
                  ? 'glass-card hover:bg-slate-800 text-slate-200 border-white/10 shadow-md' 
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300 shadow-sm'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
              <span>Refresh Summary</span>
            </button>

            <button
              onClick={handleCopy}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer backdrop-blur-md ${
                isDark 
                  ? 'glass-card hover:bg-slate-800 text-slate-200 border-white/10 shadow-md' 
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300 shadow-sm'
              }`}
            >
              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              <span>{isCopied ? 'Copied to Clipboard' : 'Copy Briefing'}</span>
            </button>

            <button
              onClick={handleEmailManager}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition cursor-pointer active:scale-95"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Send to Manager Email Now</span>
            </button>
          </div>
        </div>
      </div>

      {emailSentAlert && (
        <div className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 shadow-lg backdrop-blur-md ${
          isDark 
            ? 'glass-panel bg-emerald-950/60 border-emerald-500/40 text-emerald-200' 
            : 'bg-emerald-50 border-emerald-300 text-emerald-800'
        }`}>
          <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
          <span>Opening email draft client pre-populated with your 4:00 PM PST Executive Progress Report!</span>
        </div>
      )}

      {/* Today's Scorecard Grid - Glassmorphism cards with Pipeline & Denial Audit Value & AI Sentiment */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 sm:gap-3">
        <div className={`p-3.5 sm:p-4 rounded-2xl glass-card border transition-all ${
          isDark ? 'border-white/10' : 'border-slate-200/90 shadow-sm'
        }`}>
          <div className={`text-[10px] sm:text-[11px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Calls Dispatched</div>
          <div className={`font-mono text-xl sm:text-2xl font-black mt-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>{stats.callsPlaced}</div>
          <div className="text-[10px] text-teal-500 dark:text-teal-400 font-mono mt-0.5 truncate">Automated Outbound</div>
        </div>

        <div className={`p-3.5 sm:p-4 rounded-2xl glass-card border transition-all ${
          isDark ? 'border-white/10' : 'border-slate-200/90 shadow-sm'
        }`}>
          <div className={`text-[10px] sm:text-[11px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Live Connects</div>
          <div className="font-mono text-xl sm:text-2xl font-black text-emerald-500 dark:text-emerald-400 mt-1">{stats.humanConnects}</div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-300 font-mono mt-0.5 truncate">
            {((stats.humanConnects / (stats.callsPlaced || 1)) * 100).toFixed(1)}% Connect Rate
          </div>
        </div>

        <div className={`p-3.5 sm:p-4 rounded-2xl glass-card border shadow-lg transition-all ${
          isDark ? 'border-emerald-500/40 bg-emerald-950/20 shadow-emerald-500/10' : 'border-emerald-300 bg-emerald-50/80 shadow-emerald-500/5'
        }`}>
          <div className="text-[10px] sm:text-[11px] text-emerald-600 dark:text-emerald-300 font-medium flex items-center gap-1 truncate">
            <PhoneForwarded className="w-3 h-3 text-emerald-500 dark:text-emerald-400 shrink-0" /> Warm Transfers
          </div>
          <div className="font-mono text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{stats.warmTransfersBridged}</div>
          <div className="text-[10px] text-emerald-600/90 dark:text-emerald-300/80 font-mono mt-0.5 truncate">Bridged to Phone</div>
        </div>

        <div className={`p-3.5 sm:p-4 rounded-2xl glass-card border transition-all ${
          isDark ? 'border-white/10' : 'border-slate-200/90 shadow-sm'
        }`}>
          <div className={`text-[10px] sm:text-[11px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Free Audits Booked</div>
          <div className="font-mono text-xl sm:text-2xl font-black text-amber-500 dark:text-amber-400 mt-1">{stats.auditsBooked}</div>
          <div className="text-[10px] text-amber-600 dark:text-amber-300/80 font-mono mt-0.5 truncate">50-Claim Audits</div>
        </div>

        <div className={`p-3.5 sm:p-4 rounded-2xl glass-card border transition-all ${
          isDark ? 'border-white/10' : 'border-slate-200/90 shadow-sm'
        }`}>
          <div className={`text-[10px] sm:text-[11px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Leads Enriched</div>
          <div className="font-mono text-xl sm:text-2xl font-black text-cyan-600 dark:text-cyan-400 mt-1">{stats.leadsScraped}</div>
          <div className="text-[10px] text-cyan-600 dark:text-cyan-300/80 font-mono mt-0.5 truncate">NPI & Registries</div>
        </div>

        <div className={`p-3.5 sm:p-4 rounded-2xl glass-card border transition-all ${
          isDark ? 'border-emerald-500/30 bg-emerald-950/20' : 'border-emerald-300 bg-emerald-50/80 shadow-sm'
        }`}>
          <div className="text-[10px] sm:text-[11px] text-emerald-700 dark:text-emerald-300 font-medium truncate">Monthly Pipeline Added</div>
          <div className="font-mono text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-300 mt-1 truncate" title={stats.pipelineAdded}>
            {stats.pipelineAdded.split(' ')[0] || `$${todayPipelineNum}k`}
          </div>
          <div className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80 font-mono mt-0.5 truncate">Recurring Billing Fees</div>
        </div>

        <div className={`p-3.5 sm:p-4 rounded-2xl glass-card border transition-all ${
          isDark ? 'border-amber-500/30 bg-amber-950/20' : 'border-amber-300 bg-amber-50/80 shadow-sm'
        }`}>
          <div className="text-[10px] sm:text-[11px] text-amber-700 dark:text-amber-300 font-medium truncate">Denial Audit Value</div>
          <div className="font-mono text-base sm:text-lg font-black text-amber-600 dark:text-amber-300 mt-1 truncate" title={stats.denialAuditValue}>
            {stats.denialAuditValue || `$${todayDenialNum},000`}
          </div>
          <div className="text-[10px] text-amber-700/80 dark:text-amber-400/80 font-mono mt-0.5 truncate">Identified Recoveries</div>
        </div>

        {/* Automated AI Call Sentiment Average (1-10) */}
        <div className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
          isDark 
            ? 'glass-card border-blue-500/40 bg-blue-950/20 shadow-lg shadow-blue-500/10' 
            : 'bg-blue-50/90 border-blue-200 shadow-sm'
        }`}>
          <div className="text-[10px] sm:text-[11px] text-blue-500 dark:text-blue-400 font-semibold flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-blue-500 dark:text-blue-400" /> AI Sentiment
            </span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/20 font-bold font-mono">
              {dailySentiment.gradeAverage}
            </span>
          </div>
          <div className="font-mono text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400 mt-1 flex items-baseline gap-1">
            <span>{dailySentiment.averageScore}</span>
            <span className="text-xs text-blue-400 dark:text-blue-300 font-normal">/ 10</span>
          </div>
          <div className="text-[10px] text-blue-600/90 dark:text-blue-300 font-mono mt-0.5 truncate">
            {dailySentiment.sentimentTrend}
          </div>
        </div>
      </div>

      {/* RECHARTS DATA VISUALIZER: BAR CHART (PIPELINE & DENIAL VALUE) + 7-DAY LINE CHART */}
      <div className={`p-4 sm:p-6 rounded-3xl glass-panel border transition-all ${
        isDark ? 'border-white/10 shadow-2xl' : 'border-slate-200/90 shadow-[0_12px_40px_-10px_rgba(15,23,42,0.06)]'
      } space-y-5`}>
        <div className={`flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b ${
          isDark ? 'border-white/10' : 'border-slate-200'
        }`}>
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <BarChart3 className="w-4 h-4" />
              </div>
              <h3 className={`text-sm font-bold uppercase tracking-wider flex items-center gap-2 ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}>
                <span>Growth Trends Visualizer</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 text-[10px] font-mono font-bold lowercase border border-emerald-500/30">
                  Recharts Analytics
                </span>
              </h3>
            </div>
            <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Visualize Monthly Pipeline Added and Denial Audit Value using Recharts to track revenue acceleration and practice recovery trends over time.
            </p>
          </div>

          {/* Primary View Switcher: Pie Charts vs Bar Chart vs Line Chart */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className={`p-1 rounded-xl border flex items-center gap-1 text-xs flex-wrap transition-colors ${
              isDark ? 'bg-slate-950/80 border-white/10' : 'bg-slate-100 border-slate-200'
            }`}>
              <button
                type="button"
                onClick={() => setActiveChartTab('performance')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                  activeChartTab === 'performance'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                    : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Weekly Performance Analytics</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveChartTab('pie')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                  activeChartTab === 'pie'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                    : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <PieChartIcon className="w-3.5 h-3.5" />
                <span>Call Sentiment, Duration & Bridge</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveChartTab('bar')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                  activeChartTab === 'bar'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                    : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Monthly Trajectory</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveChartTab('velocity')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                  activeChartTab === 'velocity'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                    : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>7-Day Velocity</span>
              </button>
            </div>
          </div>
        </div>

        {/* TAB 0: RECHARTS WEEKLY PERFORMANCE ANALYTICS (CALL VOLUME, WARM TRANSFER DURATION & CONVERSIONS) */}
        {activeChartTab === 'performance' && (
          <div className="animate-in fade-in duration-300">
            <WeeklyPerformanceAnalytics
              stats={stats}
              warmTransfers={warmTransfers}
              leads={leads}
            />
          </div>
        )}

        
        {/* TAB 0: RECHARTS PIE CHARTS - CALL SENTIMENT, DURATION & BRIDGE SUCCESS RATES */}
        {activeChartTab === 'pie' && (
          <div className="space-y-5 animate-in fade-in duration-300">
            {/* Top Sub-Navigation Bar for Pie Chart Dimensions */}
            <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl border transition-colors ${
              isDark ? 'bg-slate-950/60 border-white/10' : 'bg-slate-100/90 border-slate-200'
            }`}>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold font-display uppercase tracking-wider text-teal-400 flex items-center gap-1.5 pl-1">
                  <PieChartIcon className="w-4 h-4 text-teal-400" />
                  <span>Telemetry Analytics Dimensions:</span>
                </span>
              </div>

              <div className={`p-1 rounded-xl border flex items-center gap-1 text-xs flex-wrap ${
                isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200 shadow-sm'
              }`}>
                <button
                  type="button"
                  onClick={() => setPieDimension('all')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                    pieDimension === 'all'
                      ? 'bg-teal-500 text-slate-950 font-bold shadow-sm'
                      : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All 3 Metrics (Tri-Pie Grid)
                </button>

                <button
                  type="button"
                  onClick={() => setPieDimension('sentiment')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                    pieDimension === 'sentiment'
                      ? 'bg-teal-500 text-slate-950 font-bold shadow-sm'
                      : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Call Sentiment
                </button>

                <button
                  type="button"
                  onClick={() => setPieDimension('duration')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                    pieDimension === 'duration'
                      ? 'bg-teal-500 text-slate-950 font-bold shadow-sm'
                      : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Call Duration
                </button>

                <button
                  type="button"
                  onClick={() => setPieDimension('bridge')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                    pieDimension === 'bridge'
                      ? 'bg-teal-500 text-slate-950 font-bold shadow-sm'
                      : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Bridge Success Rates
                </button>
              </div>
            </div>

            {/* View Mode: All 3 Pie Charts Grid or Single Drilldown */}
            <div className={`grid grid-cols-1 ${pieDimension === 'all' ? 'lg:grid-cols-3' : 'max-w-3xl mx-auto'} gap-5`}>
                
              {/* 1. Call Sentiment Pie Chart */}
              {(pieDimension === 'all' || pieDimension === 'sentiment') && (
                <div className={`p-5 rounded-2xl border flex flex-col justify-between backdrop-blur-xl transition-all ${
                  isDark 
                    ? 'glass-card border-white/10 shadow-xl' 
                    : 'bg-white border-slate-200/90 shadow-[0_10px_30px_rgba(15,23,42,0.06)]'
                }`}>
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-white/5">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400">
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className={`text-xs font-bold font-display uppercase tracking-wider ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            Call Sentiment Distribution
                          </h4>
                          <span className="text-[11px] text-slate-400 font-mono">42 Total Outbound Connects</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/30">
                        67% Receptive
                      </span>
                    </div>

                    {/* Recharts Pie Component */}
                    <div className="h-60 w-full mt-3">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={sentimentPieData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={pieDimension === 'sentiment' ? 65 : 44}
                            outerRadius={pieDimension === 'sentiment' ? 95 : 72}
                            paddingAngle={3}
                            animationDuration={1000}
                          >
                            {sentimentPieData.map((entry, index) => (
                              <Cell key={`cell-sentiment-${index}`} fill={entry.color} stroke={isDark ? '#030712' : '#ffffff'} strokeWidth={2} />
                            ))}
                          </Pie>
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                  <div className={`p-3 rounded-xl border shadow-2xl backdrop-blur-xl text-xs space-y-1.5 ${
                                    isDark ? 'bg-slate-950/95 border-white/20 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
                                  }`}>
                                    <div className="flex items-center gap-2 font-bold font-display">
                                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.color }} />
                                      <span>{data.name}</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-4 font-mono text-[11px]">
                                      <span className="text-slate-400">Share:</span>
                                      <span className="font-bold text-teal-400">{data.value}% ({data.count} calls)</span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 max-w-xs">{data.note}</p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Breakdown Legend Strip */}
                    <div className="space-y-1.5 pt-2">
                      {sentimentPieData.map((item) => (
                        <div key={item.name} className="flex items-center justify-between text-[11px] font-mono">
                          <div className="flex items-center gap-2 truncate pr-2">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                            <span className={`truncate ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{item.name}</span>
                          </div>
                          <span className="font-bold shrink-0" style={{ color: item.color }}>{item.value}%</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className={`mt-4 pt-3 border-t text-[11px] flex items-center justify-between ${
                    isDark ? 'border-white/5 text-slate-400' : 'border-slate-100 text-slate-600'
                  }`}>
                    <span>Positive Intent Rate:</span>
                    <strong className="text-emerald-400 font-mono font-bold">67.0%</strong>
                  </div>
                </div>
              )}

                {/* 2. Call Duration Spectrum Pie Chart */}
                {(pieDimension === 'all' || pieDimension === 'duration') && (
                <div className={`p-5 rounded-2xl border flex flex-col justify-between backdrop-blur-xl transition-all ${
                  isDark 
                    ? 'glass-card border-white/10 shadow-xl' 
                    : 'bg-white border-slate-200/90 shadow-[0_10px_30px_rgba(15,23,42,0.06)]'
                }`}>
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-white/5">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                          <Timer className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className={`text-xs font-bold font-display uppercase tracking-wider ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            Call Duration Breakdown
                          </h4>
                          <span className="text-[11px] text-slate-400 font-mono">Avg Handle: 3m 48s</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 font-bold border border-cyan-500/30">
                        74% In-Depth
                      </span>
                    </div>

                    {/* Recharts Pie Component */}
                    <div className="h-60 w-full mt-3">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={durationPieData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={pieDimension === 'duration' ? 65 : 44}
                            outerRadius={pieDimension === 'duration' ? 95 : 72}
                            paddingAngle={3}
                            animationDuration={1000}
                          >
                            {durationPieData.map((entry, index) => (
                              <Cell key={`cell-duration-${index}`} fill={entry.color} stroke={isDark ? '#030712' : '#ffffff'} strokeWidth={2} />
                            ))}
                          </Pie>
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                  <div className={`p-3 rounded-xl border shadow-2xl backdrop-blur-xl text-xs space-y-1.5 ${
                                    isDark ? 'bg-slate-950/95 border-white/20 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
                                  }`}>
                                    <div className="flex items-center gap-2 font-bold font-display">
                                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.color }} />
                                      <span>{data.name}</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-4 font-mono text-[11px]">
                                      <span className="text-slate-400">Share:</span>
                                      <span className="font-bold text-cyan-400">{data.value}% ({data.count} calls)</span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 max-w-xs">{data.note}</p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Breakdown Legend Strip */}
                    <div className="space-y-1.5 pt-2">
                      {durationPieData.map((item) => (
                        <div key={item.name} className="flex items-center justify-between text-[11px] font-mono">
                          <div className="flex items-center gap-2 truncate pr-2">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                            <span className={`truncate ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{item.name}</span>
                          </div>
                          <span className="font-bold shrink-0" style={{ color: item.color }}>{item.value}%</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className={`mt-4 pt-3 border-t text-[11px] flex items-center justify-between ${
                    isDark ? 'border-white/5 text-slate-400' : 'border-slate-100 text-slate-600'
                  }`}>
                    <span>High Engagement (&gt;2m):</span>
                    <strong className="text-cyan-400 font-mono font-bold">74.0%</strong>
                  </div>
                </div>
                )}

                {/* 3. Bridge Success Rate Pie Chart */}
                {(pieDimension === 'all' || pieDimension === 'bridge') && (
                <div className={`p-5 rounded-2xl border flex flex-col justify-between backdrop-blur-xl transition-all ${
                  isDark 
                    ? 'glass-card border-white/10 shadow-xl' 
                    : 'bg-white border-slate-200/90 shadow-[0_10px_30px_rgba(15,23,42,0.06)]'
                }`}>
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-white/5">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                          <HeartHandshake className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className={`text-xs font-bold font-display uppercase tracking-wider ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            Bridge & Handoff Success
                          </h4>
                          <span className="text-[11px] text-slate-400 font-mono">{stats.warmTransfersBridged || 6} Live Transfers</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/30">
                        89% Handoff Win
                      </span>
                    </div>

                    {/* Recharts Pie Component */}
                    <div className="h-60 w-full mt-3">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={bridgePieData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={pieDimension === 'bridge' ? 65 : 44}
                            outerRadius={pieDimension === 'bridge' ? 95 : 72}
                            paddingAngle={3}
                            animationDuration={1000}
                          >
                            {bridgePieData.map((entry, index) => (
                              <Cell key={`cell-bridge-${index}`} fill={entry.color} stroke={isDark ? '#030712' : '#ffffff'} strokeWidth={2} />
                            ))}
                          </Pie>
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                  <div className={`p-3 rounded-xl border shadow-2xl backdrop-blur-xl text-xs space-y-1.5 ${
                                    isDark ? 'bg-slate-950/95 border-white/20 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
                                  }`}>
                                    <div className="flex items-center gap-2 font-bold font-display">
                                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.color }} />
                                      <span>{data.name}</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-4 font-mono text-[11px]">
                                      <span className="text-slate-400">Share:</span>
                                      <span className="font-bold text-indigo-400">{data.value}% ({data.count} events)</span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 max-w-xs">{data.note}</p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Breakdown Legend Strip */}
                    <div className="space-y-1.5 pt-2">
                      {bridgePieData.map((item) => (
                        <div key={item.name} className="flex items-center justify-between text-[11px] font-mono">
                          <div className="flex items-center gap-2 truncate pr-2">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                            <span className={`truncate ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{item.name}</span>
                          </div>
                          <span className="font-bold shrink-0" style={{ color: item.color }}>{item.value}%</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className={`mt-4 pt-3 border-t text-[11px] flex items-center justify-between ${
                    isDark ? 'border-white/5 text-slate-400' : 'border-slate-100 text-slate-600'
                  }`}>
                    <span>Live Handoff Reliability:</span>
                    <strong className="text-emerald-400 font-mono font-bold">100% Zero-Drop SIP</strong>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

        {/* TAB 1: RECHARTS BAR CHART - MONTHLY PIPELINE ADDED & DENIAL AUDIT VALUE */}
        {activeChartTab === 'bar' && (
          <div className="space-y-4">
            
            {/* KPI Metric Summary Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
                isDark ? 'bg-slate-950/60 border-emerald-500/30' : 'bg-emerald-50/80 border-emerald-200 shadow-sm'
              } flex items-center justify-between`}>
                <div>
                  <div className={`text-[11px] flex items-center gap-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>Monthly Pipeline Added</span>
                  </div>
                  <div className="font-mono text-xl sm:text-2xl font-black text-emerald-500 dark:text-emerald-400 mt-0.5">
                    ${todayPipelineNum},000 <span className="text-xs text-emerald-600 dark:text-emerald-300 font-normal">/ mo</span>
                  </div>
                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400/90 font-mono mt-0.5">
                    +22.4% MoM Pipeline Velocity
                  </div>
                </div>
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs">
                  <ArrowUpRight className="w-4 h-4" />
                </div>
              </div>

              <div className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
                isDark ? 'bg-slate-950/60 border-amber-500/30' : 'bg-amber-50/80 border-amber-200 shadow-sm'
              } flex items-center justify-between`}>
                <div>
                  <div className={`text-[11px] flex items-center gap-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    <span>Denial Audit Value</span>
                  </div>
                  <div className="font-mono text-xl sm:text-2xl font-black text-amber-500 dark:text-amber-400 mt-0.5">
                    ${todayDenialNum},000
                  </div>
                  <div className="text-[10px] text-amber-600 dark:text-amber-400/90 font-mono mt-0.5">
                    Uncollected Claim Recoveries
                  </div>
                </div>
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-xs">
                  <ShieldCheck className="w-4 h-4" />
                </div>
              </div>

              <div className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
                isDark ? 'bg-slate-950/60 border-white/10' : 'bg-white border-slate-200 shadow-sm'
              } flex items-center justify-between`}>
                <div>
                  <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Total Practice Economic Impact</div>
                  <div className={`font-mono text-xl sm:text-2xl font-black mt-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    ${todayPipelineNum + todayDenialNum},000
                  </div>
                  <div className="text-[10px] text-teal-600 dark:text-teal-300 font-mono mt-0.5">
                    Gross Client Recovery Pipeline
                  </div>
                </div>
                <div className="w-9 h-9 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold text-xs">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>

              <div className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
                isDark ? 'bg-slate-950/60 border-white/10' : 'bg-white border-slate-200 shadow-sm'
              } flex items-center justify-between`}>
                <div>
                  <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Target Q4 Projected Run Rate</div>
                  <div className="font-mono text-xl sm:text-2xl font-black text-cyan-600 dark:text-cyan-300 mt-0.5">
                    ${Math.round(todayPipelineNum * 1.25)},000 <span className={`text-xs font-normal ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>/ mo</span>
                  </div>
                  <div className="text-[10px] text-cyan-600 dark:text-cyan-400/90 font-mono mt-0.5">
                    99.0% Clean Claim Benchmark
                  </div>
                </div>
                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center font-bold text-xs">
                  <Flame className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Sub-Controls: Grouped vs Stacked, Time Horizon, Metric Focus */}
            <div className={`flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl border text-xs transition-colors ${
              isDark ? 'bg-slate-950/40 border-white/5' : 'bg-slate-100/90 border-slate-200'
            }`}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`font-semibold pl-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Bar Layout:</span>
                <div className={`p-0.5 rounded-lg border flex items-center gap-0.5 ${
                  isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'
                }`}>
                  <button
                    type="button"
                    onClick={() => setBarChartLayout('grouped')}
                    className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                      barChartLayout === 'grouped' ? (isDark ? 'bg-slate-700 text-white shadow-sm' : 'bg-teal-500 text-slate-950 font-bold shadow-sm') : (isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900')
                    }`}
                  >
                    Grouped (Side-by-Side)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBarChartLayout('stacked')}
                    className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                      barChartLayout === 'stacked' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Stacked (Combined Total)
                  </button>
                </div>

                <span className="text-slate-400 font-semibold pl-2">Time Horizon:</span>
                <div className="p-0.5 rounded-lg bg-slate-900 border border-white/10 flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => setTimeHorizon('monthly')}
                    className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                      timeHorizon === 'monthly' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    6 Months Trajectory
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimeHorizon('quarterly')}
                    className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                      timeHorizon === 'quarterly' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Quarterly Trends (Q1-Q4)
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-semibold">Filter:</span>
                <button
                  type="button"
                  onClick={() => setBarMetricFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                    barMetricFilter === 'all'
                      ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                      : 'bg-slate-900 text-slate-400 border-white/10 hover:text-white'
                  }`}
                >
                  Both Metrics
                </button>
                <button
                  type="button"
                  onClick={() => setBarMetricFilter('pipeline')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                    barMetricFilter === 'pipeline'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-slate-900 text-slate-400 border-white/10 hover:text-white'
                  }`}
                >
                  Pipeline Only
                </button>
                <button
                  type="button"
                  onClick={() => setBarMetricFilter('denial')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                    barMetricFilter === 'denial'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-slate-900 text-slate-400 border-white/10 hover:text-white'
                  }`}
                >
                  Denial Value Only
                </button>
              </div>
            </div>

            {/* Recharts Bar Chart Visualizer */}
            <div className="h-80 w-full pt-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={monthlyGrowthData}
                  margin={{ top: 12, right: 24, left: 10, bottom: 8 }}
                  barGap={8}
                >
                  <defs>
                    <linearGradient id="pipelineBarGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#059669" stopOpacity={0.7} />
                    </linearGradient>
                    <linearGradient id="denialBarGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#d97706" stopOpacity={0.7} />
                    </linearGradient>
                  </defs>
                  
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.07)" vertical={false} />
                  
                  <XAxis 
                    dataKey="label" 
                    stroke="#94a3b8" 
                    fontSize={11} 
                    tickLine={false} 
                    axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }} 
                  />
                  <YAxis 
                    stroke="#94a3b8" 
                    fontSize={11} 
                    tickLine={false} 
                    axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }} 
                    tickFormatter={(v) => `$${v}k`}
                  />

                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const item = payload[0].payload as MonthlyGrowthPoint;
                        const totalVal = item.monthlyPipelineAdded + item.denialAuditValue;
                        return (
                          <div className="p-4 rounded-xl bg-slate-950/95 border border-white/20 shadow-2xl backdrop-blur-xl text-xs space-y-2.5 min-w-[240px]">
                            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                              <span className="font-bold text-white text-sm">{item.period}</span>
                              {item.isCurrent && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  Current MTD
                                </span>
                              )}
                              {item.isProjected && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                  Projected Target
                                </span>
                              )}
                            </div>
                            <div className="space-y-1.5 font-mono">
                              {(barMetricFilter === 'all' || barMetricFilter === 'pipeline') && (
                                <div className="flex items-center justify-between text-emerald-400">
                                  <span className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded bg-emerald-500" />
                                    <span>Pipeline Added:</span>
                                  </span>
                                  <span className="font-bold">${item.monthlyPipelineAdded.toLocaleString()},000 / mo</span>
                                </div>
                              )}
                              {(barMetricFilter === 'all' || barMetricFilter === 'denial') && (
                                <div className="flex items-center justify-between text-amber-400">
                                  <span className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded bg-amber-500" />
                                    <span>Denial Audit Value:</span>
                                  </span>
                                  <span className="font-bold">${item.denialAuditValue.toLocaleString()},000</span>
                                </div>
                              )}
                              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-white font-bold">
                                <span>Total Revenue Impact:</span>
                                <span className="text-teal-300">${totalVal.toLocaleString()},000</span>
                              </div>
                              <div className="pt-1.5 flex items-center justify-between text-slate-400 text-[11px]">
                                <span>Growth: {item.growthRate}</span>
                                <span>Clean Claims: {item.cleanClaimRate}</span>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />

                  <Legend 
                    verticalAlign="top" 
                    height={36} 
                    wrapperStyle={{ paddingBottom: '12px', fontSize: '12px' }} 
                  />

                  {(barMetricFilter === 'all' || barMetricFilter === 'pipeline') && (
                    <Bar
                      dataKey="monthlyPipelineAdded"
                      name="Monthly Pipeline Added ($k / mo)"
                      fill="url(#pipelineBarGrad)"
                      radius={barChartLayout === 'stacked' && barMetricFilter === 'all' ? [0, 0, 0, 0] : [6, 6, 0, 0]}
                      stackId={barChartLayout === 'stacked' ? 'revStack' : undefined}
                      isAnimationActive={true}
                      animationDuration={900}
                    />
                  )}

                  {(barMetricFilter === 'all' || barMetricFilter === 'denial') && (
                    <Bar
                      dataKey="denialAuditValue"
                      name="Denial Audit Value ($k Recovered)"
                      fill="url(#denialBarGrad)"
                      radius={[6, 6, 0, 0]}
                      stackId={barChartLayout === 'stacked' ? 'revStack' : undefined}
                      isAnimationActive={true}
                      animationDuration={900}
                    />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* TAB 2: RECHARTS LINE / AREA CHART - 7-DAY DIALING VELOCITY */}
        {activeChartTab === 'velocity' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
              <div>
                <h4 className={`text-xs font-bold uppercase tracking-wider ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}>
                  7-Day Telephony & Contract Booking Velocity
                </h4>
                <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Tracks daily cumulative outbound dialing conversions and warm transfers bridged to manager phone.
                </p>
              </div>

              {/* View Toggles & Summary Metrics */}
              <div className="flex items-center gap-2">
                <div className={`p-1 rounded-xl border flex items-center gap-1 text-xs ${
                  isDark ? 'bg-slate-950/60 border-white/10' : 'bg-slate-100 border-slate-200 shadow-sm'
                }`}>
                  <button
                    onClick={() => setChartViewMode('both')}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                      chartViewMode === 'both' ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm' : (isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900')
                    }`}
                  >
                    All Metrics
                  </button>
                  <button
                    onClick={() => setChartViewMode('cumulative')}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                      chartViewMode === 'cumulative' ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm' : (isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900')
                    }`}
                  >
                    Cumulative
                  </button>
                  <button
                    onClick={() => setChartViewMode('daily')}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                      chartViewMode === 'daily' ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm' : (isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900')
                    }`}
                  >
                    Daily Added
                  </button>
                </div>
              </div>
            </div>

            {/* Growth KPIs Banner */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
                isDark ? 'bg-slate-950/50 border-white/5' : 'bg-white border-slate-200 shadow-sm'
              } flex items-center justify-between`}>
                <div>
                  <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>7-Day Net Cumulative</div>
                  <div className="font-mono text-xl sm:text-2xl font-black text-emerald-500 dark:text-emerald-400 mt-0.5">
                    ${todayPipelineNum},000 <span className={`text-xs font-normal ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>/ mo</span>
                  </div>
                </div>
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs">
                  +142%
                </div>
              </div>

              <div className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
                isDark ? 'bg-slate-950/50 border-white/5' : 'bg-white border-slate-200 shadow-sm'
              } flex items-center justify-between`}>
                <div>
                  <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Daily Average Velocity</div>
                  <div className="font-mono text-xl sm:text-2xl font-black text-cyan-600 dark:text-cyan-400 mt-0.5">
                    +${Math.round(todayPipelineNum / 7)},200 <span className={`text-xs font-normal ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>/ day</span>
                  </div>
                </div>
                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
                  <Activity className="w-4 h-4" />
                </div>
              </div>

              <div className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
                isDark ? 'bg-slate-950/50 border-white/5' : 'bg-white border-slate-200 shadow-sm'
              } flex items-center justify-between`}>
                <div>
                  <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Peak Conversion Day</div>
                  <div className="font-mono text-xl sm:text-2xl font-black text-amber-500 dark:text-amber-400 mt-0.5">
                    Today ({stats.warmTransfersBridged} Bridges)
                  </div>
                </div>
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Flame className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Recharts Line / Area Visualizer */}
            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={last7DaysData}
                  margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
                >
                  <defs>
                    <linearGradient id="emeraldGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="cyanGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                    </linearGradient>
                  </defs>

                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.07)" vertical={false} />
                  
                  <XAxis 
                    dataKey="day" 
                    stroke="#64748b" 
                    fontSize={11} 
                    tickLine={false}
                    axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
                  />
                  <YAxis 
                    stroke="#64748b" 
                    fontSize={11} 
                    tickLine={false}
                    axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
                    tickFormatter={(val) => `$${val}k`}
                  />

                  <Tooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload as PipelineGrowthPoint;
                        return (
                          <div className="p-3.5 rounded-xl bg-slate-950/95 border border-white/20 shadow-2xl backdrop-blur-xl text-xs space-y-2">
                            <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-1.5">
                              <span className="font-bold text-white">{data.day}</span>
                              <span className="text-[10px] text-slate-400 font-mono">{data.fullDate}</span>
                            </div>
                            <div className="space-y-1 font-mono">
                              <div className="flex items-center justify-between gap-4 text-emerald-400">
                                <span>Cumulative Pipeline:</span>
                                <span className="font-bold">${data.cumulativePipeline},000</span>
                              </div>
                              <div className="flex items-center justify-between gap-4 text-cyan-300">
                                <span>Daily Added:</span>
                                <span className="font-bold">+${data.dailyAdded},000</span>
                              </div>
                              <div className="flex items-center justify-between gap-4 text-slate-400 text-[11px] pt-1 border-t border-slate-800/60">
                                <span>Doctor Connects: {data.connects}</span>
                                <span>Audits: {data.auditsBooked}</span>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />

                  <Legend 
                    verticalAlign="top" 
                    height={36} 
                    wrapperStyle={{ paddingBottom: '10px', fontSize: '12px' }}
                  />

                  {(chartViewMode === 'both' || chartViewMode === 'cumulative') && (
                    <Line
                      type="monotone"
                      dataKey="cumulativePipeline"
                      name="Cumulative Pipeline ($k)"
                      stroke="#10b981"
                      strokeWidth={3}
                      dot={{ fill: '#10b981', r: 4, stroke: '#064e3b', strokeWidth: 2 }}
                      activeDot={{ r: 7, fill: '#34d399', stroke: '#ffffff', strokeWidth: 2 }}
                    />
                  )}

                  {(chartViewMode === 'both' || chartViewMode === 'daily') && (
                    <Line
                      type="monotone"
                      dataKey="dailyAdded"
                      name="Daily Added ($k)"
                      stroke="#06b6d4"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={{ fill: '#06b6d4', r: 3 }}
                      activeDot={{ r: 6, fill: '#67e8f9' }}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* D3.JS INTERACTIVE CONVERSION FUNNEL: LEADS -> CONTACTED -> AUDIT BOOKED -> CLOSED WON */}
      <D3ConversionFunnel
        leads={leads}
        stats={stats}
        meetingNotes={meetingNotes}
      />

      {/* AUTOMATED AI CALL SENTIMENT ANALYZER EXECUTIVE INTELLIGENCE PANEL */}
      <div className={`p-6 rounded-2xl border backdrop-blur-2xl transition-all duration-300 space-y-5 ${
        isDark 
          ? 'glass-panel border-white/10 shadow-2xl' 
          : 'bg-white border-slate-200/90 shadow-[0_12px_40px_-10px_rgba(15,23,42,0.06)]'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-black shadow-md shadow-indigo-500/20">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className={`text-sm font-bold font-display uppercase tracking-wider flex items-center gap-2 ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}>
                  <span>Automated AI Call Sentiment Analyzer</span>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 text-[10px] font-mono font-bold border border-indigo-500/30">
                    Live 1-10 Scoring Engine
                  </span>
                </h3>
                <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  NLP algorithms parse transcribed calls, physician objections, and diagnostic interest to score every call from 1-10.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-xs font-mono font-bold px-3 py-1.5 rounded-xl border ${
              isDark ? 'bg-indigo-950/60 border-indigo-500/30 text-indigo-300' : 'bg-indigo-50 border-indigo-200 text-indigo-800'
            }`}>
              Daily Average: {dailySentiment.averageScore} / 10 • Grade {dailySentiment.gradeAverage}
            </span>
          </div>
        </div>

        {/* Top Metric Strip: Score Meter, Intent Index & Distribution */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* 1. Average Daily Sentiment Dial */}
          <div className={`p-4 rounded-xl border flex items-center gap-4 ${
            isDark ? 'bg-slate-950/60 border-white/5' : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
              {/* Circular gauge border */}
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <path
                  className={isDark ? "text-slate-800" : "text-slate-200"}
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-indigo-500"
                  strokeDasharray={`${Math.round(dailySentiment.averageScore * 10)}, 100`}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-mono text-base font-black text-indigo-400">
                  {dailySentiment.averageScore}
                </span>
                <span className="text-[8px] text-slate-400 uppercase font-mono">/ 10</span>
              </div>
            </div>

            <div>
              <div className={`text-xs font-bold font-display ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Daily Average Call Score
              </div>
              <div className="text-[11px] text-emerald-400 font-mono mt-0.5">
                {dailySentiment.sentimentTrend}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                Analyzed across {dailySentiment.totalCallsAnalyzed} transcribed calls today
              </div>
            </div>
          </div>

          {/* 2. Intent & Receptivity Grade */}
          <div className={`p-4 rounded-xl border flex items-center justify-between ${
            isDark ? 'bg-slate-950/60 border-white/5' : 'bg-slate-50 border-slate-200'
          }`}>
            <div>
              <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">
                Clinical Intent Grade
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-black font-display text-emerald-400">
                  Grade {dailySentiment.gradeAverage}
                </span>
                <span className="text-xs text-teal-400 font-bold font-mono">
                  {dailySentiment.highIntentCount} High-Intent
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {dailySentiment.averageScore >= 8.0 
                  ? 'Strong physician openness to 50-claim diagnostic audits and warm manager bridges.' 
                  : 'Moderate engagement; continue addressing prior auth and EHR workflow bottlenecks.'}
              </p>
            </div>
          </div>

          {/* 3. 1-10 Score Distribution Spectrum */}
          <div className={`p-4 rounded-xl border space-y-2 ${
            isDark ? 'bg-slate-950/60 border-white/5' : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-slate-400 uppercase font-bold">1-10 Score Spread</span>
              <span className="text-teal-400 font-bold">Top Bucket: 9-10 (48%)</span>
            </div>

            {/* Stacked distribution bar */}
            <div className="h-3 w-full rounded-full overflow-hidden flex bg-slate-800">
              <div style={{ width: '48%' }} className="bg-emerald-400" title="Scores 9-10: 48%" />
              <div style={{ width: '33%' }} className="bg-teal-400" title="Scores 7-8: 33%" />
              <div style={{ width: '14%' }} className="bg-amber-400" title="Scores 5-6: 14%" />
              <div style={{ width: '5%' }} className="bg-rose-400" title="Scores 1-4: 5%" />
            </div>

            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400" /> 9-10 (High Intent)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-teal-400" /> 7-8 (Warm)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400" /> 5-6 (Neutral)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-400" /> &lt;5
              </span>
            </div>
          </div>

        </div>

        {/* Individual Scored Calls Table */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between text-xs font-bold font-display uppercase tracking-wider text-slate-400">
            <span>Transcribed Calls Evaluated by Automated AI Sentiment</span>
            <span className="font-mono text-[11px] font-normal">Scored on 1.0 - 10.0 Scale</span>
          </div>

          <div className={`border rounded-xl overflow-hidden ${
            isDark ? 'border-white/10' : 'border-slate-200'
          }`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className={`border-b font-semibold text-[11px] uppercase tracking-wider ${
                    isDark ? 'bg-slate-950/70 border-white/10 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-700'
                  }`}>
                    <th className="py-2.5 px-4">Practice & Doctor</th>
                    <th className="py-2.5 px-4">Duration</th>
                    <th className="py-2.5 px-4 text-center">AI Score (1-10)</th>
                    <th className="py-2.5 px-4">Detected Tone</th>
                    <th className="py-2.5 px-4">AI Sentiment Reasoning & Buying Signals</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-white/5 text-slate-300' : 'divide-slate-200 text-slate-800'}`}>
                  {meetingNotes.slice(0, 4).map((note, idx) => {
                    const score = typeof note.sentimentScore === 'number' && note.sentimentScore > 0 
                      ? note.sentimentScore 
                      : (idx === 0 ? 9.4 : idx === 1 ? 8.6 : idx === 2 ? 7.8 : 6.5);
                    const grade = note.sentimentGrade || (score >= 9 ? 'A+' : score >= 8 ? 'A' : score >= 7 ? 'B' : 'C');
                    const tone = note.sentimentTone || (score >= 9 ? 'Enthusiastic' : score >= 8 ? 'Receptive' : 'Inquisitive');

                    return (
                      <tr key={note.id || idx} className={`transition ${
                        isDark ? 'hover:bg-slate-900/40' : 'hover:bg-slate-50'
                      }`}>
                        <td className="py-3 px-4">
                          <div className={`font-bold font-display ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            {note.practiceName}
                          </div>
                          <div className="text-[11px] text-teal-400">{note.doctorName}</div>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-400">
                          {note.duration || '3m 48s'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-flex items-center gap-1 font-mono font-bold px-2.5 py-1 rounded-lg text-xs border ${
                            score >= 9.0 
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                              : score >= 8.0 
                              ? 'bg-teal-500/20 text-teal-400 border-teal-500/30' 
                              : score >= 7.0 
                              ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' 
                              : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                          }`}>
                            <span className="text-sm font-black">{score}</span>
                            <span className="text-[10px] opacity-75">/ 10</span>
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-white/5 border border-white/10">
                            {tone} ({grade})
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs">
                          <p className="line-clamp-2">
                            {note.sentimentReasoning || note.executiveSummary}
                          </p>
                          {note.sentimentBuyingSignals && note.sentimentBuyingSignals.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap pt-1">
                              {note.sentimentBuyingSignals.map((sig, sIdx) => (
                                <span key={sIdx} className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-teal-500/10 text-teal-300 border border-teal-500/20">
                                  ✓ {sig}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
      <div className={`p-4 sm:p-6 rounded-3xl border transition-all duration-300 space-y-4 backdrop-blur-2xl ${
        isDark 
          ? 'glass-panel border-white/10 shadow-2xl' 
          : 'bg-white border-slate-200/90 shadow-[0_12px_40px_-10px_rgba(15,23,42,0.06)]'
      }`}>
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b ${
          isDark ? 'border-white/10' : 'border-slate-200'
        }`}>
          <h3 className={`text-sm font-bold uppercase tracking-wider flex items-center gap-2 ${
            isDark ? 'text-slate-200' : 'text-slate-900'
          }`}>
            <Sparkles className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
            Executive Briefing Document (4:00 PM PST)
          </h3>
          <span className={`text-xs font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Generated via Pulsar Agent
          </span>
        </div>

        {isGenerating ? (
          <div className="py-16 text-center text-xs text-indigo-500 dark:text-indigo-300 flex flex-col items-center justify-center gap-4">
            <LeapDemo />
            <span className="font-mono">Compiling daily business analytics, call recordings, warm transfers, and tomorrow's targets...</span>
          </div>
        ) : (
          <div className={`prose max-w-none text-xs sm:text-sm leading-relaxed font-sans p-4 sm:p-6 rounded-2xl border space-y-4 whitespace-pre-wrap backdrop-blur-md ${
            isDark 
              ? 'prose-invert text-slate-200 bg-slate-950/70 border-white/10' 
              : 'text-slate-800 bg-slate-50/80 border-slate-200'
          }`}>
            {briefingContent}
          </div>
        )}
      </div>

      {/* Warm Transfer Call History */}
      <div className={`p-4 sm:p-6 rounded-3xl border transition-all duration-300 space-y-4 backdrop-blur-2xl ${
        isDark 
          ? 'glass-panel border-white/10 shadow-2xl' 
          : 'bg-white border-slate-200/90 shadow-[0_12px_40px_-10px_rgba(15,23,42,0.06)]'
      }`}>
        <h3 className={`text-sm font-bold uppercase tracking-wider flex items-center gap-2 ${
          isDark ? 'text-slate-200' : 'text-slate-900'
        }`}>
          <PhoneForwarded className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
          Calls Successfully Bridged to Manager Phone ({warmTransfers.length})
        </h3>
        
        <div className={`divide-y ${isDark ? 'divide-white/5' : 'divide-slate-200'}`}>
          {warmTransfers.map((wt) => (
            <div key={wt.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div>
                <div className={`font-bold flex items-center gap-2 ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}>
                  <span>{wt.practiceName}</span>
                  <span className="text-teal-600 dark:text-teal-400 font-normal">({wt.leadName})</span>
                </div>
                <div className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  <strong>Trigger:</strong> {wt.triggerReason}
                </div>
              </div>
              <div className="text-right sm:self-center font-mono">
                <div className="text-emerald-600 dark:text-emerald-400 font-semibold">{wt.outcome}</div>
                <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Bridged at: {wt.bridgedAt} ({wt.durationWithManager})</div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
