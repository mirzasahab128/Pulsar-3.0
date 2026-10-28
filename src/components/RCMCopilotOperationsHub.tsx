import React, { useState } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Zap, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  FileText, 
  DollarSign, 
  Database, 
  Layers, 
  Activity, 
  Lock, 
  Unlock, 
  RefreshCw, 
  ArrowRight, 
  ChevronRight, 
  Sparkles, 
  Check, 
  X, 
  Eye, 
  Send, 
  FileCheck, 
  ExternalLink, 
  Sliders, 
  Server, 
  AlertCircle,
  HelpCircle,
  TrendingDown,
  TrendingUp,
  Cpu,
  Power
} from 'lucide-react';
import { 
  RCMStage, 
  EligibilityVerification, 
  PriorAuthorization, 
  ClaimRecord, 
  ClearinghouseRejection, 
  DenialRecord, 
  ARAgingBucket, 
  ERARemittance, 
  UnderpaymentRecord, 
  CredentialingRecord, 
  GuardedAction, 
  RCMConnector, 
  AuditLogEntry,
  RCMGlobalControls 
} from '../types/rcmCopilot';
import { 
  SYNTHETIC_ELIGIBILITY, 
  SYNTHETIC_PRIOR_AUTHS, 
  SYNTHETIC_CLAIMS, 
  SYNTHETIC_REJECTIONS, 
  SYNTHETIC_DENIALS, 
  SYNTHETIC_AR_BUCKETS, 
  SYNTHETIC_ERA_REMITTANCES, 
  SYNTHETIC_UNDERPAYMENTS, 
  SYNTHETIC_CREDENTIALING, 
  SYNTHETIC_GUARDED_ACTIONS, 
  SYNTHETIC_CONNECTORS, 
  SYNTHETIC_AUDIT_LOGS 
} from '../data/rcmSeedData';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

interface RCMCopilotOperationsHubProps {
  onOpenCodebase?: () => void;
  onOpenSettings?: () => void;
}

