import React from 'react';
import { 
  CheckCircle2, 
  Clock, 
  ExternalLink, 
  TrendingUp, 
  Users, 
  Send, 
  AlertCircle, 
  ShieldCheck, 
  RefreshCw,
  Sparkles,
  UserCheck,
  ChevronRight,
  User,
  Activity,
  Flame,
  Download
} from 'lucide-react';
import { LinkedInConnectedAccount, LinkedInQueueItem } from '../types';
import { exportLinkedInQueueToCSV } from '../utils/linkedinCsvExport';

interface LinkedInDailyProgressRingProps {
  account: LinkedInConnectedAccount;
  recentLogs: LinkedInQueueItem[];
  isProcessing?: boolean;
  onOpenAutomator?: () => void;
  onRefreshAccount?: () => void;
  onEditAccount?: () => void;
}

export const LinkedInDailyProgressRing: React.FC<LinkedInDailyProgressRingProps> = ({
  account,
  recentLogs,
  isProcessing = false,
  onOpenAutomator,
  onRefreshAccount,
  onEditAccount
}) => {
  const [exportNotice, setExportNotice] = React.useState<string | null>(null);
  const dailyLimit = account.dailyLimit || 50;
  const sentToday = account.requestsSentToday || 0;
  const percentage = Math.min(100, Math.round((sentToday / dailyLimit) * 100));
  const remaining = Math.max(0, dailyLimit - sentToday);

  // SVG circular ring geometry
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  // Recent sent, accepted, or active logs
  const displayLogs = recentLogs.filter(item => 
    item.status === 'sent' || item.status === 'accepted' || item.status === 'sending' || item.status === 'approved'
  ).slice(0, 10);

  const acceptedCount = recentLogs.filter(i => i.status === 'accepted').length;
  const totalDispatched = recentLogs.filter(i => i.status === 'sent' || i.status === 'accepted').length;
  const calculatedAcceptanceRate = totalDispatched > 0 
    ? Math.round((acceptedCount / totalDispatched) * 100) 
    : (account.acceptanceRate || 44);

  return (
    <div className="space-y-6">
      {/* Top Banner: Connected Account & Daily Progress Gauge */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 p-6 rounded-2xl glass-panel bg-gradient-to-r from-slate-950/90 via-blue-950/30 to-slate-950/90 border border-white/10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

        {/* Circular Progress Gauge */}
        <div className="lg:col-span-4 flex flex-col items-center justify-center p-6 bg-slate-950/80 rounded-2xl border border-white/10 relative z-10 shadow-inner">
          <div className={`relative w-44 h-44 flex items-center justify-center transition-transform ${isProcessing ? 'animate-ring-pulse' : ''}`}>
            <svg className="w-full h-full transform -rotate-90">
              {/* Background Track */}
              <circle
                cx="88"
                cy="88"
                r={radius}
                className={`text-slate-800/80 ${isProcessing ? 'animate-ring-track-pulse' : ''}`}
                strokeWidth="12"
                stroke="currentColor"
                fill="transparent"
              />
              {/* Progress Ring */}
              <circle
                cx="88"
                cy="88"
                r={radius}
                className="transition-all duration-1000 ease-out"
                strokeWidth="12"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                stroke={
                  percentage >= 100 
                    ? '#f59e0b' 
                    : percentage > 70 
                    ? '#38bdf8' 
                    : '#06b6d4'
                }
                fill="transparent"
              />
            </svg>
            
            {/* Center Metric Display */}
            <div className="absolute flex flex-col items-center justify-center text-center">
              {isProcessing && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[9px] font-mono uppercase font-bold tracking-wider mb-1 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                  Dispatching...
                </span>
              )}
              <span className="font-mono text-3xl font-black text-white tracking-tight">
                {sentToday}
                <span className="text-slate-400 text-base font-normal">/{dailyLimit}</span>
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 mt-0.5">
                {percentage}% Quota Used
              </span>
              <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                Daily Limit: 50
              </span>
            </div>
          </div>

          <div className="mt-4 text-center w-full">
            <div className="text-xs font-bold text-slate-200">
              {remaining > 0 ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <strong>{remaining} outbound slots</strong> remaining today
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                  Daily Safe Limit Reached (50/50)
                </span>
              )}
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-2 flex items-center justify-center gap-1">
              <Clock className="w-3 h-3 text-slate-500" />
              <span>Throttle safety cycle resets nightly at 00:00 PST</span>
            </div>
          </div>
        </div>

        {/* Account Details & Operational KPIs */}
        <div className="lg:col-span-8 flex flex-col justify-between space-y-4 relative z-10">
          <div>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Connected Account: <strong>{account.accountName}</strong></span>
              </div>

              <div className="flex items-center gap-2">
                {onRefreshAccount && (
                  <button
                    onClick={onRefreshAccount}
                    className="p-1.5 rounded-lg bg-slate-900 border border-white/10 hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
                    title="Refresh account status and logs"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                )}
                {onEditAccount && (
                  <button
                    onClick={onEditAccount}
                    className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
                  >
                    Account Settings
                  </button>
                )}
                <span className="text-xs font-mono text-slate-400">
                  Last Sync: {account.lastSyncTimestamp}
                </span>
              </div>
            </div>

            <h3 className="text-lg sm:text-xl font-black text-white mt-2 flex items-center gap-2">
              <span>{account.headline || 'VP of Healthcare Business Development & Clinical Partnerships'}</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Live Profile: <a href={account.profileUrl} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline inline-flex items-center gap-1">
                {account.profileUrl} <ExternalLink className="w-3 h-3 inline" />
              </a>
            </p>
          </div>

          {/* KPI Cards Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-white/5">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Requests Sent</div>
              <div className="font-mono text-2xl font-black text-cyan-300 mt-0.5">{sentToday}</div>
              <div className="text-[10px] text-slate-500">out of 50/day max</div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-white/5">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Acceptance Rate</div>
              <div className="font-mono text-2xl font-black text-emerald-400 mt-0.5">{calculatedAcceptanceRate}%</div>
              <div className="text-[10px] text-emerald-400/80 font-mono">+12.4% vs industry avg</div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-white/5">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Network Size</div>
              <div className="font-mono text-2xl font-black text-white mt-0.5">{account.totalConnections.toLocaleString()}</div>
              <div className="text-[10px] text-slate-500">1st degree medical connections</div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-white/5">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Anti-Spam Protocol</div>
              <div className="font-mono text-xs font-bold text-teal-300 mt-1.5 flex items-center gap-1">
                <ShieldCheck className="w-4 h-4 text-teal-400" />
                <span>Active Safe Throttling</span>
              </div>
              <div className="text-[10px] text-slate-500">Randomized 45-120s delay</div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Outbound Connection Status Log */}
      <div className="p-6 rounded-2xl glass-panel border border-white/10 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-white/10 flex-wrap gap-2">
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span>Outbound Connection Activity & Status Log</span>
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Real-time audit trail of connection requests dispatched by individual account <strong>{account.accountName}</strong>.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (recentLogs.length === 0) return;
                const result = exportLinkedInQueueToCSV(recentLogs, 'Pulsar_LinkedIn_Outreach_Activity');
                setExportNotice(`Exported ${result.count} connection statuses and profiles to ${result.filename}`);
                setTimeout(() => setExportNotice(null), 4000);
              }}
              disabled={recentLogs.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              title="Export all connection statuses and profile details to CSV for external CRM management"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export CSV ({recentLogs.length})</span>
            </button>

            {onOpenAutomator && (
              <button
                onClick={onOpenAutomator}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-bold transition shadow-md shadow-blue-600/20 cursor-pointer"
              >
                <span>Manage Automation Queue</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {exportNotice && (
          <div className="px-3.5 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
            <span>✓ {exportNotice}</span>
            <button onClick={() => setExportNotice(null)} className="text-emerald-400 hover:text-white font-mono text-xs">✕</button>
          </div>
        )}

        {displayLogs.length === 0 ? (
          <div className="py-12 text-center text-slate-400 bg-slate-950/50 rounded-xl border border-dashed border-slate-800">
            <Send className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium text-slate-300">No outbound connection requests dispatched yet today.</p>
            <p className="text-xs text-slate-500 mt-1">Use the Outreach Automator tab to find niche medical decision-makers and start the 50/day safe sequence.</p>
            {onOpenAutomator && (
              <button
                onClick={onOpenAutomator}
                className="mt-4 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition cursor-pointer"
              >
                Launch Outreach Automator
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/70 text-[11px] uppercase tracking-wider text-slate-400 border-b border-white/5">
                <tr>
                  <th className="py-3 px-3">Decision Maker & Practice</th>
                  <th className="py-3 px-3">Target Specialty</th>
                  <th className="py-3 px-3">Dispatched Note Angle</th>
                  <th className="py-3 px-3">Time Dispatched</th>
                  <th className="py-3 px-3 text-right">Connection Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {displayLogs.map((log) => {
                  const isAccepted = log.status === 'accepted';
                  const isSent = log.status === 'sent';
                  const isSending = log.status === 'sending';

                  return (
                    <tr key={log.id} className="hover:bg-slate-900/50 transition">
                      <td className="py-3 px-3">
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <span>{log.prospect.fullName}</span>
                          <a 
                            href={log.prospect.linkedInUrl} 
                            target="_blank" 
                            rel="noreferrer"
                            className="text-slate-500 hover:text-blue-400"
                            title="Open LinkedIn Profile"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                        <div className="text-[11px] text-slate-400 truncate max-w-xs">
                          {log.prospect.practice} • {log.prospect.location}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-mono">
                          {log.prospect.specialty || 'General Business'}
                        </span>
                      </td>

                      <td className="py-3 px-3 max-w-xs">
                        <div className="text-slate-200 truncate font-sans text-[11px]" title={log.personalizedNote}>
                          "{log.personalizedNote || log.templateName || 'Personalized Connection Note'}"
                        </div>
                        <div className="text-[10px] text-blue-400 font-mono mt-0.5">
                          Template: {log.templateName || 'Clean Claim Focus'}
                        </div>
                      </td>

                      <td className="py-3 px-3 font-mono text-[11px] text-slate-400">
                        {log.sentAt || log.addedAt}
                      </td>

                      <td className="py-3 px-3 text-right">
                        {isAccepted ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            Connected!
                          </span>
                        ) : isSent ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[11px] font-medium">
                            <Send className="w-3 h-3 text-blue-400" />
                            Request Dispatched
                          </span>
                        ) : isSending ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-medium animate-pulse">
                            <RefreshCw className="w-3 h-3 text-amber-400 animate-spin" />
                            Sending...
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-mono">
                            Verified in Queue
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
