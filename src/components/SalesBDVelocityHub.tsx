import React, { useState } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  ShieldCheck, 
  CheckCircle2, 
  ArrowRight, 
  Flame, 
  Zap, 
  PhoneForwarded, 
  PhoneCall,
  Calendar, 
  FileText, 
  Calculator,
  ChevronRight,
  Sparkles,
  BarChart3,
  Award,
  Layers,
  Clock,
  RotateCcw,
  Copy,
  Check,
  Sliders,
  ArrowUpRight,
  Percent,
  Activity,
  TrendingDown
} from 'lucide-react';
import { RCMLead, DailyStats } from '../types';
import { useTheme } from '../context/ThemeContext';
import { NicheTemplate } from '../data/nicheTemplates';
import { D3RevenueVelocityChart } from './D3RevenueVelocityChart';
import { LeadGeoDistribution } from './LeadGeoDistribution';

interface DealStage {
  id: string;
  name: string;
  count: number;
  value: string;
  color: string;
  leads: Array<{
    id: string;
    practiceName: string;
    doctorName: string;
    value: string;
    ehr: string;
    probability: number;
  }>;
}

interface SalesBDVelocityHubProps {
  stats: DailyStats;
  leads: RCMLead[];
  onTriggerCall?: (lead: RCMLead) => void;
  onOpenBriefing?: () => void;
  nicheTemplate?: NicheTemplate;
}