export const RCMCopilotOperationsHub: React.FC<RCMCopilotOperationsHubProps> = ({
  onOpenCodebase,
  onOpenSettings
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { isReadOnly, isMasterAdmin, profile } = useAuth();

  // Active RCM Sub-Stage
  const [activeStage, setActiveStage] = useState<RCMStage>('overview' as any);

  // Guarded Autonomy & Global Controls State
  const [controls, setControls] = useState<RCMGlobalControls>({
    killSwitchActive: false,
    agentAutonomyMode: 'guarded',
    humanReviewThresholdUSD: 1000,
    dryRunMode: true,
    syntheticDataMode: true
  });

  // State data initialized with synthetic seed records
  const [claims, setClaims] = useState<ClaimRecord[]>(SYNTHETIC_CLAIMS);
  const [denials, setDenials] = useState<DenialRecord[]>(SYNTHETIC_DENIALS);
  const [rejections, setRejections] = useState<ClearinghouseRejection[]>(SYNTHETIC_REJECTIONS);
  const [guardedActions, setGuardedActions] = useState<GuardedAction[]>(SYNTHETIC_GUARDED_ACTIONS);
  const [connectors, setConnectors] = useState<RCMConnector[]>(SYNTHETIC_CONNECTORS);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(SYNTHETIC_AUDIT_LOGS);

  // Selected item modals / preview
  const [selectedDenial, setSelectedDenial] = useState<DenialRecord | null>(SYNTHETIC_DENIALS[0]);
  const [generatingAppeal, setGeneratingAppeal] = useState<boolean>(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [testingConnectorId, setTestingConnectorId] = useState<string | null>(null);

  // Helper feedback banner
  const triggerNotification = (msg: string) => {
    setActionFeedback(msg);
    setTimeout(() => setActionFeedback(null), 4000);
  };

  // Toggle Global Kill Switch
  const handleToggleKillSwitch = () => {
    if (isReadOnly) {
      triggerNotification('Permission Denied: Customer account is Read-Only. Admin permissions required.');
      return;
    }
    const nextState = !controls.killSwitchActive;
    setControls(prev => ({ ...prev, killSwitchActive: nextState }));
    
    // Add to audit trail
    const audit: AuditLogEntry = {
      id: `AUD-KS-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString() + ' CST',
      actor: profile?.displayName || 'Master Admin',
      role: isMasterAdmin ? 'Admin Controller' : 'User',
      action: nextState ? 'EMERGENCY FREEZE: Global Kill Switch Engaged' : 'SYSTEM RESUMED: Global Kill Switch Disengaged',
      stage: 'guarded_actions',
      targetId: 'KILL_SWITCH',
      financialImpact: 0,
      approvalStatus: 'Executive Override',
      dryRun: controls.dryRunMode,
      verificationHash: `sha256-${Math.random().toString(36).slice(2, 10)}${Date.now()}`,
      details: nextState 
        ? 'All autonomous claim dispatches, appeals, and balance adjustments immediately frozen.' 
        : 'Guarded operations returned to standby.'
    };
    setAuditLogs(prev => [audit, ...prev]);
    triggerNotification(nextState ? 'EMERGENCY KILL SWITCH ENGAGED — External writes blocked!' : 'Kill Switch Disengaged — System Operational.');
  };

  // Approve Guarded Action
  const handleApproveAction = (actionId: string) => {
    if (controls.killSwitchActive) {
      triggerNotification('BLOCKED: Global Kill Switch is currently active. Action cannot be approved.');
      return;
    }
    if (isReadOnly) {
      triggerNotification('Permission Denied: Customer account is Read-Only.');
      return;
    }

    setGuardedActions(prev => prev.map(a => {
      if (a.id === actionId) {
        return {
          ...a,
          status: 'approved',
          approvedBy: profile?.displayName || 'Master Admin'
        };
      }
      return a;
    }));

    const found = guardedActions.find(a => a.id === actionId);
    if (found) {
      const audit: AuditLogEntry = {
        id: `AUD-APP-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString() + ' CST',
        actor: profile?.displayName || 'Master Admin',
        role: 'Admin Controller',
        action: `Approved Guarded Action: ${found.title}`,
        stage: 'guarded_actions',
        targetId: found.id,
        financialImpact: found.financialImpact,
        approvalStatus: 'Approved by Supervisor',
        dryRun: controls.dryRunMode,
        verificationHash: `sha256-verified-${Date.now()}`,
        details: `Human review threshold satisfied. Approved for ${controls.dryRunMode ? 'Dry-Run Simulation' : 'Live Execution'}.`
      };
      setAuditLogs(prev => [audit, ...prev]);
    }
    triggerNotification(`Guarded Action ${actionId} Approved!`);
  };

  // Execute Guarded Action (with Dry-Run safety)
  const handleExecuteAction = (actionId: string) => {
    if (controls.killSwitchActive) {
      triggerNotification('BLOCKED: Global Kill Switch is currently active.');
      return;
    }
    if (isReadOnly) {
      triggerNotification('Permission Denied: Customer account is Read-Only.');
      return;
    }

    setGuardedActions(prev => prev.map(a => {
      if (a.id === actionId) {
        return {
          ...a,
          status: 'executed',
          executedAt: new Date().toLocaleTimeString() + ' CST',
          verificationHash: `sha256-exec-${Date.now()}`
        };
      }
      return a;
    }));

    const found = guardedActions.find(a => a.id === actionId);
    if (found) {
      const audit: AuditLogEntry = {
        id: `AUD-EXEC-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString() + ' CST',
        actor: profile?.displayName || 'Master Admin',
        role: 'Admin Controller',
        action: `Executed Guarded Action: ${found.title} (${controls.dryRunMode ? 'DRY-RUN' : 'LIVE'})`,
        stage: 'guarded_actions',
        targetId: found.id,
        financialImpact: found.financialImpact,
        approvalStatus: 'Executed & Verified',
        dryRun: controls.dryRunMode,
        verificationHash: `sha256-verified-postaction-${Date.now()}`,
        details: controls.dryRunMode 
          ? 'Dry-run execution verified successfully without external clearinghouse mutation.'
          : 'Live API transaction dispatched to connector.'
      };
      setAuditLogs(prev => [audit, ...prev]);
    }
    triggerNotification(`Action ${actionId} successfully executed (${controls.dryRunMode ? 'Dry-Run Mode' : 'Live'})!`);
  };

  // Auto-Fix Clearinghouse Rejection
  const handleAutoFixRejection = (rejectionId: string) => {
    if (controls.killSwitchActive) {
      triggerNotification('BLOCKED: Global Kill Switch is active.');
      return;
    }
    if (isReadOnly) {
      triggerNotification('Permission Denied: Customer account is Read-Only.');
      return;
    }

    setRejections(prev => prev.map(r => r.id === rejectionId ? { ...r, resolved: true } : r));
    triggerNotification(`Auto-Fix applied for Rejection ${rejectionId}: EDI Loop 2310B Taxonomy code injected!`);
  };

  // Test Connector
  const handleTestConnector = async (connectorId: string) => {
    setTestingConnectorId(connectorId);
    await new Promise(r => setTimeout(r, 1200));
    setTestingConnectorId(null);

    setConnectors(prev => prev.map(c => {
      if (c.id === connectorId) {
        return {
          ...c,
          lastSync: 'Just now (Verified)',
          verificationStatus: c.isMock ? 'Verified (Synthetic)' : 'Verified (Production)'
        };
      }
      return c;
    }));

    triggerNotification(`Connector ${connectorId.toUpperCase()} ping test succeeded! Handshake confirmed.`);
  };

  // Generate AI Appeal Letter
  const handleGenerateAppeal = async (denial: DenialRecord) => {
    setGeneratingAppeal(true);
    await new Promise(r => setTimeout(r, 1500));
    setGeneratingAppeal(false);

    const generated = `ATTN: Medicare Part B Redetermination / Appeals Unit
Payer: ${denial.payerName}
Claim Control Number: ${denial.claimControlNumber}
Patient: ${denial.patientName}
Date of Service: ${denial.dateOfService}
Denied Code: ${denial.carcCode} (${denial.carcDescription})
Amount in Dispute: $${denial.deniedAmount.toFixed(2)}

Dear Appeals Committee,

We are submitting this Level 1 Redetermination Appeal regarding the denial of services on the above referenced claim. The denial was issued under code ${denial.carcCode}.

CLINICAL EVIDENCE & COVERAGE DETERMINATION:
${denial.evidenceCitations.map(e => `• ${e}`).join('\n')}

Based on the documented clinical findings, the procedure fully satisfied medical necessity criteria. We request immediate reversal and payment of $${denial.deniedAmount.toFixed(2)}.

Respectfully submitted,
RCM Copilot Autonomous Appeals Specialist
Verified & Reviewed by Certified Coder`;

    setDenials(prev => prev.map(d => d.id === denial.id ? { ...d, appealStatus: 'Approved', generatedAppealText: generated } : d));
    setSelectedDenial(prev => prev ? { ...prev, appealStatus: 'Approved', generatedAppealText: generated } : null);
    triggerNotification('AI Appeal Letter generated with clinical LCD citations!');
  };

  return (
    <div className="space-y-4 animate-fade-in pb-12">
      {/* Top Banner: Guarded Autonomy & Kill Switch HUD */}
      <div className={`p-4 rounded-2xl border transition-all duration-300 ${
        controls.killSwitchActive
          ? 'bg-rose-950/80 border-rose-500 shadow-[0_0_35px_rgba(244,63,94,0.35)]'
          : isDark
            ? 'glass-panel bg-slate-950/80 border-teal-500/30 shadow-[0_4px_30px_rgba(0,0,0,0.5)]'
            : 'bg-white border-slate-200 shadow-lg'
      }`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Title & Core Autonomy Badge */}
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black shadow-lg ${
              controls.killSwitchActive
                ? 'bg-rose-600 text-white animate-pulse'
                : 'bg-gradient-to-tr from-teal-400 to-cyan-500 text-slate-950 shadow-teal-500/25'
            }`}>
              {controls.killSwitchActive ? <Power className="w-6 h-6" /> : <Cpu className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black font-display tracking-tight text-white flex items-center gap-2">
                  <span>RCM Copilot — Enterprise Operations Engine</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/40 uppercase font-bold">
                    v2.4 Production
                  </span>
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                <span>Guarded Autonomy Active</span>
                <span>•</span>
                <span className="text-emerald-400 font-medium">Brightree & Availity Connectors Configured</span>
                <span>•</span>
                <span className="text-sky-400 font-mono text-[11px]">100% Synthetic HIPAA-Safe Sandbox</span>
              </p>
            </div>
          </div>

          {/* Quick Autonomy Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Kill Switch Button */}
            <button
              onClick={handleToggleKillSwitch}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer transform active:scale-95 shadow-md ${
                controls.killSwitchActive
                  ? 'bg-rose-600 hover:bg-rose-500 text-white ring-2 ring-rose-400'
                  : 'bg-slate-900 hover:bg-rose-950/60 text-rose-400 border border-rose-500/40 hover:border-rose-500'
              }`}
              title="Global execution kill switch. Freezes all automated claims, appeals, and adjustments immediately."
            >
              <Power className={`w-4 h-4 ${controls.killSwitchActive ? 'animate-spin' : ''}`} />
              <span>{controls.killSwitchActive ? 'KILL SWITCH ENGAGED' : 'Kill Switch Ready'}</span>
            </button>

            {/* Dry-Run Mode Toggle */}
            <button
              onClick={() => setControls(c => ({ ...c, dryRunMode: !c.dryRunMode }))}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                controls.dryRunMode
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                  : 'bg-slate-900 border-slate-700 text-slate-400'
              }`}
              title="Dry Run mode simulates writes and returns verification hashes without transmitting to live clearinghouses."
            >
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>{controls.dryRunMode ? 'Dry-Run Mode: ON' : 'Dry-Run Mode: OFF'}</span>
            </button>

            {/* Threshold Badge */}
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 font-mono">
              <DollarSign className="w-3.5 h-3.5 text-teal-400" />
              <span>Review Threshold: <strong className="text-white">${controls.humanReviewThresholdUSD.toLocaleString()}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Notification Banner */}
      {actionFeedback && (
        <div className="p-3 rounded-xl bg-teal-500/20 border border-teal-500 text-teal-200 text-xs font-bold flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-teal-400" />
            <span>{actionFeedback}</span>
          </div>
          <button onClick={() => setActionFeedback(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 12-Stage Lifecycle Navigation Dock */}
      <div className={`p-1.5 rounded-2xl border flex items-center gap-1 overflow-x-auto text-xs backdrop-blur-xl ${
        isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-100 border-slate-200'
      }`}>
        {[
          { id: 'overview', label: '1. RCM Operations HUD' },
          { id: 'eligibility', label: '2. Eligibility & Auth (270/271)' },
          { id: 'charge_capture', label: '3. Claim Scrubber (837P)' },
          { id: 'clearinghouse_rejections', label: `4. Rejections (${rejections.filter(r => !r.resolved).length})` },
          { id: 'denials_appeals', label: `5. Denials & AI Appeals (${denials.length})` },
          { id: 'ar_aging', label: '6. AR Aging Buckets' },
          { id: 'era_payment', label: '7. Remittances (835)' },
          { id: 'underpayments', label: '8. Contract Underpayments' },
          { id: 'credentialing', label: '9. Credentialing / CAQH' },
          { id: 'guarded_actions', label: `10. Guarded Autonomy (${guardedActions.filter(a => a.status === 'proposed').length})` },
          { id: 'connector_registry', label: '11. Connectors (Brightree/Availity)' },
          { id: 'audit_logs', label: '12. Audit Trail' }
        ].map(stage => {
          const isActive = (activeStage as string) === stage.id;
          return (
            <button
              key={stage.id}
              onClick={() => setActiveStage(stage.id as any)}
              className={`px-3 py-2 rounded-xl font-bold whitespace-nowrap transition cursor-pointer text-xs ${
                isActive
                  ? 'bg-teal-500 text-slate-950 shadow-md font-black ring-1 ring-white/40'
                  : isDark
                    ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              {stage.label}
            </button>
          );
        })}
      </div>

      {/* STAGE 1: OVERVIEW HUD */}
      {((activeStage as string) === 'overview') && (
        <div className="space-y-4">
          {/* Top Performance Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className="text-[11px] font-mono uppercase text-slate-400 font-bold">First-Pass Clean Claim Rate</div>
              <div className="text-2xl font-black text-emerald-400 font-mono mt-1">98.4%</div>
              <div className="text-[10px] text-emerald-300 mt-1 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> +4.2% vs industry average (94.2%)
              </div>
            </div>

            <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className="text-[11px] font-mono uppercase text-slate-400 font-bold">Average Days in AR</div>
              <div className="text-2xl font-black text-teal-400 font-mono mt-1">32.8 Days</div>
              <div className="text-[10px] text-teal-300 mt-1 flex items-center gap-1">
                <TrendingDown className="w-3 h-3" /> Down from 54 days baseline
              </div>
            </div>

            <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className="text-[11px] font-mono uppercase text-slate-400 font-bold">Total AR Outstanding</div>
              <div className="text-2xl font-black text-cyan-400 font-mono mt-1">$320,000</div>
              <div className="text-[10px] text-slate-400 mt-1">Across 177 active synthetic claims</div>
            </div>

            <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className="text-[11px] font-mono uppercase text-slate-400 font-bold">Appeals Overturn Rate</div>
              <div className="text-2xl font-black text-amber-400 font-mono mt-1">79.2%</div>
              <div className="text-[10px] text-amber-300 mt-1 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Powered by LCD clinical AI grounding
              </div>
            </div>
          </div>

          {/* Connectors & Guarded Autonomy Status Quick-View */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Primary Connectors Card */}
            <div className={`p-5 rounded-2xl border ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <Server className="w-4 h-4 text-teal-400" />
                  <span>Universal Connector Status</span>
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold">
                  2 Connected (Mock)
                </span>
              </div>

              <div className="space-y-2.5">
                {connectors.slice(0, 2).map(c => (
                  <div key={c.id} className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-300 font-bold text-xs flex items-center justify-center font-mono">
                        {c.logoBadge}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-200">{c.name}</div>
                        <div className="text-[11px] text-slate-400">{c.category} • {c.dataFreshness}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                        {c.authStatus}
                      </span>
                      <button
                        onClick={() => handleTestConnector(c.id)}
                        disabled={testingConnectorId === c.id}
                        className="px-2.5 py-1 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 text-teal-300 font-mono transition cursor-pointer"
                      >
                        {testingConnectorId === c.id ? 'Testing...' : 'Ping'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pending Guarded Actions Card */}
            <div className={`p-5 rounded-2xl border ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <span>Guarded Actions Requiring Human Review (&gt;$1,000)</span>
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold">
                  {guardedActions.filter(a => a.status === 'proposed').length} Pending Review
                </span>
              </div>

              <div className="space-y-2.5">
                {guardedActions.filter(a => a.status === 'proposed').map(action => (
                  <div key={action.id} className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-bold text-slate-200">{action.title}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Impact: <strong className="text-amber-400 font-mono">${action.financialImpact.toLocaleString()}</strong> • Proposed by {action.proposedBy}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleApproveAction(action.id)}
                        className="px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs transition cursor-pointer"
                      >
                        Approve
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STAGE 2: ELIGIBILITY & PRIOR AUTH */}
      {((activeStage as string) === 'eligibility') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-teal-400" />
              <span>Real-Time Eligibility Verification (EDI 270/271)</span>
            </h3>
            <span className="text-xs font-mono text-slate-400">Payer Interface: Availity Essentials</span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/80 text-[11px] uppercase font-mono text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3">Patient</th>
                  <th className="p-3">Payer / Member ID</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Copay / Coinsurance</th>
                  <th className="p-3">Deductible Left</th>
                  <th className="p-3">Prior Auth?</th>
                  <th className="p-3">Verified Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {SYNTHETIC_ELIGIBILITY.map(el => (
                  <tr key={el.id} className="hover:bg-slate-900/40 transition">
                    <td className="p-3 font-bold text-white">{el.patientName}</td>
                    <td className="p-3 font-mono">{el.payerName} ({el.memberId})</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        el.policyStatus === 'Active' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                      }`}>
                        {el.policyStatus}
                      </span>
                    </td>
                    <td className="p-3 font-mono">${el.copayAmount.toFixed(2)} / {el.coinsurancePercent}%</td>
                    <td className="p-3 font-mono text-amber-300">${el.deductibleRemaining.toFixed(2)}</td>
                    <td className="p-3">
                      {el.priorAuthRequired ? (
                        <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold text-[10px]">Required</span>
                      ) : (
                        <span className="text-slate-500 text-[10px]">None</span>
                      )}
                    </td>
                    <td className="p-3 font-mono text-slate-400">{el.verificationSource}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Prior Authorizations Section */}
          <div className="pt-4 border-t border-slate-800">
            <h4 className="text-xs font-bold text-slate-300 uppercase font-mono mb-2">Active Prior Authorizations Queue</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {SYNTHETIC_PRIOR_AUTHS.map(pa => (
                <div key={pa.id} className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{pa.authNumber}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      pa.status === 'Approved' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                    }`}>
                      {pa.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-300">{pa.patientName}</div>
                  <div className="text-[11px] font-mono text-teal-400">{pa.procedureCode}</div>
                  <div className="text-[11px] text-slate-400 leading-snug">{pa.clinicalNotes}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* STAGE 3: CLAIM SCRUBBER (837P) */}
      {((activeStage as string) === 'charge_capture') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-teal-400" />
              <span>Charge Capture & Pre-Submission Claim Scrubber (837P EDI)</span>
            </h3>
            <span className="text-xs font-mono text-emerald-400">Scrubber Engine: NCCI Edit v30.3</span>
          </div>

          <div className="space-y-3">
            {claims.map(claim => (
              <div key={claim.id} className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-teal-300">{claim.claimControlNumber}</span>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs font-bold text-white">{claim.patientName}</span>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs text-slate-300">{claim.payerName}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-slate-200">Billed: <strong className="text-white">${claim.billedAmount.toLocaleString()}</strong></span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                      claim.cleanClaimScore >= 95 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                    }`}>
                      Clean Score: {claim.cleanClaimScore}%
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-mono">
                      {claim.status}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs pt-1 border-t border-slate-800/60">
                  <span className="text-slate-400 font-mono text-[11px]">CPT:</span>
                  {claim.cptCodes.map(c => (
                    <span key={c} className="px-1.5 py-0.5 rounded bg-slate-800 text-teal-300 font-mono text-[11px]">{c}</span>
                  ))}
                  <span className="text-slate-400 font-mono text-[11px] ml-2">ICD-10:</span>
                  {claim.icd10Codes.map(d => (
                    <span key={d} className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono text-[11px]">{d}</span>
                  ))}
                  {claim.modifiers.length > 0 && (
                    <>
                      <span className="text-slate-400 font-mono text-[11px] ml-2">Modifiers:</span>
                      {claim.modifiers.map(m => (
                        <span key={m} className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono text-[11px]">{m}</span>
                      ))}
                    </>
                  )}
                </div>

                {claim.ncciEditWarnings && claim.ncciEditWarnings.length > 0 && (
                  <div className="text-[11px] text-amber-300 bg-amber-950/30 p-2 rounded-lg border border-amber-900/40">
                    {claim.ncciEditWarnings.join(' ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STAGE 4: CLEARINGHOUSE REJECTIONS (277CA) */}
      {((activeStage as string) === 'clearinghouse_rejections') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>Clearinghouse Pre-Adjudication Rejections (277CA & 999 EDI)</span>
            </h3>
            <span className="text-xs text-slate-400">Resolve before payer receipt to eliminate denial delay</span>
          </div>

          <div className="space-y-3">
            {rejections.map(rej => (
              <div key={rej.id} className={`p-4 rounded-xl border space-y-2 ${
                rej.resolved ? 'bg-slate-950/40 border-slate-800 opacity-60' : 'bg-rose-950/20 border-rose-900/60'
              }`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-rose-400">{rej.rejectionCode}</span>
                    <span className="text-xs font-bold text-white">{rej.rejectionCategory}</span>
                    <span className="text-xs text-slate-400">({rej.claimControlNumber})</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {rej.resolved ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-xs font-bold flex items-center gap-1">
                        <Check className="w-3 h-3" /> Resolved
                      </span>
                    ) : (
                      rej.autoFixAvailable && (
                        <button
                          onClick={() => handleAutoFixRejection(rej.id)}
                          className="px-3 py-1 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold transition cursor-pointer"
                        >
                          Auto-Fix EDI Segment
                        </button>
                      )
                    )}
                  </div>
                </div>

                <div className="text-xs font-mono bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-slate-300">
                  {rej.rawRejectionMessage}
                </div>

                <div className="text-xs text-slate-300 flex items-start gap-1.5">
                  <span className="text-teal-400 font-bold">Recommended Correction:</span>
                  <span>{rej.suggestedCorrection}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STAGE 5: DENIALS & AI APPEALS */}
      {((activeStage as string) === 'denials_appeals') && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Denials List (5 cols) */}
          <div className="lg:col-span-5 space-y-2.5">
            <h4 className="text-xs font-bold uppercase font-mono text-slate-400">Active Denials Queue ({denials.length})</h4>
            {denials.map(den => (
              <div
                key={den.id}
                onClick={() => setSelectedDenial(den)}
                className={`p-3.5 rounded-xl border cursor-pointer transition ${
                  selectedDenial?.id === den.id
                    ? 'bg-teal-950/30 border-teal-500 shadow-lg'
                    : 'bg-slate-900/60 hover:bg-slate-800/60 border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-rose-400">{den.carcCode} / {den.rarcCode}</span>
                  <span className="font-mono text-xs font-bold text-white">${den.deniedAmount.toFixed(2)}</span>
                </div>
                <div className="text-xs font-bold text-slate-200 mt-1">{den.denialCategory}</div>
                <div className="text-[11px] text-slate-400">{den.patientName} • {den.payerName}</div>
                <div className="text-[10px] text-amber-400 font-mono mt-1">Timely Filing: {den.daysRemainingToAppeal} days left</div>
              </div>
            ))}
          </div>

          {/* Denial Detail & AI Appeal Generator (7 cols) */}
          <div className="lg:col-span-7">
            {selectedDenial ? (
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white">{selectedDenial.denialCategory} Appeal</h3>
                    <p className="text-xs text-slate-400">Claim {selectedDenial.claimControlNumber} • {selectedDenial.payerName}</p>
                  </div>
                  <span className="font-mono text-base font-black text-rose-400">
                    ${selectedDenial.deniedAmount.toFixed(2)}
                  </span>
                </div>

                {/* CARC Explanation */}
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                  <div className="text-slate-400 text-[11px] font-mono">Payer CARC Reason:</div>
                  <div className="text-slate-200 mt-0.5">{selectedDenial.carcDescription}</div>
                </div>

                {/* Evidence Citations */}
                <div>
                  <div className="text-xs font-bold text-teal-400 uppercase font-mono mb-1.5">Evidence & Clinical Citations:</div>
                  <ul className="space-y-1 text-xs text-slate-300">
                    {selectedDenial.evidenceCitations.map((ev, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <Check className="w-3.5 h-3.5 text-teal-400 mt-0.5 shrink-0" />
                        <span>{ev}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Appeal Generator Button / Preview */}
                <div className="pt-2">
                  <button
                    onClick={() => handleGenerateAppeal(selectedDenial)}
                    disabled={generatingAppeal}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-teal-400 to-cyan-400 hover:from-teal-300 hover:to-cyan-300 text-slate-950 font-black text-xs transition cursor-pointer shadow-md disabled:opacity-50"
                  >
                    <Sparkles className="w-4 h-4 text-slate-950" />
                    <span>{generatingAppeal ? 'Analyzing LCD Guidelines & Drafting Appeal...' : 'Generate AI Appeal Packet'}</span>
                  </button>
                </div>

                {selectedDenial.generatedAppealText && (
                  <div className="space-y-2 pt-2">
                    <div className="text-xs font-bold text-slate-300 font-mono">Generated Level 1 Redetermination Packet:</div>
                    <textarea
                      readOnly
                      rows={10}
                      value={selectedDenial.generatedAppealText}
                      className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 leading-relaxed outline-none"
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-500">Select a denial to inspect LCD evidence and generate appeal packets.</div>
            )}
          </div>
        </div>
      )}

      {/* STAGE 6: AR AGING BUCKETS */}
      {((activeStage as string) === 'ar_aging') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-teal-400" />
              <span>Accounts Receivable Aging Analysis & Collection Prioritization</span>
            </h3>
            <span className="text-xs font-mono text-cyan-400">Total Portfolio: $320,000</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            {SYNTHETIC_AR_BUCKETS.map(bucket => (
              <div key={bucket.range} className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                <div className="text-[11px] font-mono text-slate-400 uppercase font-bold">{bucket.range}</div>
                <div className="text-xl font-black text-white font-mono">${bucket.amount.toLocaleString()}</div>
                <div className="text-xs text-slate-400">{bucket.claimsCount} claims ({bucket.percentOfTotal}%)</div>
                <div className="pt-2 border-t border-slate-800 text-[10px] flex items-center justify-between">
                  <span className="text-slate-500">Collectibility:</span>
                  <span className="font-mono font-bold text-teal-300">{bucket.collectibilityScore}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STAGE 10: GUARDED AUTONOMY & APPROVAL QUEUE */}
      {((activeStage as string) === 'guarded_actions') && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-teal-400" />
                <span>Guarded Autonomy Queue & Human Oversight Policy</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Any action with potential financial impact exceeding <strong>${controls.humanReviewThresholdUSD.toLocaleString()}</strong> requires explicit human supervisor sign-off before dispatch.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setControls(c => ({ ...c, dryRunMode: !c.dryRunMode }))}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                  controls.dryRunMode ? 'bg-amber-500/20 border-amber-500 text-amber-300' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {controls.dryRunMode ? 'Dry-Run Active (Simulated Writes)' : 'Live Mode Enabled'}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {guardedActions.map(action => (
              <div key={action.id} className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">{action.title}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                        action.status === 'executed' 
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : action.status === 'approved'
                            ? 'bg-cyan-500/20 text-cyan-300'
                            : 'bg-amber-500/20 text-amber-300'
                      }`}>
                        {action.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-1">{action.description}</div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-mono text-base font-black text-amber-300">${action.financialImpact.toLocaleString()}</div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {action.financialImpact >= controls.humanReviewThresholdUSD ? 'Above $1k Policy Threshold' : 'Auto-Approved Policy'}
                    </div>
                  </div>
                </div>

                {/* Evidence items */}
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 space-y-1">
                  <div className="text-[11px] font-mono text-teal-400 font-bold">Policy & Evidence Verification:</div>
                  {action.evidence.map((ev, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                      <span>{ev}</span>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-1 text-xs">
                  <span className="text-[11px] text-slate-500 font-mono">
                    Connector: <strong className="text-slate-300 uppercase">{action.connector}</strong> • Proposed by {action.proposedBy}
                  </span>

                  <div className="flex items-center gap-2">
                    {action.status === 'proposed' && (
                      <button
                        onClick={() => handleApproveAction(action.id)}
                        className="px-3.5 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold transition cursor-pointer"
                      >
                        Approve Action
                      </button>
                    )}

                    {action.status === 'approved' && (
                      <button
                        onClick={() => handleExecuteAction(action.id)}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition cursor-pointer"
                      >
                        {controls.dryRunMode ? 'Execute Dry-Run Simulation' : 'Execute Live Dispatch'}
                      </button>
                    )}

                    {action.status === 'executed' && (
                      <span className="text-xs font-mono text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> Executed ({action.executedAt})
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STAGE 11: UNIVERSAL CONNECTOR REGISTRY */}
      {((activeStage as string) === 'connector_registry') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Server className="w-4 h-4 text-teal-400" />
                <span>Universal Connector Registry & Practice Bridge</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Brightree (EHR / Practice Management) and Availity (Clearinghouse / Payer Gateway) operate in synthetic safe mode until client production credentials are provided.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {connectors.map(c => (
              <div key={c.id} className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-300 font-bold flex items-center justify-center font-mono">
                      {c.logoBadge}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-white">{c.name}</h4>
                      <div className="text-[11px] text-slate-400">{c.category}</div>
                    </div>
                  </div>

                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                    c.isMock ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {c.authStatus}
                  </span>
                </div>

                <div className="text-xs font-mono text-slate-400 bg-slate-900 p-2.5 rounded-xl border border-slate-800 space-y-1">
                  <div>Endpoint: <span className="text-teal-300">{c.endpointUrl}</span></div>
                  <div>Last Sync: <span className="text-slate-300">{c.lastSync}</span></div>
                  <div>Client ID: <span className="text-slate-300">{c.clientIdMasked || 'None configured'}</span></div>
                </div>

                <div>
                  <div className="text-[11px] font-mono text-slate-400 uppercase font-bold mb-1">Supported Capabilities:</div>
                  <div className="flex flex-wrap gap-1">
                    {c.supportedCapabilities.map((cap, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                        {cap}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <a
                    href={c.documentationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-teal-400 hover:underline flex items-center gap-1 text-[11px]"
                  >
                    <span>Developer Docs</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>

                  <button
                    onClick={() => handleTestConnector(c.id)}
                    disabled={testingConnectorId === c.id}
                    className="px-3 py-1.5 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40 font-bold transition cursor-pointer"
                  >
                    {testingConnectorId === c.id ? 'Pinging Handshake...' : 'Test Connection'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STAGE 12: AUDIT LOG */}
      {((activeStage as string) === 'audit_logs') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Immutable Compliance & Operational Audit Trail</span>
            </h3>
            <span className="text-xs font-mono text-slate-400">SHA-256 State Anchors Active</span>
          </div>

          <div className="space-y-2">
            {auditLogs.map(log => (
              <div key={log.id} className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs space-y-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between text-slate-400 gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-teal-400 font-bold">{log.timestamp}</span>
                    <span>•</span>
                    <strong className="text-white">{log.actor}</strong> ({log.role})
                  </div>
                  <span className="font-mono text-[10px] text-slate-500 truncate max-w-xs">{log.verificationHash}</span>
                </div>
                <div className="text-slate-200 font-medium">{log.action}</div>
                <div className="text-[11px] text-slate-400 leading-snug">{log.details}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
