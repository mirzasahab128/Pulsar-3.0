import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  Search, 
  Sparkles, 
  Send, 
  ShieldCheck, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  RefreshCw, 
  Users, 
  Sliders, 
  ExternalLink, 
  Trash2, 
  UserCheck, 
  MessageSquare,
  Bot, 
  ChevronRight,
  Filter,
  Flame,
  Check,
  Zap,
  PhoneCall,
  Info,
  X,
  UserPlus,
  Download,
  Webhook,
  Settings2
} from 'lucide-react';
import { 
  LinkedInConnectedAccount, 
  LinkedInQueueItem, 
  LinkedInSearchCriteria, 
  LinkedInOutreachTemplate,
  LinkedInProspect,
  RCMLead,
  ManagerSettings
} from '../types';
import { apiService } from '../services/api';
import { resolveTemplateVariables } from './LinkedInOutreachTemplateManager';
import { exportLinkedInQueueToCSV } from '../utils/linkedinCsvExport';
import { useTheme } from '../context/ThemeContext';

interface LinkedInOutreachAutomatorProps {
  connectedAccount: LinkedInConnectedAccount;
  onUpdateAccount: (account: LinkedInConnectedAccount) => void;
  templates: LinkedInOutreachTemplate[];
  rotationEnabled: boolean;
  queue: LinkedInQueueItem[];
  onUpdateQueue: (queue: LinkedInQueueItem[]) => void;
  onDialProspect?: (lead: RCMLead) => void;
  isProcessing?: boolean;
  onProcessingChange?: (isProcessing: boolean) => void;
  onOpenSettings?: () => void;
}

const NICHE_SPECIALTIES = [
  'Cardiology & Vascular Surgery',
  'Orthopedic Surgery & Sports Medicine',
  'Multispecialty Clinics & ASC',
  'Independent Pathology & CLIA Labs',
  'Pediatrics & Primary Care',
  'Dermatology & Mohs Surgery',
  'Hospital & Critical Access Facilities',
  'Ophthalmology & Eye Surgery'
];

const TARGET_ROLES = [
  'Practice Administrator / Executive Director',
  'Chief Medical Officer (CMO)',
  'Managing Partner & Physician Owner',
  'Director of Revenue Cycle Management (RCM)',
  'Chief Financial Officer (CFO)'
];

const PRACTICE_SIZES = [
  '1-3 Providers (Solo & Small Groups)',
  '4-10 Providers (Mid-Size Specialty Clinics)',
  '10+ Providers (Large Healthcare Organizations)',
  'Ambulatory Surgical Centers (ASC)',
  'Hospital Health System Network'
];

