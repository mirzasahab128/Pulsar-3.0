import React, { useState } from 'react';
import { 
  Bot, 
  ShieldCheck, 
  Play, 
  Pause, 
  RotateCcw, 
  Settings, 
  FileText, 
  AlertTriangle, 
  CheckCircle2, 
  Sparkles, 
  Clock, 
  Layers, 
  Activity,
  ArrowRight,
  Sliders,
  ChevronRight
} from 'lucide-react';
import { PulsarAIAgent, AgentAutonomyLevel, AgentRuntimeStatus } from '../types';
import { useTheme } from '../context/ThemeContext';

export const AIAgentFleetWorkspace: React.FC = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [agents, setAgents] = useState<PulsarAIAgent[]>([
    {
      id: 'agent-skiper',
      name: 'Skiper Radar Bot',
      role: 'Registry & NPI Autonomous Prospecting',
      description: 'Crawls national provider registries, verifies physician credentials, practice size, and specialty classifications.',
      autonomyLevel: 'execute_approval',
      status: 'active',
      channel: 'National NPI Registry & Web Scraper',
      currentTask: 'Ingesting Seattle & Austin cardiology clinics',
      tasksCompleted: 142,
      pendingApprovals: 5,
      lastActivity: '3 mins ago',
      healthScore: 98,
      confidenceScore: 94,
      errorCount: 0
    },
    {
      id: 'agent-zoey',
      name: 'Zoey Conversational Voice Caller',
      role: 'Outbound Discovery & Warm Transfer Orchestration',
      description: 'Engages practice decision-makers via Twilio Programmable Voice or WhatsApp SIP, pitches audit proposals, and initiates warm handoffs.',
      autonomyLevel: 'prepare',
      status: 'active',
      channel: 'Twilio Programmable Voice / SIP WebRTC',
      currentTask: 'Monitoring scheduled follow-up call queue',
      tasksCompleted: 42,
      pendingApprovals: 2,
      lastActivity: '12 mins ago',
      healthScore: 96,
      confidenceScore: 91,
      errorCount: 1,
      lastError: 'Line busy on (512) 892-4100; retry scheduled in 15m'
    },
    {
      id: 'agent-linkedin',
      name: 'LinkedIn BD Strategist',
      role: 'Executive Mapping & Personalized InMail Drafting',
      description: 'Researches clinic C-level leadership, analyzes job history and practice affiliation, and drafts human-approved connection requests.',
      autonomyLevel: 'recommend',
      status: 'idle',
      channel: 'LinkedIn Official OAuth & Partner API',
      currentTask: 'Standing by for approved target prospect list',
      tasksCompleted: 88,
      pendingApprovals: 8,
      lastActivity: '28 mins ago',
      healthScore: 100,
      confidenceScore: 89,
      errorCount: 0
    },
    {
      id: 'agent-email',
      name: 'Email Sequence Synthesizer',
      role: 'Multi-Turn Cold Outreach & Deliverability Safeguard',
      description: 'Generates personalized email copy addressing specific billing pain points, monitors open/reply telemetry, and enforces suppression lists.',
      autonomyLevel: 'execute_approval',
      status: 'active',
      channel: 'Google Workspace / Gmail API (OAuth 2.0)',
      currentTask: 'Evaluating deliverability on 25 scheduled drafts',
      tasksCompleted: 64,
      pendingApprovals: 4,
      lastActivity: '8 mins ago',
      healthScore: 95,
      confidenceScore: 93,
      errorCount: 0
    },
    {
      id: 'agent-briefing',
      name: 'Daily PST Intelligence Dispatcher',
      role: 'Executive Performance Briefing & Conversion Analytics',
      description: 'Compiles end-of-day pipeline metrics, call conversion rates, denial audit valuations, and delivers PST summary reports at 4:00 PM.',
      autonomyLevel: 'authorized_automation',
      status: 'active',
      channel: 'PST Cron Engine & Manager Telephony Bridge',
      currentTask: 'Next scheduled report at 4:00 PM PST',
      tasksCompleted: 29,
      pendingApprovals: 0,
      lastActivity: 'Yesterday at 4:00 PM PST',
      healthScore: 100,
      confidenceScore: 99,
      errorCount: 0
    }
  ]);

  const [selectedAgent, setSelectedAgent] = useState<PulsarAIAgent | null>(agents[0]);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  const autonomyLevels: Array<{
    id: AgentAutonomyLevel;
    label: string;
    description: string;
    badgeColor: string;
  }> = [
    {
      id: 'observe',
      label: '1. Observe',
      description: 'Passive telemetry only; reads data without proposing actions.',
      badgeColor: 'text-[var(--pv-muted)]'
    },
    {
      id: 'recommend',
      label: '2. Recommend',
      description: 'Analyzes prospects and generates strategic recommendations for human review.',
      badgeColor: 'text-sky-400'
    },
    {
      id: 'prepare',
      label: '3. Prepare',
      description: 'Drafts emails, pre-configures call queues, and generates notes awaiting approval.',
      badgeColor: 'text-violet-400'
    },
    {
      id: 'execute_approval',
      label: '4. Execute with Approval',
      description: 'Queues live dispatches; requires human sign-off before actual transmission.',
      badgeColor: 'text-amber-400'
    },
    {
      id: 'authorized_automation',
      label: '5. Authorized Automation',
      description: 'Autonomously executes actions within strict compliance and rate guardrails.',
      badgeColor: 'text-emerald-400'
    }
  ];

  const handleUpdateAutonomy = (agentId: string, level: AgentAutonomyLevel) => {
    setAgents(prev => prev.map(a => a.id === agentId ? { ...a, autonomyLevel: level } : a));
    if (selectedAgent && selectedAgent.id === agentId) {
      setSelectedAgent(prev => prev ? { ...prev, autonomyLevel: level } : null);
    }
    setFeedbackNotice(`Updated autonomy guardrail for agent to: ${level.replace('_', ' ').toUpperCase()}`);
    setTimeout(() => setFeedbackNotice(null), 3500);
  };

  const handleToggleAgentStatus = (agentId: string) => {
    setAgents(prev => prev.map(a => {
      if (a.id === agentId) {
        const nextStatus: AgentRuntimeStatus = a.status === 'active' ? 'paused' : 'active';
        return { ...a, status: nextStatus };
      }
      return a;
    }));
    if (selectedAgent && selectedAgent.id === agentId) {
      setSelectedAgent(prev => prev ? { ...prev, status: prev.status === 'active' ? 'paused' : 'active' } : null);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className={`p-6 rounded-3xl border glass-elevated relative overflow-hidden ${
        isDark 
          ? 'bg-gradient-to-r from-slate-950/80 via-slate-900/60 to-violet-950/40 border-white/[0.1] shadow-xl' 
          : 'bg-white border-slate-200 shadow-md'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-violet-400 mb-1">
              <ShieldCheck className="w-4 h-4" />
              <span>GUARDED AUTONOMY GOVERNANCE</span>
            </div>
            <h1 className="text-2xl font-black text-[var(--pv-ink)] font-display tracking-tight">
              AI Agent Fleet Command Center
            </h1>
            <p className="text-xs text-[var(--pv-muted)] max-w-2xl mt-1">
              Configure operational boundaries, human-in-the-loop sign-offs, and runtime health across all autonomous SDR agents.
            </p>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs text-[var(--pv-ink)] bg-[var(--pv-card-soft)] p-2 rounded-xl border border-[var(--pv-border)] shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#10b981]" />
            <span>5 Agents Configured · 0 Failures</span>
          </div>
        </div>
      </div>

      {feedbackNotice && (
        <div className="p-3 rounded-xl bg-violet-950/80 border border-violet-500/40 text-violet-200 text-xs flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-violet-400 shrink-0" />
          <span>{feedbackNotice}</span>
        </div>
      )}

      {/* Main Agent Grid & Inspector Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Agent Cards */}
        <div className="lg:col-span-2 space-y-4">
          {agents.map((agent) => {
            const isSelected = selectedAgent?.id === agent.id;
            const currentLevel = autonomyLevels.find(l => l.id === agent.autonomyLevel);

            return (
              <div
                key={agent.id}
                onClick={() => setSelectedAgent(agent)}
                className={`p-5 rounded-2xl border transition-all duration-200 cursor-pointer ${
                  isSelected
                    ? isDark 
                      ? 'glass-active bg-violet-600/15 border-violet-500/50 shadow-[0_0_30px_rgba(139,92,246,0.18)]' 
                      : 'bg-violet-50 border-violet-300 shadow-md'
                    : isDark 
                      ? 'glass-standard bg-slate-900/60 border-white/[0.08] hover:border-white/20' 
                      : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`p-2.5 rounded-xl border ${
                      agent.status === 'active'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    }`}>
                      <Bot className="w-5 h-5" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[var(--pv-ink)]">{agent.name}</span>
                        <span className={`text-[10px] font-mono px-2 py-0.2 rounded border ${
                          agent.status === 'active' 
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' 
                            : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                        }`}>
                          {agent.status.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-xs text-[var(--pv-muted)] mt-0.5">{agent.role}</div>
                    </div>
                  </div>

                  {/* Quick Pause / Resume Action */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleAgentStatus(agent.id);
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                        agent.status === 'active'
                          ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30'
                          : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      }`}
                    >
                      {agent.status === 'active' ? (
                        <>
                          <Pause className="w-3.5 h-3.5" />
                          <span>Pause</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5" />
                          <span>Resume</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <p className="text-xs text-[var(--pv-muted)] mt-3 leading-relaxed">
                  {agent.description}
                </p>

                {/* Agent Metrics & Autonomy Guardrail */}
                <div className="mt-4 pt-3 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3 text-[var(--pv-muted)]">
                    <span>Channel: <strong className="text-[var(--pv-ink)]">{agent.channel.split('(')[0].trim()}</strong></span>
                    <span>·</span>
                    <span>Tasks: <strong className="text-[var(--pv-ink)] font-mono tabular-nums">{agent.tasksCompleted}</strong></span>
                    <span>·</span>
                    <span>Pending: <strong className="text-amber-400 font-mono tabular-nums">{agent.pendingApprovals}</strong></span>
                  </div>

                  <div className={`font-mono font-semibold text-[11px] ${currentLevel?.badgeColor}`}>
                    {currentLevel?.label}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right 1 Col: Selected Agent Guardrail & Telemetry Inspector */}
        {selectedAgent && (
          <div className={`p-5 rounded-3xl border glass-elevated space-y-5 h-fit ${
            isDark ? 'bg-slate-900/70 border-white/[0.08]' : 'bg-white border-slate-200 shadow-md'
          }`}>
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-violet-400" />
                <span className="font-bold text-sm text-[var(--pv-ink)]">Guardrail Inspector</span>
              </div>
              <span className="text-xs font-mono text-[var(--pv-muted)]">{selectedAgent.name}</span>
            </div>

            {/* Guarded Autonomy Level Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[var(--pv-ink)] block">
                Permitted Autonomy Tier:
              </label>

              <div className="space-y-2">
                {autonomyLevels.map((level) => {
                  const isCurrent = selectedAgent.autonomyLevel === level.id;
                  return (
                    <button
                      key={level.id}
                      onClick={() => handleUpdateAutonomy(selectedAgent.id, level.id)}
                      className={`w-full text-left p-2.5 rounded-xl border text-xs transition cursor-pointer ${
                        isCurrent
                          ? isDark 
                            ? 'bg-[var(--pv-violet-tint)] border-[var(--pv-border)] text-[var(--pv-violet)] shadow-sm' 
                            : 'bg-violet-100 border-violet-300 text-violet-950 font-semibold'
                          : isDark 
                            ? 'bg-white/[0.02] border-white/[0.06] text-[var(--pv-muted)] hover:text-[var(--pv-ink)] hover:bg-white/[0.04]' 
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold">
                        <span>{level.label}</span>
                        {isCurrent && <CheckCircle2 className="w-3.5 h-3.5 text-violet-400" />}
                      </div>
                      <div className="text-[11px] text-[var(--pv-muted)] mt-1 leading-snug">
                        {level.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Health & Diagnostic Telemetry */}
            <div className="pt-3 border-t border-white/[0.06] space-y-2.5 text-xs">
              <div className="font-bold text-[var(--pv-ink)]">Operational Telemetry</div>

              <div className="flex items-center justify-between text-[var(--pv-muted)]">
                <span>Model Confidence Index:</span>
                <span className="font-mono text-emerald-400 font-bold">{selectedAgent.confidenceScore}%</span>
              </div>

              <div className="flex items-center justify-between text-[var(--pv-muted)]">
                <span>Agent Health Score:</span>
                <span className="font-mono text-[var(--pv-accent)] font-bold">{selectedAgent.healthScore}%</span>
              </div>

              <div className="flex items-center justify-between text-[var(--pv-muted)]">
                <span>Last Telemetry Heartbeat:</span>
                <span className="font-mono text-[var(--pv-ink)]">{selectedAgent.lastActivity}</span>
              </div>

              {selectedAgent.lastError && (
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{selectedAgent.lastError}</span>
                </div>
              )}
            </div>

            {/* Emergency Kill Switch / Pause */}
            <div className="pt-2">
              <button
                onClick={() => handleToggleAgentStatus(selectedAgent.id)}
                className={`w-full py-2.5 rounded-xl border font-bold text-xs transition cursor-pointer text-center ${
                  selectedAgent.status === 'active'
                    ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border-rose-500/30'
                    : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                }`}
              >
                {selectedAgent.status === 'active' ? 'Emergency Pause Agent' : 'Restart Autonomous Execution'}
              </button>
            </div>
          </div>
        )}

      </div>

    </div>
  );
};