export const SalesBDVelocityHub: React.FC<SalesBDVelocityHubProps> = ({
  stats,
  leads,
  onTriggerCall,
  onOpenBriefing,
  nicheTemplate
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Predictive Revenue ROI Calculator State with Denial Recovery and AR Days Reduction
  const [enableDenialRecovery, setEnableDenialRecovery] = useState<boolean>(true);
  const [enableArDaysReduction, setEnableArDaysReduction] = useState<boolean>(true);
  
  const [monthlyClaimsBilled, setMonthlyClaimsBilled] = useState<number>(550000);
  const [currentDenialRate, setCurrentDenialRate] = useState<number>(12.8);
  const [pulsarOverturnRate, setPulsarOverturnRate] = useState<number>(88); // 88% overturn efficiency
  
  const [baselineArDays, setBaselineArDays] = useState<number>(52);
  const [targetArDays, setTargetArDays] = useState<number>(30);
  const [practiceSpecialty, setPracticeSpecialty] = useState<string>('Cardiology');
  const [copiedPitch, setCopiedPitch] = useState<boolean>(false);

  // 1. Denial Recovery Calculations
  const monthlyDenialsGross = monthlyClaimsBilled * (currentDenialRate / 100);
  const monthlyDenialRecovery = enableDenialRecovery
    ? Math.round(monthlyDenialsGross * (pulsarOverturnRate / 100))
    : 0;
  const annualDenialRecovery = monthlyDenialRecovery * 12;

  // 2. AR Days Reduction Calculations
  const dailyBilling = monthlyClaimsBilled / 30;
  const arDaysSaved = Math.max(0, baselineArDays - targetArDays);
  // Total working capital accelerated/freed up in practice bank account
  const workingCapitalFreed = Math.round(dailyBilling * arDaysSaved);
  // Claims aging past 50+ days incur bad debt write-offs at ~2.5% rate; reducing AR days by ~22 days prevents ~1.76% of billing from becoming uncollectible
  const badDebtRateSaved = arDaysSaved > 0 ? (arDaysSaved / 100) * 0.08 : 0;
  const monthlyBadDebtRecovered = enableArDaysReduction
    ? Math.round(monthlyClaimsBilled * badDebtRateSaved)
    : 0;
  // Cost of capital holding interest saved (8% APR on outstanding AR balance)
  const monthlyHoldingInterestSaved = enableArDaysReduction
    ? Math.round(workingCapitalFreed * (0.08 / 12))
    : 0;
  const monthlyArCashBenefit = monthlyBadDebtRecovered + monthlyHoldingInterestSaved;
  const annualArCashBenefit = monthlyArCashBenefit * 12;

  // 3. Combined Monthly Net Collection Improvement
  const totalMonthlyNetImprovement = monthlyDenialRecovery + monthlyArCashBenefit;
  const totalAnnualNetImprovement = totalMonthlyNetImprovement * 12;

  // 4. Net Collection Rate Comparison
  const baselineNetCollectionRate = Math.max(72, Math.min(94, 100 - currentDenialRate - (baselineArDays > 50 ? 3.2 : 1.4)));
  const collectionRateGain = Math.min(14.5, parseFloat(((totalMonthlyNetImprovement / monthlyClaimsBilled) * 100).toFixed(1)));
  const improvedNetCollectionRate = Math.min(98.6, parseFloat((baselineNetCollectionRate + collectionRateGain).toFixed(1)));

  // Specialty Preset Handler
  const handleSelectPreset = (specialty: string) => {
    setPracticeSpecialty(specialty);
    switch (specialty) {
      case 'Cardiology':
        setMonthlyClaimsBilled(550000);
        setCurrentDenialRate(12.8);
        setBaselineArDays(52);
        setTargetArDays(30);
        setPulsarOverturnRate(88);
        break;
      case 'Orthopedic & Spine':
        setMonthlyClaimsBilled(880000);
        setCurrentDenialRate(16.2);
        setBaselineArDays(58);
        setTargetArDays(32);
        setPulsarOverturnRate(90);
        break;
      case 'Diagnostic Pathology':
        setMonthlyClaimsBilled(420000);
        setCurrentDenialRate(9.4);
        setBaselineArDays(44);
        setTargetArDays(28);
        setPulsarOverturnRate(86);
        break;
      case 'Multi-Specialty Clinic':
        setMonthlyClaimsBilled(1250000);
        setCurrentDenialRate(13.5);
        setBaselineArDays(54);
        setTargetArDays(30);
        setPulsarOverturnRate(88);
        break;
      default:
        break;
    }
  };

  const copyPitchToClipboard = () => {
    const pitchText = `Pulsar Predictive ROI Analysis for ${practiceSpecialty} ($${monthlyClaimsBilled.toLocaleString()}/mo billing):\n• Projected Monthly Net Collection Improvement: +$${totalMonthlyNetImprovement.toLocaleString()}/month (+${collectionRateGain}% Net Collection Rate jump to ${improvedNetCollectionRate}%)\n• Annual Net Revenue Injection: +$${totalAnnualNetImprovement.toLocaleString()}/year\n• Claim Denial Overturn: +$${monthlyDenialRecovery.toLocaleString()}/mo recovered (${pulsarOverturnRate}% overturn on ${currentDenialRate}% initial denials)\n• AR Days Reduction: Reduced from ${baselineArDays} to ${targetArDays} days (${arDaysSaved} days faster collections, freeing $${workingCapitalFreed.toLocaleString()} in working capital liquidity).`;
    navigator.clipboard.writeText(pitchText);
    setCopiedPitch(true);
    setTimeout(() => setCopiedPitch(false), 2400);
  };

  // Demo pipeline data: sample deals for layout only, not real pipeline or revenue.
  const [stages, setStages] = useState<DealStage[]>([
    {
      id: 'prospecting',
      name: '1. Scraped & Qualified',
      count: 24,
      value: '$340,000 / mo',
      color: 'border-slate-500/40 text-slate-300',
      leads: [
        { id: 'l-1', practiceName: 'Austin Heart & Vascular', doctorName: 'Dr. Marcus Vance, MD', value: '$45,000/mo', ehr: 'eClinicalWorks', probability: 35 },
        { id: 'l-2', practiceName: 'Lone Star Spine Institute', doctorName: 'Dr. Gregory Hayes, MD', value: '$68,000/mo', ehr: 'Epic Systems', probability: 40 }
      ]
    },
    {
      id: 'contacted',
      name: '2. Cold Call Connected',
      count: 12,
      value: '$210,000 / mo',
      color: 'border-blue-500/40 text-blue-400',
      leads: [
        { id: 'l-3', practiceName: 'Northwest Orthopedic & Spine', doctorName: 'David Sterling (VP RCM)', value: '$52,000/mo', ehr: 'Epic Systems', probability: 60 }
      ]
    },
    {
      id: 'audit_booked',
      name: '3. 50-Claim Audit Booked',
      count: 6,
      value: '$145,000 / mo',
      color: 'border-emerald-500/40 text-emerald-400',
      leads: [
        { id: 'l-4', practiceName: 'Apex Diagnostic Labs', doctorName: 'Robert Hughes (CFO)', value: '$75,000/mo', ehr: 'AthenaHealth', probability: 80 }
      ]
    },
    {
      id: 'closing',
      name: '4. Agreement In Review',
      count: 3,
      value: '$88,000 / mo',
      color: 'border-teal-500/40 text-teal-400',
      leads: [
        { id: 'l-5', practiceName: 'Bay Area Pulmonary Associates', doctorName: 'Dr. Sarah Lin, MD', value: '$38,000/mo', ehr: 'NextGen', probability: 95 }
      ]
    }
  ]);

  return (
    <div className={`p-4 sm:p-6 rounded-3xl border transition-all duration-300 relative overflow-hidden backdrop-blur-2xl space-y-6 ${
      isDark
        ? 'glass-card bg-slate-950/85 border-emerald-500/20 shadow-2xl shadow-emerald-500/5'
        : 'bg-white/95 border-emerald-500/20 shadow-xl shadow-blue-500/5'
    }`}>
      {/* Top Ambient Glow Bar */}
      <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-400 via-teal-400 to-blue-500 opacity-90" />

      {/* Header and Live Velocity Gauges */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-emerald-500/10">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Skiper UI • Sales & Business Development Velocity Hub</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <span>Enterprise Healthcare Deal Pipeline</span>
            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/50 text-amber-600 dark:text-amber-400 text-[10px] font-black uppercase tracking-wider">Demo</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
            Live revenue acceleration matrix tracking prospect progression from initial scraper hit to signed 50-claim audit agreements.
          </p>
        </div>

        {/* 4 PM PST Briefing Dispatch Action */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onOpenBriefing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-blue-600 hover:from-emerald-400 hover:to-blue-500 text-white font-black text-xs shadow-lg shadow-emerald-500/20 transition cursor-pointer"
          >
            <Flame className="w-3.5 h-3.5" />
            <span>View 4:00 PM PST Executive Briefing</span>
          </button>
        </div>
      </div>

      {/* Demo data banner: every deal in this tool is a sample example. */}
      <div className="p-3 rounded-xl border border-amber-500/40 bg-amber-500/10 text-xs font-bold text-amber-700 dark:text-amber-300">
        Demo pipeline: the deals below are sample examples for layout only. They are not real pipeline, clients, or revenue. Stage counts and values are examples.
      </div>

      {/* Metric Bento Cards (Skiper UI Count-Up Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className={`p-4 rounded-2xl border ${
          isDark ? 'bg-slate-900/80 border-emerald-500/25' : 'bg-emerald-50/70 border-emerald-200'
        }`}>
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
            <span>Pipeline Added (Month)</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-black font-mono text-emerald-500 dark:text-emerald-400">
            {stats.pipelineAdded}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 font-mono">
            +32% vs previous 30-day run rate
          </div>
        </div>

        <div className={`p-4 rounded-2xl border ${
          isDark ? 'bg-slate-900/80 border-blue-500/25' : 'bg-blue-50/70 border-blue-200'
        }`}>
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
            <span>Identified Denial Audit Pool</span>
            <ShieldCheck className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-black font-mono text-blue-500 dark:text-blue-400">
            {stats.denialAuditValue}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 font-mono">
            Across {stats.auditsBooked} booked clinical audits
          </div>
        </div>

        <div className={`p-4 rounded-2xl border ${
          isDark ? 'bg-slate-900/80 border-emerald-500/25' : 'bg-emerald-50/70 border-emerald-200'
        }`}>
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
            <span>Clean Claim Pass Rate</span>
            <Award className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-black font-mono text-emerald-500 dark:text-emerald-400">
            98.4%
          </div>
          <div className="text-[10px] text-slate-400 mt-1 font-mono">
            Industry standard: 82.1%
          </div>
        </div>

        <div className={`p-4 rounded-2xl border ${
          isDark ? 'bg-slate-900/80 border-blue-500/25' : 'bg-blue-50/70 border-blue-200'
        }`}>
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
            <span>Warm Transfers Bridged</span>
            <PhoneForwarded className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-black font-mono text-blue-500 dark:text-blue-400">
            {stats.warmTransfersBridged} Live Transfers
          </div>
          <div className="text-[10px] text-slate-400 mt-1 font-mono">
            Directly to Manager WhatsApp & SIP
          </div>
        </div>
      </div>

      {/* Interactive Pipeline Kanban Matrix */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-500" />
            <span>Active Deal Progression Stages</span>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Total In-Flight Opportunities: 45 Businesses
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {stages.map((stage) => (
            <div
              key={stage.id}
              className={`p-3.5 rounded-2xl border flex flex-col justify-between space-y-3 ${
                isDark ? 'bg-slate-900/60 border-white/10' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-white/5">
                  <span className={`text-xs font-bold ${stage.color}`}>
                    {stage.name}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-white font-bold">
                    {stage.count}
                  </span>
                </div>

                <div className="mt-3 space-y-2">
                  {stage.leads.map((lead) => (
                    <div
                      key={lead.id}
                      className="p-2.5 rounded-xl bg-slate-950/70 border border-white/10 text-xs space-y-1.5 hover:border-emerald-500/40 transition"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-bold text-white line-clamp-1">
                          {lead.practiceName}
                        </div>
                        <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/50 text-amber-300 text-[9px] font-black uppercase tracking-wider">Demo</span>
                      </div>
                      <div className="text-[11px] text-slate-400 line-clamp-1">
                        {lead.doctorName}
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[10px] font-mono">
                        <span className="text-emerald-400 font-bold">{lead.value}</span>
                        <span className="text-blue-400">{lead.ehr}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] font-mono">
                <span className="text-slate-500">Stage Value:</span>
                <strong className="text-white font-bold">{stage.value}</strong>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Predictive Revenue ROI Calculator (Denial Recovery & AR Days Reduction) */}
      <div className={`p-5 sm:p-6 rounded-3xl border transition-all duration-300 relative overflow-hidden space-y-6 ${
        isDark 
          ? 'bg-slate-900/90 border-emerald-500/25 shadow-2xl shadow-emerald-500/5' 
          : 'bg-white border-emerald-500/30 shadow-xl shadow-blue-500/5'
      }`}>
        {/* Top Glow & Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-emerald-500/15">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">
              <Calculator className="w-3.5 h-3.5" />
              <span>Predictive Revenue ROI Engine</span>
              <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/50 text-amber-600 dark:text-amber-400 text-[9px] font-black uppercase tracking-wider">Demo inputs</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>

            <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span>Predictive Net Collection Improvement Calculator</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 max-w-2xl">
              Healthcare & RCM pack example: model real-time cash flow acceleration by toggling claim denial overturns and accounts receivable (AR) aging reduction velocity.
            </p>
            <p className="text-xs font-bold text-amber-700 dark:text-amber-300 mt-1 max-w-2xl">
              Example inputs only: the preset values below are examples for modelling. Enter your own business numbers before using any figure with a prospect.
            </p>
          </div>

          {/* Specialty Preset Selector */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-mono text-slate-400 mr-1 hidden sm:inline">Specialty Presets:</span>
            {['Cardiology', 'Orthopedic & Spine', 'Diagnostic Pathology', 'Multi-Specialty Clinic'].map((spec) => (
              <button
                key={spec}
                type="button"
                onClick={() => handleSelectPreset(spec)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  practiceSpecialty === spec
                    ? 'bg-gradient-to-r from-emerald-500 to-blue-600 text-white font-bold shadow-md shadow-emerald-500/20'
                    : isDark
                      ? 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border border-white/5'
                      : 'bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200'
                }`}
              >
                {spec}
              </button>
            ))}
          </div>
        </div>

        {/* Master Dual Toggle Controls Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          
          {/* STREAM 1: Denial Recovery Module */}
          <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${
            enableDenialRecovery
              ? isDark ? 'bg-slate-950/70 border-emerald-500/30 ring-1 ring-emerald-500/20' : 'bg-emerald-50/40 border-emerald-300'
              : 'opacity-60 bg-slate-950/30 border-white/5'
          }`}>
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl ${enableDenialRecovery ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    1. Claim Denial Recovery
                  </h4>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Overturns complex clinical denials & coding rejections
                  </div>
                </div>
              </div>

              {/* Toggle Switch */}
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableDenialRecovery}
                  onChange={(e) => setEnableDenialRecovery(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                <span className="ml-2 text-xs font-mono font-bold text-slate-300">
                  {enableDenialRecovery ? 'ON' : 'OFF'}
                </span>
              </label>
            </div>

            {/* Denial Recovery Sliders */}
            <div className="space-y-4 mt-4 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Monthly Gross Claims Billed:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                    ${monthlyClaimsBilled.toLocaleString()}
                  </span>
                </div>
                <input
                  type="range"
                  min="100000"
                  max="2500000"
                  step="25000"
                  value={monthlyClaimsBilled}
                  disabled={!enableDenialRecovery && !enableArDaysReduction}
                  onChange={(e) => setMonthlyClaimsBilled(Number(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                  <span>$100k / mo</span>
                  <span>$1.25M</span>
                  <span>$2.5M / mo</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-slate-500 dark:text-slate-400">Baseline Denial Rate:</span>
                    <span className="font-mono font-bold text-emerald-400">{currentDenialRate}%</span>
                  </div>
                  <input
                    type="range"
                    min="4"
                    max="24"
                    step="0.5"
                    value={currentDenialRate}
                    disabled={!enableDenialRecovery}
                    onChange={(e) => setCurrentDenialRate(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                    Gross Denials: ${(monthlyDenialsGross).toLocaleString()}/mo
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-slate-500 dark:text-slate-400">Pulsar Overturn Rate:</span>
                    <span className="font-mono font-bold text-blue-400">{pulsarOverturnRate}%</span>
                  </div>
                  <input
                    type="range"
                    min="65"
                    max="96"
                    step="1"
                    value={pulsarOverturnRate}
                    disabled={!enableDenialRecovery}
                    onChange={(e) => setPulsarOverturnRate(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                    Industry Benchmark: 48-62%
                  </div>
                </div>
              </div>

              {/* Denial Stream Output Badge */}
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                <span className="text-slate-400 text-[11px] font-mono">Denial Overturn Benefit:</span>
                <span className="font-mono font-bold text-emerald-400 text-sm">
                  {enableDenialRecovery ? `+$${monthlyDenialRecovery.toLocaleString()} / mo` : '$0 / mo (Toggled Off)'}
                </span>
              </div>
            </div>
          </div>

          {/* STREAM 2: AR Days Reduction Module */}
          <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${
            enableArDaysReduction
              ? isDark ? 'bg-slate-950/70 border-blue-500/30 ring-1 ring-blue-500/20' : 'bg-blue-50/40 border-blue-300'
              : 'opacity-60 bg-slate-950/30 border-white/5'
          }`}>
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl ${enableArDaysReduction ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-800 text-slate-500'}`}>
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    2. AR Days Reduction & Velocity
                  </h4>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Accelerates reimbursement velocity & prevents bad debt write-offs
                  </div>
                </div>
              </div>

              {/* Toggle Switch */}
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableArDaysReduction}
                  onChange={(e) => setEnableArDaysReduction(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                <span className="ml-2 text-xs font-mono font-bold text-slate-300">
                  {enableArDaysReduction ? 'ON' : 'OFF'}
                </span>
              </label>
            </div>

            {/* AR Sliders */}
            <div className="space-y-4 mt-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-slate-500 dark:text-slate-400">Current Days in AR:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">{baselineArDays} Days</span>
                  </div>
                  <input
                    type="range"
                    min="36"
                    max="80"
                    step="1"
                    value={baselineArDays}
                    disabled={!enableArDaysReduction}
                    onChange={(e) => setBaselineArDays(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                    Medical Average: 50-65 days
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-slate-500 dark:text-slate-400">Target Days with Pulsar:</span>
                    <span className="font-mono font-bold text-emerald-400">{targetArDays} Days</span>
                  </div>
                  <input
                    type="range"
                    min="22"
                    max="38"
                    step="1"
                    value={targetArDays}
                    disabled={!enableArDaysReduction}
                    onChange={(e) => setTargetArDays(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                    Pulsar Best-in-Class: 28-32 days
                  </div>
                </div>
              </div>

              {/* Working Capital & Acceleration Summary */}
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
                  <span className="text-slate-400 block">Reimbursement Velocity:</span>
                  <strong className="text-blue-400 font-bold">{arDaysSaved} Days Faster</strong>
                </div>
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
                  <span className="text-slate-400 block">Working Capital Freed:</span>
                  <strong className="text-emerald-400 font-bold">${workingCapitalFreed.toLocaleString()}</strong>
                </div>
              </div>

              {/* AR Stream Output Badge */}
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-between">
                <span className="text-slate-400 text-[11px] font-mono">AR Velocity & Bad Debt Benefit:</span>
                <span className="font-mono font-bold text-blue-400 text-sm">
                  {enableArDaysReduction ? `+$${monthlyArCashBenefit.toLocaleString()} / mo` : '$0 / mo (Toggled Off)'}
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* COMBINED HERO PREDICTIVE ROI RESULTS BANNER */}
        <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-teal-500/15 to-blue-500/15 border border-emerald-500/35 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>Projected Monthly Net Collection Improvement</span>
              </div>

              <div className="text-3xl sm:text-4xl lg:text-5xl font-black font-mono text-emerald-400 tracking-tight flex items-baseline gap-2">
                <span>+${totalMonthlyNetImprovement.toLocaleString()}</span>
                <span className="text-base sm:text-lg font-bold text-slate-400 font-sans">/ month</span>
              </div>

              <div className="text-xs sm:text-sm text-blue-400 font-mono font-medium flex items-center gap-2 pt-0.5">
                <span>Annualized Net Revenue Boost:</span>
                <strong className="text-white font-bold">+${totalAnnualNetImprovement.toLocaleString()} / year</strong>
              </div>
            </div>

            {/* Net Collection Rate Shift Pill */}
            <div className="bg-slate-950/80 p-4 rounded-2xl border border-white/10 space-y-2 lg:min-w-[280px]">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">Net Collection Rate:</span>
                <span className="text-emerald-400 font-bold">+{collectionRateGain}% Shift</span>
              </div>

              <div className="flex items-baseline justify-between font-mono">
                <span className="text-slate-500 text-sm line-through">{baselineNetCollectionRate}%</span>
                <ArrowRight className="w-3.5 h-3.5 text-emerald-400 mx-2" />
                <span className="text-emerald-400 font-black text-xl">{improvedNetCollectionRate}%</span>
              </div>

              {/* Progress Comparison Split Bar */}
              <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-white/5 relative">
                <div 
                  className="h-full bg-slate-600 rounded-full transition-all duration-500" 
                  style={{ width: `${baselineNetCollectionRate}%` }} 
                />
                <div 
                  className="h-full bg-gradient-to-r from-emerald-400 to-blue-500 rounded-full absolute top-0 left-0 transition-all duration-500" 
                  style={{ width: `${improvedNetCollectionRate}%` }} 
                />
              </div>

              <div className="text-[10px] text-slate-400 flex justify-between font-mono pt-0.5">
                <span>Current Baseline</span>
                <span className="text-emerald-400 font-bold">With Pulsar AI</span>
              </div>
            </div>
          </div>

          {/* Breakdown Contribution Pills */}
          <div className="mt-5 pt-4 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-white/5">
              <span className="text-slate-400 block text-[10px]">Claim Denial Recovery Share:</span>
              <strong className="text-emerald-400 font-bold">
                {enableDenialRecovery ? `+$${monthlyDenialRecovery.toLocaleString()} / mo (${Math.round((monthlyDenialRecovery / (totalMonthlyNetImprovement || 1)) * 100)}%)` : 'Disabled'}
              </strong>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-white/5">
              <span className="text-slate-400 block text-[10px]">AR Velocity & Bad Debt Share:</span>
              <strong className="text-blue-400 font-bold">
                {enableArDaysReduction ? `+$${monthlyArCashBenefit.toLocaleString()} / mo (${Math.round((monthlyArCashBenefit / (totalMonthlyNetImprovement || 1)) * 100)}%)` : 'Disabled'}
              </strong>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-white/5">
              <span className="text-slate-400 block text-[10px]">Bank Balance Working Capital Freed:</span>
              <strong className="text-white font-bold">
                {enableArDaysReduction ? `+$${workingCapitalFreed.toLocaleString()} Liquidity` : '$0'}
              </strong>
            </div>
          </div>

          {/* Actionable Sales Outreach Integration */}
          <div className="mt-4 pt-3 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-[11px] text-slate-400">
              Use these predictive figures during cold calling to provide immediate mathematical proof of value.
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {onTriggerCall && leads.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const leadToCall: RCMLead = {
                      ...leads[0],
                      auditNotes: `Predictive ROI Target: +$${totalMonthlyNetImprovement.toLocaleString()}/mo net collection improvement (${collectionRateGain}% shift to ${improvedNetCollectionRate}%), ${pulsarOverturnRate}% denial recovery, AR reduced to ${targetArDays} days ($${workingCapitalFreed.toLocaleString()} liquidity).`
                    };
                    onTriggerCall(leadToCall);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-blue-600 hover:from-emerald-400 hover:to-blue-500 text-white font-bold text-xs transition shadow-md shadow-emerald-500/20 cursor-pointer"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span>Call Provider with this ROI Pitch</span>
                </button>
              )}

              <button
                type="button"
                onClick={copyPitchToClipboard}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition cursor-pointer border border-white/15"
              >
                {copiedPitch ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedPitch ? 'Copied to Clipboard!' : 'Copy Physician Pitch'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectPreset('Cardiology')}
                className="p-2 rounded-xl text-slate-400 hover:text-white transition cursor-pointer hover:bg-white/5"
                title="Reset to default benchmark parameters"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* D3-Based Interactive Denial Recovery & Net Revenue Velocity Trajectory */}
      <D3RevenueVelocityChart
        monthlyClaimsBilled={monthlyClaimsBilled}
        currentDenialRate={currentDenialRate}
        pulsarOverturnRate={pulsarOverturnRate}
        monthlyDenialRecovery={monthlyDenialRecovery}
        monthlyArCashBenefit={monthlyArCashBenefit}
        totalMonthlyNetImprovement={totalMonthlyNetImprovement}
        improvedNetCollectionRate={improvedNetCollectionRate}
        baselineNetCollectionRate={baselineNetCollectionRate}
        practiceSpecialty={practiceSpecialty}
        nicheTemplate={nicheTemplate}
        isDark={isDark}
      />

      {/* Google Maps Lead Geo-Distribution & Heat Map Density */}
      <LeadGeoDistribution
        leads={leads}
        onTriggerCall={onTriggerCall}
      />
    </div>
  );
};