export const LinkedInOutreachAutomator: React.FC<LinkedInOutreachAutomatorProps> = ({
  connectedAccount,
  onUpdateAccount,
  templates,
  rotationEnabled,
  queue,
  onUpdateQueue,
  onDialProspect,
  isProcessing: externalIsProcessing,
  onProcessingChange,
  onOpenSettings
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Search Criteria State
  const [criteria, setCriteria] = useState<LinkedInSearchCriteria>({
    nicheSpecialty: 'Cardiology & Vascular Surgery',
    targetRole: 'Practice Administrator / Executive Director',
    targetLocation: 'Texas & Nationwide',
    practiceSize: '4-10 Providers (Mid-Size Specialty Clinics)',
    dailyLimit: connectedAccount.dailyLimit || 50,
    enableSmartFiltering: true
  });

  // CRM Integration State
  const [autoSyncCrmEnabled, setAutoSyncCrmEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('pulsercm_linkedin_crm_autosync');
    return saved !== null ? saved === 'true' : true;
  });
  const [lastCrmSyncStatus, setLastCrmSyncStatus] = useState<string | null>(null);

  const [isDiscovering, setIsDiscovering] = useState<boolean>(false);
  const [isAutomatorRunning, setIsAutomatorRunning] = useState<boolean>(false);
  const [activeDispatchItem, setActiveDispatchItem] = useState<string | null>(null);
  const [filterReasonModal, setFilterReasonModal] = useState<LinkedInQueueItem | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [queueFilter, setQueueFilter] = useState<'all' | 'approved' | 'sent' | 'rejected'>('all');

  // Sync processing state upwards whenever activeDispatchItem or isAutomatorRunning changes
  useEffect(() => {
    const active = !!activeDispatchItem || (isAutomatorRunning && queue.some(q => q.status === 'approved' || q.status === 'queued'));
    onProcessingChange?.(active);
  }, [activeDispatchItem, isAutomatorRunning, queue, onProcessingChange]);

  // Rotation tracker
  const templateRotationIdxRef = useRef<number>(0);
  const timerRef = useRef<any>(null);

  // Pick next active template using rotation
  const getNextTemplate = (): LinkedInOutreachTemplate => {
    const activeList = templates.filter(t => t.active);
    if (activeList.length === 0) return templates[0];
    if (!rotationEnabled) return activeList[0];

    const chosen = activeList[templateRotationIdxRef.current % activeList.length];
    templateRotationIdxRef.current = (templateRotationIdxRef.current + 1) % activeList.length;
    return chosen;
  };

  // Step 1: Find niche people and analyze with Gemini Smart Filtering
  const handleFindAndQueue = async () => {
    setIsDiscovering(true);
    setStatusNotice(`Scanning LinkedIn for medical decision-makers in "${criteria.nicheSpecialty}"...`);
    try {
      const results = await apiService.searchLinkedIn({
        targetRole: criteria.targetRole,
        industry: criteria.nicheSpecialty,
        state: criteria.targetLocation
      });

      const existingIds = new Set(queue.map(q => q.prospect.id));
      const newProspects = results.filter(p => !existingIds.has(p.id));

      if (newProspects.length === 0) {
        setStatusNotice('No new prospects found with current filters. Broadening search parameters...');
        setIsDiscovering(false);
        return;
      }

      setStatusNotice(`Found ${newProspects.length} niche prospects. Analyzing profiles with Gemini Smart Filtering...`);

      const newQueueItems: LinkedInQueueItem[] = [];

      for (let i = 0; i < newProspects.length; i++) {
        const prospect = newProspects[i];
        const template = getNextTemplate();
        const note = resolveTemplateVariables(template.body, {
          doctorName: prospect.fullName.split(',')[0],
          practiceName: prospect.practice,
          specialty: prospect.specialty || criteria.nicheSpecialty,
          location: prospect.location,
          title: prospect.headline
        });

        let smartFilterResult = undefined;
        let itemStatus: LinkedInQueueItem['status'] = 'queued';
        let filterError: string | undefined = undefined;

        if (criteria.enableSmartFiltering) {
          try {
            smartFilterResult = await apiService.smartFilterProspect({
              prospect,
              criteria: {
                nicheSpecialty: criteria.nicheSpecialty,
                targetRole: criteria.targetRole,
                targetLocation: criteria.targetLocation,
                practiceSize: criteria.practiceSize
              }
            });

            if (!smartFilterResult.isDecisionMaker) {
              itemStatus = 'rejected_by_ai';
            } else {
              itemStatus = 'approved';
            }
          } catch (e) {
            // Fail closed, not open: the old code approved the prospect here,
            // so an unreachable filter silently verified everyone. An unverified
            // prospect stays 'queued' with the failure recorded on the item.
            console.warn('Smart filter error for prospect:', e);
            itemStatus = 'queued';
            filterError = 'Verification unavailable: the smart filter could not be reached. This prospect has not been verified.';
          }
        } else {
          itemStatus = 'approved';
        }

        newQueueItems.push({
          id: `queue-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
          prospect,
          status: itemStatus,
          addedAt: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) + ' PST',
          templateId: template.id,
          templateName: template.name,
          personalizedNote: note,
          smartFilter: smartFilterResult,
          filterError
        });
      }

      const updatedQueue = [...queue, ...newQueueItems];
      onUpdateQueue(updatedQueue);

      const approvedCount = newQueueItems.filter(item => item.status === 'approved').length;
      const rejectedCount = newQueueItems.filter(item => item.status === 'rejected_by_ai').length;
      const unverifiedCount = newQueueItems.filter(item => item.filterError).length;

      setStatusNotice(
        `✓ Queued ${approvedCount} verified medical decision-makers! (${rejectedCount} non-buyers filtered out${unverifiedCount > 0 ? `, ${unverifiedCount} left unverified because verification was unreachable` : ''}). Ready for throttled dispatch (50/day safe limit).`
      );
    } catch (err: any) {
      console.error('Find and queue error:', err);
      setStatusNotice('Error finding prospects. Check network or search criteria.');
    } finally {
      setIsDiscovering(false);
    }
  };

  // Step 2 (Phase 4): Assisted prepare. Pulsar prepares the target and a
  // draft server-side and opens the profile — the HUMAN sends it from
  // their own LinkedIn. There is no automated sending (blueprint:
  // founder-assisted only, to stay inside LinkedIn's terms); outcomes are
  // logged back below by the human and become the source of truth.
  const handleDispatchSingle = async (item: LinkedInQueueItem) => {
    setActiveDispatchItem(item.id);
    try {
      const res = await apiService.prepareLinkedInAssist({
        prospect: {
          fullName: item.prospect.fullName,
          practice: item.prospect.practice,
          linkedInUrl: item.prospect.linkedInUrl,
          specialty: item.prospect.specialty
        }
      });
      onUpdateQueue(queue.map(q =>
        q.id === item.id
          ? { ...q, status: 'prepared' as const, assistId: res.assist.id }
          : q
      ));
      if (res.openInLinkedIn) {
        window.open(res.openInLinkedIn, '_blank', 'noopener');
      }
      setStatusNotice(
        `Prepared for ${item.prospect.fullName}: ${res.openInLinkedIn ? 'profile opened in LinkedIn' : 'open the profile from the queue'} with a ${res.assist.draftSource} draft — send it yourself there, then log the outcome below. Pulsar never sends LinkedIn invites automatically.`
      );
    } catch (e: any) {
      setStatusNotice(`Could not prepare — ${e?.message || 'server error'}. Nothing was sent.`);
    } finally {
      setActiveDispatchItem(null);
    }
  };

  // Phase 4: the human logs what actually happened after preparing.
  const handleLogOutcome = async (item: LinkedInQueueItem, outcome: 'sent_manually' | 'accepted' | 'replied' | 'declined' | 'no_response') => {
    if (!item.assistId) {
      setStatusNotice('Prepare this prospect first — outcomes are logged against a prepared assist.');
      return;
    }
    try {
      await apiService.logLinkedInOutcome(item.assistId, outcome);
      const statusMap: Partial<Record<typeof outcome, LinkedInQueueItem['status']>> = {
        sent_manually: 'sent',
        accepted: 'accepted',
        replied: 'replied'
      };
      if (statusMap[outcome]) {
        onUpdateQueue(queue.map(q => q.id === item.id
          ? { ...q, status: statusMap[outcome]!, sentAt: outcome === 'sent_manually' ? new Date().toLocaleDateString('en-US') : q.sentAt }
          : q));
      }
      setStatusNotice(`Outcome logged for ${item.prospect.fullName}: ${outcome.replace('_', ' ')}.`);
    } catch (e: any) {
      setStatusNotice(`Could not log outcome — ${e?.message || 'server error'}.`);
    }
  };

  // Step 3: Throttled Automation Runner
  useEffect(() => {
    if (!isAutomatorRunning) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const runNextInQueue = async () => {
      // Find first approved/queued item
      const nextItem = queue.find(q => q.status === 'approved' || q.status === 'queued');
      if (!nextItem) {
        setStatusNotice('All eligible prospects in queue have been processed. Click "Find & AI-Verify" to discover more niche accounts.');
        setIsAutomatorRunning(false);
        return;
      }

      // Phase 4: the assisted flow is human-paced — prepare ONE prospect,
      // then stop. The human sends it in LinkedIn before preparing the next.
      await handleDispatchSingle(nextItem);
      setIsAutomatorRunning(false);
    };

    // Run first step, then schedule next with randomized human-like delay (3.5s - 6s for demo pacing)
    timerRef.current = setInterval(runNextInQueue, 4500);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isAutomatorRunning, queue, connectedAccount]);

  const handleRemoveQueueItem = (id: string) => {
    onUpdateQueue(queue.filter(q => q.id !== id));
  };

  const handleClearAllQueue = () => {
    onUpdateQueue([]);
  };

  const handleUpdateDailyLimit = (val: number) => {
    const clamped = Math.max(1, Math.min(100, val));
    setCriteria((prev: LinkedInSearchCriteria) => ({ ...prev, dailyLimit: clamped }));
    onUpdateAccount({ ...connectedAccount, dailyLimit: clamped });
  };

  // Filtered queue items
  const filteredQueue = queue.filter(item => {
    if (queueFilter === 'approved') return item.status === 'approved' || item.status === 'queued';
    if (queueFilter === 'sent') return item.status === 'sent' || item.status === 'accepted';
    if (queueFilter === 'rejected') return item.status === 'rejected_by_ai';
    return true;
  });

  const queuedCount = queue.filter(q => q.status === 'approved' || q.status === 'queued').length;
  const sentCount = queue.filter(q => q.status === 'sent' || q.status === 'accepted').length;
  const rejectedCount = queue.filter(q => q.status === 'rejected_by_ai').length;

  return (
    <div className="space-y-6">
      {/* Top Banner: Connected Account & Daily Throttle Status */}
      <div className={`p-4 sm:p-6 rounded-3xl border transition-all duration-300 space-y-4 backdrop-blur-2xl ${
        isDark 
          ? 'glass-panel bg-gradient-to-r from-slate-950/90 via-blue-950/40 to-slate-950/90 border-white/10 shadow-2xl' 
          : 'bg-white border-slate-200/90 shadow-[0_12px_40px_-10px_rgba(15,23,42,0.06)]'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-600 dark:text-blue-300 text-xs font-semibold uppercase tracking-wider mb-2">
              <Zap className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
              Automated Niche Connection Engine • 50 Accounts / Day Safe Quota
            </div>
            <h2 className={`text-xl sm:text-2xl font-black tracking-tight flex items-center gap-3 font-display ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}>
              <span>{connectedAccount.accountName}</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 font-mono font-medium border border-emerald-500/30">
                Connected & Active
              </span>
            </h2>
            <p className={`text-xs mt-1 max-w-2xl ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Finds targeted medical decision-makers in your niche, verifies their buying authority via Gemini AI Smart Filtering, and safely sends personalized connection requests throttled to around 50 accounts a day.
            </p>
          </div>

          {/* Daily Quota Counter & Controls */}
          <div className={`flex items-center gap-3 p-3 rounded-2xl border transition-colors ${
            isDark ? 'bg-slate-950/80 border-white/10 shadow-inner' : 'bg-slate-50 border-slate-200 shadow-sm'
          }`}>
            <div className="text-right">
              <div className={`text-[10px] uppercase tracking-wider font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Today's Dispatch Quota
              </div>
              <div className={`font-mono text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                <span className="text-cyan-500 dark:text-cyan-400">{connectedAccount.requestsSentToday}</span>
                <span className={`text-base ${isDark ? 'text-slate-500' : 'text-slate-400'}`}> / {connectedAccount.dailyLimit}</span>
              </div>
            </div>

            <div className={`flex items-center gap-1.5 pl-2 border-l ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              {isAutomatorRunning ? (
                <button
                  onClick={() => setIsAutomatorRunning(false)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black shadow-lg shadow-blue-600/25 transition cursor-pointer"
                >
                  <Pause className="w-4 h-4" />
                  <span>Pause Automator</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    if (queuedCount === 0) {
                      handleFindAndQueue();
                    }
                    setIsAutomatorRunning(true);
                  }}
                  disabled={connectedAccount.requestsSentToday >= connectedAccount.dailyLimit}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-xs font-black shadow-lg shadow-emerald-500/25 transition cursor-pointer disabled:opacity-50"
                >
                  <Play className="w-4 h-4 fill-slate-950" />
                  <span>{queuedCount > 0 ? 'Run 50/Day Queue' : 'Start Auto-Pilot'}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Status notification banner */}
        {statusNotice && (
          <div className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2 animate-fadeIn ${
            isDark ? 'bg-blue-950/60 border-blue-500/30 text-blue-200' : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}>
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-cyan-500 dark:text-cyan-400 shrink-0" />
              <span>{statusNotice}</span>
            </div>
            <button onClick={() => setStatusNotice(null)} className={`text-xs p-1 ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}>
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Configuration & Search Panel */}
      <div className={`p-4 sm:p-6 rounded-3xl border transition-all duration-300 space-y-5 backdrop-blur-2xl ${
        isDark ? 'glass-panel border-white/10 shadow-2xl' : 'bg-white border-slate-200/90 shadow-[0_12px_40px_-10px_rgba(15,23,42,0.06)]'
      }`}>
        <div className={`flex items-center justify-between border-b pb-3 flex-wrap gap-2 ${
          isDark ? 'border-white/10' : 'border-slate-200'
        }`}>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className={`text-sm font-bold uppercase tracking-wider font-display ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}>
                Niche Prospecting Criteria & Smart Filtering
              </h3>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Define the specialty niche and medical leadership roles to target.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${
              isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'
            }`}>
              <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Daily Limit:</span>
              <input
                type="number"
                min={1}
                max={100}
                value={criteria.dailyLimit}
                onChange={(e) => handleUpdateDailyLimit(parseInt(e.target.value, 10) || 50)}
                className={`w-14 border rounded px-2 py-0.5 text-center text-xs font-mono font-bold focus:outline-none focus:border-cyan-500 ${
                  isDark 
                    ? 'bg-slate-900 border-slate-700 text-cyan-300' 
                    : 'bg-white border-slate-300 text-cyan-800'
                }`}
              />
              <span className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>/day</span>
            </div>

            <button
              onClick={handleFindAndQueue}
              disabled={isDiscovering}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition cursor-pointer disabled:opacity-50"
            >
              <Search className={`w-4 h-4 ${isDiscovering ? 'animate-spin' : ''}`} />
              <span>{isDiscovering ? 'Analyzing with Gemini...' : 'Find & AI-Verify Niche People'}</span>
            </button>
          </div>
        </div>

        {/* Input Controls Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className={`text-xs font-semibold block mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              1. Target Niche Specialty:
            </label>
            <select
              value={criteria.nicheSpecialty}
              onChange={(e) => setCriteria({ ...criteria, nicheSpecialty: e.target.value })}
              className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-cyan-500 cursor-pointer ${
                isDark 
                  ? 'bg-slate-950 border-slate-700 text-slate-200' 
                  : 'bg-white border-slate-300 text-slate-800 shadow-sm'
              }`}
            >
              {NICHE_SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className={`text-xs font-semibold block mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              2. Medical Decision-Maker Role:
            </label>
            <select
              value={criteria.targetRole}
              onChange={(e) => setCriteria({ ...criteria, targetRole: e.target.value })}
              className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-cyan-500 cursor-pointer ${
                isDark 
                  ? 'bg-slate-950 border-slate-700 text-slate-200' 
                  : 'bg-white border-slate-300 text-slate-800 shadow-sm'
              }`}
            >
              {TARGET_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div>
            <label className={`text-xs font-semibold block mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              3. Target Geographic Region:
            </label>
            <input
              type="text"
              value={criteria.targetLocation}
              onChange={(e) => setCriteria({ ...criteria, targetLocation: e.target.value })}
              placeholder="e.g. Texas, Florida, California"
              className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-cyan-500 ${
                isDark 
                  ? 'bg-slate-950 border-slate-700 text-slate-200' 
                  : 'bg-white border-slate-300 text-slate-800 shadow-sm'
              }`}
            />
          </div>

          <div>
            <label className={`text-xs font-semibold block mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              4. Practice Size / Organization:
            </label>
            <select
              value={criteria.practiceSize}
              onChange={(e) => setCriteria({ ...criteria, practiceSize: e.target.value })}
              className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-cyan-500 cursor-pointer ${
                isDark 
                  ? 'bg-slate-950 border-slate-700 text-slate-200' 
                  : 'bg-white border-slate-300 text-slate-800 shadow-sm'
              }`}
            >
              {PRACTICE_SIZES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        {/* Gemini Smart Filtering Feature Toggle */}
        <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-950/40 via-emerald-950/20 to-slate-950 border border-blue-500/30 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-2">
                <span>Gemini Smart Filtering & Authority Verification</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono border border-emerald-500/30">
                  AI Evaluator
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Uses Gemini to evaluate prospect headlines, clinical specialty, and seniority to ensure they hold vendor purchasing authority before using daily quota.
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={criteria.enableSmartFiltering}
              onChange={(e) => setCriteria({ ...criteria, enableSmartFiltering: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            <span className="ml-2 text-xs font-semibold text-slate-300">
              {criteria.enableSmartFiltering ? 'Enabled' : 'Disabled'}
            </span>
          </label>
        </div>

        {/* CRM Integration & Webhook Auto-Sync Toggle Banner */}
        <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-950/40 via-teal-950/20 to-slate-950 border border-emerald-500/30 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Webhook className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-2">
                <span>Third-Party CRM Webhook Auto-Sync</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono border border-emerald-500/30">
                  Salesforce • HubSpot • Apollo
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Automatically push successful connection requests and acceptance events directly to your external CRM via webhook endpoints.
              </p>
              {lastCrmSyncStatus && (
                <div className="text-[10px] text-emerald-300 font-mono mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>{lastCrmSyncStatus}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-teal-300 border border-teal-500/30 text-xs font-semibold transition cursor-pointer"
                title="Configure CRM webhook URL and credentials in Settings"
              >
                <Settings2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Webhook Settings</span>
              </button>
            )}

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoSyncCrmEnabled}
                onChange={(e) => {
                  const val = e.target.checked;
                  setAutoSyncCrmEnabled(val);
                  localStorage.setItem('pulsercm_linkedin_crm_autosync', val ? 'true' : 'false');
                }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              <span className="ml-2 text-xs font-semibold text-slate-300">
                {autoSyncCrmEnabled ? 'Auto-Sync On' : 'Off'}
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Queue State Manager & Outbound Pipeline */}
      <div className={`p-4 sm:p-6 rounded-3xl border transition-all duration-300 space-y-4 backdrop-blur-2xl ${
        isDark ? 'glass-panel border-white/10 shadow-2xl' : 'bg-white border-slate-200/90 shadow-[0_12px_40px_-10px_rgba(15,23,42,0.06)]'
      }`}>
        {/* Queue Header & Filters */}
        <div className={`flex items-center justify-between pb-3 border-b flex-wrap gap-3 ${
          isDark ? 'border-white/10' : 'border-slate-200'
        }`}>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-500 dark:text-blue-400 border border-blue-500/30">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className={`text-sm font-bold uppercase tracking-wider flex items-center gap-2 font-display ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}>
                <span>Outbound Dispatch Queue & State Manager</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 font-mono font-semibold">
                  {queue.length} Total Accounts
                </span>
              </h3>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Paced throttled pipeline respecting the 50 accounts/day quota.
              </p>
            </div>
          </div>

          {/* Filter Pills */}
          <div className={`flex items-center gap-1.5 p-1 rounded-xl border text-xs ${
            isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'
          }`}>
            <button
              onClick={() => setQueueFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                queueFilter === 'all' 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({queue.length})
            </button>
            <button
              onClick={() => setQueueFilter('approved')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                queueFilter === 'approved' 
                  ? 'bg-cyan-600 text-white shadow-sm' 
                  : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Ready ({queuedCount})
            </button>
            <button
              onClick={() => setQueueFilter('sent')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                queueFilter === 'sent' 
                  ? 'bg-emerald-600 text-white shadow-sm' 
                  : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sent ({sentCount})
            </button>
            <button
              onClick={() => setQueueFilter('rejected')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                queueFilter === 'rejected' 
                  ? 'bg-rose-600 text-white shadow-sm' 
                  : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Filtered Non-Buyers ({rejectedCount})
            </button>
            {queue.length > 0 && (
              <button
                onClick={handleClearAllQueue}
                className="px-2 py-1 text-slate-500 hover:text-rose-400 transition cursor-pointer ml-1"
                title="Clear entire queue"
              >
                Clear
              </button>
            )}

            {/* Export Queue to CSV Button for External CRM Management */}
            <button
              onClick={() => {
                if (queue.length === 0) return;
                const result = exportLinkedInQueueToCSV(filteredQueue.length > 0 ? filteredQueue : queue, 'Pulsar_LinkedIn_CRM_Export');
                setStatusNotice(`✓ Exported ${result.count} connection statuses and profile details to ${result.filename} for external CRM management.`);
              }}
              disabled={queue.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 font-bold transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm ml-1"
              title="Export connection statuses, AI verification scores, and profile details to CSV for external CRM management"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export CSV ({filteredQueue.length})</span>
            </button>
          </div>
        </div>

        {/* Empty State */}
        {filteredQueue.length === 0 ? (
          <div className="py-14 text-center text-slate-400 bg-slate-950/40 rounded-xl border border-dashed border-slate-800">
            <Search className="w-10 h-10 text-slate-600 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-semibold text-slate-300">Queue is currently empty for this filter.</p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Click "Find & AI-Verify Niche People" above to scan LinkedIn profiles and automatically populate this queue with verified healthcare executives.
            </p>
            <button
              onClick={handleFindAndQueue}
              className="mt-4 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 text-white text-xs font-bold transition cursor-pointer shadow-md"
            >
              Find Niche Decision-Makers
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredQueue.map((item) => {
              const isApproved = item.status === 'approved' || item.status === 'queued';
              const isSent = item.status === 'sent';
              const isAccepted = item.status === 'accepted';
              const isPrepared = item.status === 'prepared';
              const isReplied = item.status === 'replied';
              const isRejected = item.status === 'rejected_by_ai';
              const isDispatching = activeDispatchItem === item.id;

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-xl border transition flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    isRejected 
                      ? 'bg-rose-950/15 border-rose-900/30 opacity-75' 
                      : isAccepted
                      ? 'bg-emerald-950/20 border-emerald-500/40 shadow-sm'
                      : isSent
                      ? 'bg-slate-900/80 border-blue-500/30'
                      : 'bg-slate-900/90 border-slate-800 hover:border-blue-500/50'
                  }`}
                >
                  {/* Left Column: Prospect Identity & Smart Filter Badge */}
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
                        <span>{item.prospect.fullName}</span>
                        <a 
                          href={item.prospect.linkedInUrl} 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-slate-400 hover:text-blue-400"
                          title="Open LinkedIn Profile"
                        >
                          <ExternalLink className="w-3.5 h-3.5 inline" />
                        </a>
                      </h4>

                      {/* Smart Filter Pill */}
                      {item.smartFilter ? (
                        <button
                          onClick={() => setFilterReasonModal(item)}
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-full border flex items-center gap-1 cursor-pointer transition ${
                            item.smartFilter.isDecisionMaker
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
                              : 'bg-rose-500/15 text-rose-300 border-rose-500/30 hover:bg-rose-500/25'
                          }`}
                          title="Click to view Gemini AI analysis reasoning"
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>{item.smartFilter.authorityLevel}</span>
                          <span className="font-bold">({typeof item.smartFilter.confidence === 'number' ? `${item.smartFilter.confidence}% Conf` : `${item.smartFilter.confidenceBand || 'unscored'} band, heuristic`})</span>
                          <Info className="w-3 h-3 ml-0.5" />
                        </button>
                      ) : item.filterError ? (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          Unverified: filter unreachable
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                          Direct Queued
                        </span>
                      )}

                      <span className="text-[10px] font-mono text-slate-500">
                        Added: {item.addedAt}
                      </span>

                      {/* Scheduled Batch Window Pill */}
                      {item.scheduledTimeSlot && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-indigo-400" />
                          <span>{item.scheduledTimeSlot} PST ({item.batchName || 'Batch'})</span>
                        </span>
                      )}

                      {/* CRM Synced Badge */}
                      {item.crmSynced && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                          <Webhook className="w-3 h-3 text-emerald-400" />
                          <span>CRM Synced {item.crmSyncedAt || ''}</span>
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-300 line-clamp-1">
                      {item.prospect.headline}
                    </p>

                    <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
                      <span className="text-slate-300 font-medium">{item.prospect.practice}</span>
                      <span>•</span>
                      <span>{item.prospect.specialty || criteria.nicheSpecialty}</span>
                      <span>•</span>
                      <span>{item.prospect.location}</span>
                    </div>

                    {/* Resolved Connection Message Preview */}
                    <div className="mt-2 p-2.5 rounded-lg bg-slate-950/70 border border-white/5 text-xs text-slate-200">
                      <div className="text-[10px] text-blue-400 font-mono flex items-center justify-between mb-1">
                        <span>Personalized Note ({item.templateName || 'Default'}):</span>
                        <span>{item.personalizedNote?.length || 0}/300 chars</span>
                      </div>
                      <p className="italic font-sans text-[11px] text-slate-300">
                        "{item.personalizedNote}"
                      </p>
                    </div>
                  </div>

                  {/* Right Column: Status & Action Buttons */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 shrink-0">
                    {/* Status Display */}
                    {isAccepted ? (
                      <span className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>Connected!</span>
                      </span>
                    ) : isReplied ? (
                      <span className="px-3 py-1.5 rounded-xl bg-violet-500/20 text-violet-300 border border-violet-500/40 text-xs font-medium flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-violet-400" />
                        <span>Replied (logged by you)</span>
                      </span>
                    ) : isSent ? (
                      <span className="px-3 py-1.5 rounded-xl bg-blue-500/20 text-blue-300 border border-blue-500/40 text-xs font-medium flex items-center gap-1.5">
                        <Send className="w-3.5 h-3.5 text-blue-400" />
                        <span>Sent — by you ({item.sentAt || 'Today'})</span>
                      </span>
                    ) : isPrepared ? (
                      <span className="flex flex-col gap-1.5">
                        <span className="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-medium flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                          <span>Prepared — send it in LinkedIn, then log:</span>
                        </span>
                        <span className="flex flex-wrap gap-1">
                          {([
                            ['sent_manually', 'Sent by me'],
                            ['accepted', 'Accepted'],
                            ['replied', 'Replied'],
                            ['declined', 'Declined'],
                            ['no_response', 'No response']
                          ] as const).map(([outcome, label]) => (
                            <button key={outcome} onClick={() => handleLogOutcome(item, outcome)}
                              className="px-2 py-1 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 text-[11px] font-semibold cursor-pointer">
                              {label}
                            </button>
                          ))}
                        </span>
                      </span>
                    ) : isRejected ? (
                      <span className="px-3 py-1.5 rounded-xl bg-rose-950/40 text-rose-300 border border-rose-800/40 text-xs font-medium flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                        <span>Filtered Out (Non-Buyer)</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => handleDispatchSingle(item)}
                        disabled={isDispatching}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-bold shadow-md shadow-blue-600/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {isDispatching ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Preparing...</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5" />
                            <span>Prepare & Open LinkedIn</span>
                          </>
                        )}
                      </button>
                    )}

                    {/* Direct Dial Action if phone exists */}
                    {onDialProspect && item.prospect.phone && (
                      <button
                        onClick={() => {
                          const lead: RCMLead = {
                            id: `li-direct-${item.prospect.id}`,
                            practiceName: item.prospect.practice,
                            doctorName: item.prospect.fullName,
                            title: item.prospect.headline,
                            specialty: item.prospect.specialty || criteria.nicheSpecialty,
                            practiceSize: 'Multi-Physician Practice',
                            phone: item.prospect.phone,
                            email: item.prospect.email,
                            address: item.prospect.location,
                            state: item.prospect.location.split(',')[1]?.trim() || 'US',
                            ehrSystem: 'AthenaHealth / Epic / eCW',
                            monthlyClaimVolume: '$500,000 / mo',
                            painPoints: ['High denial rates on complex claims', 'Days in AR lingering'],
                            linkedInProfile: item.prospect.linkedInUrl,
                            source: 'LinkedIn Automation Engine',
                            status: 'Ready for Call'
                          };
                          onDialProspect(lead);
                        }}
                        className="p-2 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/30 transition cursor-pointer"
                        title="Direct dial with AI Agent Sarah"
                      >
                        <PhoneCall className="w-4 h-4 text-teal-400" />
                      </button>
                    )}

                    {/* Remove from queue */}
                    <button
                      onClick={() => handleRemoveQueueItem(item.id)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-700 transition cursor-pointer"
                      title="Remove from queue"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Gemini AI Smart Filter Explanation Modal */}
      {filterReasonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-indigo-500/40 rounded-2xl p-6 shadow-2xl text-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Gemini Smart Filtering Analysis
                  </h3>
                  <p className="text-xs text-slate-400">
                    Evaluating decision-maker authority for {filterReasonModal.prospect.fullName}
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setFilterReasonModal(null)}
                className="text-slate-400 hover:text-white text-lg p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Target Role:</span>
                  <span className="font-semibold text-slate-200">{filterReasonModal.prospect.headline}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Medical Practice:</span>
                  <span className="font-semibold text-slate-200">{filterReasonModal.prospect.practice}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">AI Authority Verification:</span>
                  <span className={`font-bold font-mono px-2 py-0.5 rounded ${
                    filterReasonModal.smartFilter?.isDecisionMaker
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-rose-500/20 text-rose-300'
                  }`}>
                    {filterReasonModal.smartFilter?.authorityLevel}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Confidence Score:</span>
                  <span className="font-mono text-cyan-300 font-bold">{typeof filterReasonModal.smartFilter?.confidence === 'number' ? `${filterReasonModal.smartFilter.confidence}%` : `${filterReasonModal.smartFilter?.confidenceBand || 'unscored'} band (heuristic, no precise score)`}</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-500/30 space-y-1.5">
                <span className="text-indigo-300 font-bold uppercase text-[10px] tracking-wider block">
                  Gemini Evaluator Reasoning:
                </span>
                <p className="text-slate-200 leading-relaxed font-sans text-xs">
                  {filterReasonModal.smartFilter?.reasoning || 'Profile successfully analyzed against medical decision-maker criteria.'}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400">
                <span>Verified At: <strong>{filterReasonModal.smartFilter?.verifiedAt || 'Recent'}</strong></span>
                <p className="mt-1 text-slate-500">
                  Smart filtering ensures your 50/day LinkedIn connection limit is exclusively dispatched to high-intent medical decision makers.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setFilterReasonModal(null)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
