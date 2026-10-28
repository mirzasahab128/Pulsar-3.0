import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Download, 
  Stethoscope, 
  Calendar, 
  CheckSquare, 
  Sparkles, 
  ChevronRight,
  User,
  Bot,
  Copy,
  Check,
  ShieldCheck,
  Database,
  UploadCloud,
  CheckCheck,
  RefreshCw,
  ExternalLink,
  Table,
  Code,
  Layers,
  Trash2,
  Share2,
  TrendingUp,
  Activity,
  ThumbsUp,
  PhoneForwarded
} from 'lucide-react';
import { MeetingNote, ActionItem, CrmSyncRecord } from '../types';
import { speechService } from '../utils/speech';
import { useTheme } from '../context/ThemeContext';
import { calculateCallQualityScore } from '../utils/callSentimentAnalyzer';

interface MeetingNotesViewProps {
  notes: MeetingNote[];
  onToggleTask: (taskId: string) => void;
  onSelectLeadForCall?: (leadId: string) => void;
}

type CrmSystemType = 
  | 'Salesforce Health Cloud' 
  | 'HubSpot Healthcare' 
  | 'AthenaHealth PM' 
  | 'Custom REST API (JSON Log)';

interface SyncedRecordMeta {
  recordId: string;
  crmSystem: CrmSystemType;
  syncedAt: string;
}

export const MeetingNotesView: React.FC<MeetingNotesViewProps> = ({
  notes,
  onToggleTask,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [selectedNoteId, setSelectedNoteId] = useState<string>(notes[0]?.id || '');
  const [copiedNoteId, setCopiedNoteId] = useState<string | null>(null);
  const [copiedJson, setCopiedJson] = useState<boolean>(false);

  // Synced state tracking in localStorage
  const [syncedMap, setSyncedMap] = useState<Record<string, SyncedRecordMeta>>(() => {
    try {
      const saved = localStorage.getItem('pulsercm_synced_crm_records');
      return saved ? JSON.parse(saved) : {
        // Pre-seed first initial note as already synchronized to demonstrate status
        'note-1': {
          recordId: 'SF-LEAD-94812',
          crmSystem: 'Salesforce Health Cloud',
          syncedAt: 'Today, 10:18 AM PST'
        }
      };
    } catch {
      return {};
    }
  });

  // Modal states
  const [showSyncModal, setShowSyncModal] = useState<boolean>(false);
  const [targetCrm, setTargetCrm] = useState<CrmSystemType>('Salesforce Health Cloud');
  const [activeModalTab, setActiveModalTab] = useState<'overview' | 'json'>('overview');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStepText, setSyncStepText] = useState<string>('');
  
  // Mock CRM Database viewer modal
  const [showDbModal, setShowDbModal] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const activeNote = notes.find(n => n.id === selectedNoteId) || notes[0];
  const activeQuality = activeNote ? calculateCallQualityScore(activeNote) : null;

  useEffect(() => {
    try {
      localStorage.setItem('pulsercm_synced_crm_records', JSON.stringify(syncedMap));
    } catch (e) {
      console.error('Error persisting CRM sync map:', e);
    }
  }, [syncedMap]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  /**
   * Builds the structured CRM payload object for a meeting note
   */
  const buildCrmPayload = (note: MeetingNote, crmSystem: CrmSystemType) => {
    const existing = syncedMap[note.id];
    const recordId = existing?.recordId || `CRM-${note.id.toUpperCase().replace(/[^A-Z0-9]/g, '')}-${Date.now().toString().slice(-4)}`;

    return {
      schemaVersion: '2026.1-healthcare-billing',
      exportTimestamp: new Date().toISOString(),
      sourceSystem: 'Pulsar Autonomous Sales & Telephony Dispatch Bot',
      crmTarget: crmSystem,
      syncMetadata: {
        recordId,
        syncStatus: 'SUCCESS',
        environment: 'Production Mock External CRM Gateway',
        encryption: 'HIPAA AES-256 Cloud Vault'
      },
      healthcareAccount: {
        practiceName: note.practiceName,
        contactDoctorName: note.doctorName,
        qualificationStatus: note.qualificationStatus,
        qualificationScore: note.qualificationStatus === 'Hot Lead' ? 95 : note.qualificationStatus === 'Warm Opportunity' ? 80 : 50,
        currentSoftware: note.currentSoftwareAndStaffing,
        decisionMakers: note.decisionMakersIdentified,
        commercialTermsAgreed: note.commercialTermsDiscussed,
        statedBillingPainPoints: note.statedBillingPainPoints
      },
      telephonyCallActivity: {
        callDate: note.date,
        duration: note.duration,
        executiveSummary: note.executiveSummary,
        recommendedFollowUpStrategy: note.recommendedFollowUpStrategy,
        transcriptTurnCount: note.transcript?.length || 0,
        verbatimTranscriptLog: note.transcript || []
      },
      actionItemsAndTasks: note.actionItems.map((item, idx) => ({
        taskId: `TASK-${recordId}-${idx + 1}`,
        subject: item.task,
        priority: item.priority,
        category: item.category,
        dueDate: item.due,
        status: item.completed ? 'Completed' : 'Open',
        assignedTo: 'Sales & Marketing Manager',
        reminderChannel: 'Daily 4:00 PM PST Briefing & In-App Tracker'
      }))
    };
  };

  /**
   * Download a clean formatted JSON log file
   */
  const handleDownloadJsonLog = (note: MeetingNote) => {
    const payload = buildCrmPayload(note, targetCrm);
    const jsonString = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const cleanPractice = note.practiceName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    a.download = `pulsar-crm-log-${cleanPractice}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    speechService.playTelephoneRing('transfer_chime');
    showToast(`Downloaded JSON log for ${note.practiceName}`);
  };

  /**
   * Export all call records into one master JSON log
   */
  const handleDownloadAllJson = () => {
    const allPayloads = notes.map(n => buildCrmPayload(n, targetCrm));
    const masterExport = {
      exportBatchId: `BATCH-CRM-${Date.now()}`,
      exportedAt: new Date().toISOString(),
      totalRecords: notes.length,
      crmSystem: targetCrm,
      records: allPayloads
    };
    const jsonString = JSON.stringify(masterExport, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pulsar-master-crm-export-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    speechService.playTelephoneRing('transfer_chime');
    showToast(`Exported all ${notes.length} call records to master JSON log`);
  };

  /**
   * Execute simulated sync to external CRM database
   */
  const handleExecuteSync = async (note: MeetingNote) => {
    setIsSyncing(true);
    setSyncStepText(`Authenticating with ${targetCrm} OAuth endpoint...`);

    setTimeout(() => {
      setSyncStepText(`Transforming clinical transcript & ${note.actionItems.length} action items into CRM schema...`);
      
      setTimeout(() => {
        setSyncStepText(`Committing Healthcare Account & Call Activity to ${targetCrm}...`);

        setTimeout(() => {
          const newRecordId = `${targetCrm.startsWith('Salesforce') ? 'SF' : targetCrm.startsWith('HubSpot') ? 'HS' : 'CRM'}-${Date.now().toString().slice(-5)}`;
          const syncMeta: SyncedRecordMeta = {
            recordId: newRecordId,
            crmSystem: targetCrm,
            syncedAt: `Today, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} PST`
          };

          setSyncedMap(prev => ({
            ...prev,
            [note.id]: syncMeta
          }));

          setIsSyncing(false);
          setShowSyncModal(false);
          speechService.playTelephoneRing('transfer_chime');
          showToast(`Successfully synced "${note.practiceName}" to ${targetCrm} (${newRecordId})`);
        }, 800);
      }, 700);
    }, 600);
  };

  /**
   * Sync all notes in batch
   */
  const handleBatchSyncAll = async () => {
    setIsSyncing(true);
    setSyncStepText(`Batch syncing ${notes.length} records to ${targetCrm}...`);

    setTimeout(() => {
      const updated: Record<string, SyncedRecordMeta> = { ...syncedMap };
      notes.forEach((n, idx) => {
        const prefix = targetCrm.startsWith('Salesforce') ? 'SF' : targetCrm.startsWith('HubSpot') ? 'HS' : 'CRM';
        updated[n.id] = {
          recordId: `${prefix}-${Date.now().toString().slice(-4)}${idx + 1}`,
          crmSystem: targetCrm,
          syncedAt: `Today, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} PST`
        };
      });
      setSyncedMap(updated);
      setIsSyncing(false);
      speechService.playTelephoneRing('transfer_chime');
      showToast(`Batch synced all ${notes.length} records to ${targetCrm}!`);
    }, 1200);
  };

  const handleCopyMarkdown = (note: MeetingNote) => {
    const md = `# Business Meeting Notes: ${note.practiceName}
**Doctor / Decision Maker:** ${note.doctorName}
**Date:** ${note.date} | **Call Duration:** ${note.duration}
**Qualification Status:** ${note.qualificationStatus}

## Executive Summary
${note.executiveSummary}

## Stated Billing Pain Points
${note.statedBillingPainPoints.map(p => `- ${p}`).join('\n')}

## EHR & Clinical Operations
- Software: ${note.currentSoftwareAndStaffing}
- Decision Makers: ${note.decisionMakersIdentified}
- Commercial Terms Discussed: ${note.commercialTermsDiscussed}

## Action Items & To-Dos
${note.actionItems.map(a => `- [${a.completed ? 'x' : ' '}] ${a.task} (Due: ${a.due})`).join('\n')}

## Recommended Follow-Up Strategy
${note.recommendedFollowUpStrategy}
`;
    navigator.clipboard.writeText(md);
    setCopiedNoteId(note.id);
    setTimeout(() => setCopiedNoteId(null), 2500);
  };

  const handleCopyJsonToClipboard = (payload: any) => {
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2500);
  };

  const syncedCount = Object.keys(syncedMap).length;
  const activeSyncMeta = activeNote ? syncedMap[activeNote.id] : null;

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className={`p-6 rounded-3xl border transition-all duration-300 backdrop-blur-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 ${
        isDark 
          ? 'glass-panel bg-gradient-to-r from-slate-900 via-slate-900 to-blue-950/40 border-slate-800 shadow-xl' 
          : 'bg-white/85 border-slate-200/90 shadow-[0_12px_40px_-10px_rgba(15,23,42,0.08)]'
      }`}>
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-500 dark:text-blue-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            AI Business Intelligence
          </div>
          <h2 className={`text-xl sm:text-2xl font-black tracking-tight font-display ${isDark ? 'text-white text-glow-blue' : 'text-slate-900'}`}>
            Call Transcripts & Executive Meeting Notes
          </h2>
          <p className={`text-xs sm:text-sm mt-1 max-w-2xl ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Automatically transcribes each call with businesses, extracts business pain points, analyzes commercial terms, and syncs action items directly into your CRM database or JSON log.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Sync All to CRM Button */}
          {notes.length > 0 && (
            <button
              onClick={() => {
                setShowSyncModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white text-xs font-bold shadow-lg shadow-blue-600/25 transition cursor-pointer"
              title="Sync completed calls & tasks to CRM"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Sync to CRM</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20 font-mono">
                {syncedCount}/{notes.length}
              </span>
            </button>
          )}

          {/* View Mock CRM Database Button */}
          <button
            onClick={() => setShowDbModal(true)}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
              isDark 
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' 
                : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300 shadow-sm'
            }`}
            title="Inspect mock external CRM database table"
          >
            <Database className="w-4 h-4 text-cyan-500" />
            <span className="hidden sm:inline">CRM Database</span>
          </button>
        </div>
      </div>

      {notes.length === 0 ? (
        <div className={`p-12 text-center rounded-3xl border transition-all duration-300 ${
          isDark 
            ? 'bg-[#111C2E]/90 border-slate-700/40 text-slate-300' 
            : 'bg-white border-[#DCE5EC] text-[#172338] shadow-sm'
        }`}>
          <FileText className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
          <h3 className={`text-base font-bold mb-1 font-display ${isDark ? 'text-white' : 'text-slate-900'}`}>No Call Meeting Notes Yet</h3>
          <p className="text-xs max-w-md mx-auto leading-relaxed">
            Dial a healthcare provider from the Leads tab. Once the call finishes, Gemini automatically analyzes the audio transcript and populates detailed clinical notes here!
          </p>
        </div>
      ) : (
        /* Split view: List on left, details on right */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Notes List (4 cols) */}
          <div className="lg:col-span-4 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
              <span>Logged Call Records ({notes.length})</span>
              <span className="text-[11px] font-mono text-emerald-400 font-normal">
                {syncedCount} Synced
              </span>
            </div>

            {notes.map((note) => {
              const isSelected = note.id === (activeNote?.id);
              const noteSync = syncedMap[note.id];
              const quality = calculateCallQualityScore(note);
              return (
                <div
                  key={note.id}
                  onClick={() => setSelectedNoteId(note.id)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer backdrop-blur-md ${
                    isSelected
                      ? isDark
                        ? 'bg-slate-800/90 border-blue-500 shadow-lg shadow-blue-500/20'
                        : 'bg-white border-blue-500 shadow-md shadow-blue-500/15'
                      : isDark
                        ? 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                        : 'bg-white/80 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full font-mono ${
                      note.qualificationStatus === 'Hot Lead' ? 'bg-rose-500/20 text-rose-500 dark:text-rose-300 border border-rose-500/30' :
                      note.qualificationStatus === 'Warm Opportunity' ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30' :
                      isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {note.qualificationStatus}
                    </span>
                    <span className={`text-[10px] font-mono flex items-center gap-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      <Clock className="w-3 h-3" /> {note.duration}
                    </span>
                  </div>

                  <h4 className={`text-sm font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>{note.practiceName}</h4>
                  <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{note.doctorName}</p>

                  <div className={`mt-2.5 pt-2 border-t text-[11px] flex items-center justify-between ${
                    isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'
                  }`}>
                    <span>{note.date}</span>
                    <span className="text-teal-500 dark:text-teal-400 font-medium">{note.actionItems.length} Action Items</span>
                  </div>

                  {/* AI-Driven Call Quality Score Progress Bar (0-100) */}
                  <div className={`mt-2.5 pt-2 border-t space-y-1.5 ${
                    isDark ? 'border-slate-800' : 'border-slate-200'
                  }`}>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold flex items-center gap-1 text-[var(--text-primary)]">
                        <Activity className="w-3 h-3 text-cyan-400" />
                        <span>Call Quality Score</span>
                      </span>
                      <span className={`font-mono font-bold text-[10px] px-1.5 py-0.2 rounded border ${quality.badgeBg}`}>
                        {quality.score}/100 · {quality.grade}
                      </span>
                    </div>

                    {/* Quality Progress Bar */}
                    <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700/60 overflow-hidden shadow-inner">
                      <div 
                        className={`h-full rounded-full transition-all duration-700 ${quality.barColor}`} 
                        style={{ width: `${quality.score}%` }} 
                        title={`Score: ${quality.score}/100 (Sentiment: +${quality.sentimentPoints}p, Bridge: +${quality.bridgeDurationPoints}p, Qualification: +${quality.qualificationPoints}p)`}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>Sentiment: <strong className={quality.textColor}>{quality.sentimentTone}</strong> (+{quality.sentimentPoints}p)</span>
                      <span>Bridge: <strong className="text-slate-600 dark:text-slate-300">{quality.durationFormatted}</strong> (+{quality.bridgeDurationPoints}p)</span>
                    </div>
                  </div>

                  {/* CRM Sync Status Tag on Card */}
                  <div className={`mt-2 pt-2 border-t flex items-center justify-between text-[10px] font-mono ${
                    isDark ? 'border-slate-800/80' : 'border-slate-200'
                  }`}>
                    {noteSync ? (
                      <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                        <CheckCheck className="w-3 h-3 text-emerald-400" />
                        <span>Synced ({noteSync.crmSystem.split(' ')[0]})</span>
                      </span>
                    ) : (
                      <span className="text-amber-400 flex items-center gap-1">
                        <UploadCloud className="w-3 h-3 text-amber-400" />
                        <span>Pending CRM Sync</span>
                      </span>
                    )}
                    <span className="text-slate-500">
                      {noteSync?.recordId || 'Ready'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Active Note Full Details (8 cols) */}
          {activeNote && (
            <div className={`lg:col-span-8 p-6 rounded-3xl border shadow-xl space-y-6 backdrop-blur-2xl transition-colors duration-300 ${
              isDark 
                ? 'bg-[#111C2E]/90 border-slate-700/40 text-[#F1F5F9]' 
                : 'bg-white border-[#DCE5EC] text-[#172338] shadow-sm'
            }`}>
              
              {/* Header with Title & Action Buttons */}
              <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b ${
                isDark ? 'border-slate-800' : 'border-[#DCE5EC]'
              }`}>
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                      activeNote.qualificationStatus === 'Hot Lead' ? 'bg-rose-500/20 text-rose-500 dark:text-rose-300 border border-rose-500/30' :
                      activeNote.qualificationStatus === 'Warm Opportunity' ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30' :
                      isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {activeNote.qualificationStatus}
                    </span>
                    <span className={`text-xs font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Call Duration: {activeNote.duration}</span>

                    {/* Active Note Sync Badge */}
                    {activeSyncMeta ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-300 text-[10px] font-mono font-bold">
                        <CheckCheck className="w-3 h-3 text-emerald-500" />
                        Synced to {activeSyncMeta.crmSystem} ({activeSyncMeta.recordId})
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-300 text-[10px] font-mono font-medium">
                        <UploadCloud className="w-3 h-3 text-amber-500" />
                        Pending CRM Sync
                      </span>
                    )}
                  </div>
                  <h3 className={`text-xl font-bold tracking-tight font-display ${isDark ? 'text-white' : 'text-slate-900'}`}>{activeNote.practiceName}</h3>
                  <p className="text-xs text-teal-600 dark:text-teal-400 font-medium">{activeNote.doctorName} • {activeNote.date}</p>
                </div>

                {/* Header Action Buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Primary Feature: Sync to CRM Button */}
                  <button
                    onClick={() => {
                      setShowSyncModal(true);
                    }}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer shadow-md ${
                      activeSyncMeta
                        ? 'bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/40'
                        : 'bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white shadow-blue-600/25'
                    }`}
                    title="Export call transcript and action items to mock CRM database or JSON log"
                  >
                    {activeSyncMeta ? (
                      <>
                        <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Sync to CRM</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="w-3.5 h-3.5 text-white" />
                        <span>Sync to CRM</span>
                      </>
                    )}
                  </button>

                  {/* Export JSON Log Button */}
                  <button
                    onClick={() => handleDownloadJsonLog(activeNote)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                      isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300 shadow-sm'
                    }`}
                    title="Download completed call payload as JSON log"
                  >
                    <Download className="w-3.5 h-3.5 text-cyan-500" />
                    <span>JSON Log</span>
                  </button>

                  {/* Copy Markdown */}
                  <button
                    onClick={() => handleCopyMarkdown(activeNote)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                      isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300 shadow-sm'
                    }`}
                    title="Copy notes as markdown"
                  >
                    {copiedNoteId === activeNote.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedNoteId === activeNote.id ? 'Copied' : 'Markdown'}</span>
                  </button>
                </div>
              </div>

              {/* AI-Driven Call Quality Score & Telemetry Audit Panel */}
              {activeQuality && (
                <div className={`p-4 sm:p-5 rounded-2xl border backdrop-blur-md transition-all space-y-3.5 ${
                  isDark 
                    ? 'bg-slate-950/70 border-slate-800/80 shadow-md' 
                    : 'bg-gradient-to-r from-blue-50/70 via-teal-50/50 to-white border-blue-200/70 shadow-sm'
                }`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3 border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-slate-950 font-bold shadow-md shadow-cyan-500/20">
                        <Activity className="w-4 h-4 text-slate-950" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
                          <span>AI Call Quality Score</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${activeQuality.badgeBg}`}>
                            {activeQuality.score}/100 · Grade {activeQuality.grade}
                          </span>
                        </h4>
                        <p className="text-[11px] text-[var(--text-secondary)]">
                          Scored from verbatim transcript sentiment analysis & manager warm transfer bridge duration
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-mono">
                      <span className="text-slate-400">Bridge Duration:</span>
                      <strong className="text-teal-600 dark:text-teal-400 font-bold">{activeQuality.durationFormatted}</strong>
                    </div>
                  </div>

                  {/* Primary Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-mono font-semibold">
                      <span className="text-[var(--text-secondary)]">Composite Quality Index:</span>
                      <span className={activeQuality.textColor}>{activeQuality.score}%</span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden shadow-inner">
                      <div 
                        className={`h-full rounded-full transition-all duration-700 ${activeQuality.barColor}`} 
                        style={{ width: `${activeQuality.score}%` }} 
                      />
                    </div>
                  </div>

                  {/* 3 Driver Breakdown Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
                    {/* Driver 1: Sentiment */}
                    <div className={`p-2.5 rounded-xl border ${
                      isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-2xs'
                    }`}>
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>1. Sentiment & Tone</span>
                        <span className="font-mono font-bold text-teal-600 dark:text-teal-400">{activeQuality.sentimentPoints}/50 pts</span>
                      </div>
                      <div className="font-bold text-[var(--text-primary)] mt-1 flex items-center gap-1">
                        <ThumbsUp className="w-3 h-3 text-teal-500" />
                        <span>{activeQuality.sentimentTone}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                        {activeQuality.sentimentSummary}
                      </div>
                    </div>

                    {/* Driver 2: Bridge Duration */}
                    <div className={`p-2.5 rounded-xl border ${
                      isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-2xs'
                    }`}>
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>2. Bridge Duration</span>
                        <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{activeQuality.bridgeDurationPoints}/40 pts</span>
                      </div>
                      <div className="font-bold text-[var(--text-primary)] mt-1 flex items-center gap-1">
                        <PhoneForwarded className="w-3 h-3 text-blue-500" />
                        <span>{activeQuality.durationFormatted} Handoff</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                        {activeQuality.durationSeconds >= 180 ? 'Optimal 3m+ clinical qualification' : 'Standard consultative engagement'}
                      </div>
                    </div>

                    {/* Driver 3: Qualification & Action Items */}
                    <div className={`p-2.5 rounded-xl border ${
                      isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-2xs'
                    }`}>
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>3. Next Steps & Intent</span>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{activeQuality.qualificationPoints}/10 pts</span>
                      </div>
                      <div className="font-bold text-[var(--text-primary)] mt-1 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3 text-emerald-500" />
                        <span>{activeNote.qualificationStatus}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                        {activeNote.actionItems.length} Verified Action Items
                      </div>
                    </div>
                  </div>

                  {/* Buying Signals detected */}
                  {activeQuality.buyingSignals.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[10px] font-mono">
                      <span className="text-slate-400">Detected Signals:</span>
                      {activeQuality.buyingSignals.map((signal, idx) => (
                        <span key={idx} className="px-2 py-0.5 rounded-md bg-teal-500/10 border border-teal-500/20 text-teal-700 dark:text-teal-300">
                          ✓ {signal}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Executive Summary */}
              <div>
                <h4 className={`text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5 ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}>
                  <Sparkles className="w-3.5 h-3.5 text-teal-500" />
                  Executive Summary
                </h4>
                <p className={`text-xs sm:text-sm leading-relaxed p-4 rounded-2xl border transition-colors ${
                  isDark 
                    ? 'bg-slate-950/70 border-slate-800/80 text-slate-200' 
                    : 'bg-slate-50 border-slate-200 text-slate-800 shadow-sm'
                }`}>
                  {activeNote.executiveSummary}
                </p>
              </div>

              {/* Stated Pain Points & EHR Software Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                <div className={`p-4 rounded-2xl border transition-colors ${
                  isDark 
                    ? 'bg-slate-950/70 border-slate-800/80' 
                    : 'bg-rose-50/50 border-rose-200/60 shadow-sm'
                }`}>
                  <h5 className="text-xs font-bold text-rose-500 dark:text-rose-300 uppercase tracking-wider mb-2">
                    Stated Billing Pain Points
                  </h5>
                  <ul className="space-y-1.5">
                    {activeNote.statedBillingPainPoints.map((pp, idx) => (
                      <li key={idx} className={`text-xs flex items-start gap-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        <span className="text-rose-500 font-bold shrink-0">•</span>
                        <span>{pp}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className={`p-4 rounded-2xl border space-y-2 text-xs transition-colors ${
                  isDark 
                    ? 'bg-slate-950/70 border-slate-800/80' 
                    : 'bg-slate-50 border-slate-200 shadow-sm'
                }`}>
                  <h5 className="text-xs font-bold text-cyan-600 dark:text-cyan-300 uppercase tracking-wider mb-1">
                    Software & Operations
                  </h5>
                  <div>
                    <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Current Software / Staff:</span>
                    <p className={`font-semibold font-mono ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>{activeNote.currentSoftwareAndStaffing}</p>
                  </div>
                  <div>
                    <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Commercial Terms:</span>
                    <p className="text-emerald-600 dark:text-emerald-400 font-medium">{activeNote.commercialTermsDiscussed}</p>
                  </div>
                  <div>
                    <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Decision Makers:</span>
                    <p className={isDark ? 'text-slate-200' : 'text-slate-900'}>{activeNote.decisionMakersIdentified}</p>
                  </div>
                </div>
              </div>

              {/* Action Items / To-Dos */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <h4 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                    isDark ? 'text-slate-400' : 'text-slate-500'
                  }`}>
                    <CheckSquare className="w-3.5 h-3.5 text-emerald-500" />
                    Action Items & To-Dos for Sales Manager (CRM Tasks)
                  </h4>
                  <span className="text-xs text-slate-500 font-mono">
                    {activeNote.actionItems.filter(a => a.completed).length} / {activeNote.actionItems.length} Completed
                  </span>
                </div>
                <div className="space-y-2">
                  {activeNote.actionItems.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => onToggleTask(item.id)}
                      className={`p-3 rounded-2xl border flex items-start gap-3 transition cursor-pointer ${
                        item.completed
                          ? isDark 
                            ? 'bg-slate-950/40 border-slate-800 text-slate-500 line-through' 
                            : 'bg-slate-100/60 border-slate-200 text-slate-400 line-through'
                          : isDark 
                            ? 'bg-slate-950/90 border-slate-800 hover:border-slate-700 text-slate-200' 
                            : 'bg-slate-50/90 border-slate-200 hover:border-slate-300 text-slate-800 shadow-sm'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={item.completed}
                        onChange={() => {}}
                        className="mt-1 rounded border-slate-400 text-teal-500 focus:ring-0 cursor-pointer"
                      />
                      <div className="flex-1 text-xs">
                        <div className="font-medium">{item.task}</div>
                        <div className={`flex items-center gap-2 mt-1 font-mono text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold uppercase tracking-wider ${
                            item.priority === 'Urgent' ? 'bg-rose-500/20 text-rose-500 dark:text-rose-300 border border-rose-500/30' :
                            item.priority === 'High' ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30' :
                            item.priority === 'Medium' ? 'bg-sky-500/20 text-sky-600 dark:text-sky-300 border border-sky-500/30' :
                            isDark ? 'bg-slate-800 text-slate-300 border border-slate-700' : 'bg-slate-200 text-slate-700 border border-slate-300'
                          }`}>
                            {item.priority}
                          </span>
                          <span>Due: {item.due}</span>
                          <span>• {item.category}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommended Follow-up Strategy */}
              <div className={`p-4 rounded-2xl border transition-colors ${
                isDark ? 'bg-teal-950/20 border-teal-800/40 text-teal-100/90' : 'bg-teal-50/70 border-teal-200 text-teal-900 shadow-sm'
              }`}>
                <h5 className="text-xs font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Recommended Follow-up Strategy
                </h5>
                <p className="text-xs leading-relaxed">
                  {activeNote.recommendedFollowUpStrategy}
                </p>
              </div>

              {/* Verbatim Transcript Accordion */}
              {activeNote.transcript && activeNote.transcript.length > 0 && (
                <div>
                  <h4 className={`text-xs font-bold uppercase tracking-wider mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Verbatim Call Transcript ({activeNote.transcript.length} turns)
                  </h4>
                  <div className={`p-4 rounded-2xl border max-h-60 overflow-y-auto space-y-2.5 text-xs font-mono transition-colors ${
                    isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                  }`}>
                    {activeNote.transcript.map((t) => (
                      <div key={t.id} className={isDark ? 'text-slate-300' : 'text-slate-700'}>
                        <span className={`font-bold ${
                          t.speaker.includes('AI') ? 'text-teal-500 dark:text-teal-400' :
                          t.speaker.includes('Manager') ? 'text-emerald-500 dark:text-emerald-400' :
                          t.speaker.includes('Prospect') ? 'text-cyan-600 dark:text-cyan-300' :
                          t.speaker.includes('Note') ? 'text-amber-500 dark:text-amber-400' : 'text-slate-400'
                        }`}>
                          [{t.timestamp}] {t.speaker}:
                        </span>{' '}
                        <span>{t.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* SYNC TO CRM MODAL & EXPORTER */}
      {showSyncModal && activeNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className={`relative w-full max-w-2xl rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col transition-colors ${
            isDark 
              ? 'glass-modal border border-white/15 text-slate-100' 
              : 'bg-white/95 border border-slate-200 text-slate-900 shadow-[0_25px_80px_rgba(15,23,42,0.18)]'
          }`}>
            
            {/* Modal Header */}
            <div className={`flex items-start justify-between pb-3 border-b shrink-0 ${
              isDark ? 'border-slate-800' : 'border-slate-200'
            }`}>
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20">
                  <UploadCloud className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className={`text-base font-bold tracking-tight flex items-center gap-2 ${
                    isDark ? 'text-white' : 'text-slate-900'
                  }`}>
                    Sync to CRM Database & JSON Log Exporter
                  </h3>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Export completed calls, EHR clinical intelligence, and action items to mock CRM
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowSyncModal(false)}
                className={`p-1.5 rounded-lg text-xs transition cursor-pointer ${
                  isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900'
                }`}
              >
                ✕
              </button>
            </div>

            {/* Target CRM Selection */}
            <div className="shrink-0">
              <label className={`text-xs font-semibold block mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Target CRM Integration:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'Salesforce Health Cloud', label: 'Salesforce', sub: 'Health Cloud' },
                  { id: 'HubSpot Healthcare', label: 'HubSpot', sub: 'Deals & Tasks' },
                  { id: 'AthenaHealth PM', label: 'AthenaHealth', sub: 'Practice Mgmt' },
                  { id: 'Custom REST API (JSON Log)', label: 'Custom REST', sub: 'JSON Webhook' }
                ].map((crm) => {
                  const isSelected = targetCrm === crm.id;
                  return (
                    <button
                      key={crm.id}
                      type="button"
                      onClick={() => setTargetCrm(crm.id as CrmSystemType)}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                        isSelected
                          ? isDark
                            ? 'bg-blue-950/80 border-blue-400 text-white ring-2 ring-blue-500/30 shadow-md'
                            : 'bg-blue-50 border-blue-500 text-blue-900 ring-2 ring-blue-500/20 shadow-sm'
                          : isDark
                            ? 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className={`text-xs font-bold font-sans ${isSelected ? isDark ? 'text-white' : 'text-blue-900' : isDark ? 'text-slate-300' : 'text-slate-800'}`}>{crm.label}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-blue-500" />}
                      </div>
                      <span className={`text-[10px] font-mono block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{crm.sub}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tab switch between Overview and Raw JSON */}
            <div className={`flex rounded-xl p-1 border text-xs shrink-0 ${
              isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'
            }`}>
              <button
                type="button"
                onClick={() => setActiveModalTab('overview')}
                className={`flex-1 py-1.5 rounded-lg font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  activeModalTab === 'overview'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Payload Overview</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveModalTab('json')}
                className={`flex-1 py-1.5 rounded-lg font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  activeModalTab === 'json'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Code className="w-3.5 h-3.5" />
                <span>Raw JSON Log</span>
              </button>
            </div>

            {/* Modal Body / Scrollable Content */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
              {activeModalTab === 'overview' ? (
                <div className="space-y-3">
                  
                  {/* Account Summary Card */}
                  <div className={`p-3.5 rounded-2xl border space-y-2 ${
                    isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-indigo-500 uppercase tracking-wider flex items-center gap-1">
                        <Stethoscope className="w-3 h-3" />
                        Healthcare Account & Lead Record
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                        isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-700'
                      }`}>
                        Object: Account / Lead
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Practice:</span>
                        <p className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{activeNote.practiceName}</p>
                      </div>
                      <div>
                        <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Contact Physician:</span>
                        <p className="font-semibold text-teal-600 dark:text-teal-300">{activeNote.doctorName}</p>
                      </div>
                      <div>
                        <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Qualification:</span>
                        <p className="font-semibold text-rose-500 dark:text-rose-300">{activeNote.qualificationStatus}</p>
                      </div>
                      <div>
                        <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>EHR System:</span>
                        <p className={`font-mono ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{activeNote.currentSoftwareAndStaffing}</p>
                      </div>
                    </div>
                  </div>

                  {/* Call Activity Card */}
                  <div className={`p-3.5 rounded-2xl border space-y-2 ${
                    isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Completed Call Activity Log
                      </span>
                      <span className={`text-[10px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {activeNote.duration} Duration • {activeNote.transcript?.length || 0} Turns
                      </span>
                    </div>
                    <p className={`text-[11px] p-2 rounded-xl border line-clamp-3 ${
                      isDark ? 'text-slate-300 bg-slate-900 border-slate-800/80' : 'text-slate-700 bg-white border-slate-200'
                    }`}>
                      {activeNote.executiveSummary}
                    </p>
                  </div>

                  {/* Tasks to Sync */}
                  <div className={`p-3.5 rounded-2xl border space-y-2 ${
                    isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                        <CheckSquare className="w-3 h-3" />
                        Action Items / Tasks to Sync ({activeNote.actionItems.length})
                      </span>
                      <span className={`text-[10px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        Auto-assigned to Manager
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {activeNote.actionItems.map((item, idx) => (
                        <div key={idx} className={`p-2 rounded-xl border flex items-center justify-between text-[11px] ${
                          isDark ? 'bg-slate-900 border-slate-800/80' : 'bg-white border-slate-200'
                        }`}>
                          <span className={`truncate max-w-[340px] ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{item.task}</span>
                          <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
                            isDark ? 'bg-slate-800 text-amber-300' : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}>
                            {item.due}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* Raw JSON Viewer */
                <div className="space-y-2">
                  <div className={`flex items-center justify-between text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    <span>Generated JSON Payload Schema (RFC 8259 Compliant):</span>
                    <button
                      onClick={() => handleCopyJsonToClipboard(buildCrmPayload(activeNote, targetCrm))}
                      className="flex items-center gap-1 text-blue-500 hover:underline transition cursor-pointer font-semibold"
                    >
                      {copiedJson ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-blue-400" />}
                      <span>{copiedJson ? 'Copied JSON' : 'Copy JSON'}</span>
                    </button>
                  </div>

                  <pre className={`p-4 rounded-2xl border text-[11px] font-mono overflow-x-auto max-h-[300px] ${
                    isDark ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}>
                    {JSON.stringify(buildCrmPayload(activeNote, targetCrm), null, 2)}
                  </pre>
                </div>
              )}

              {/* In-flight syncing progress indicator */}
              {isSyncing && (
                <div className={`p-3.5 rounded-2xl border flex items-center gap-3 animate-pulse ${
                  isDark ? 'bg-blue-950/80 border-blue-500/50 text-blue-200' : 'bg-blue-50 border-blue-300 text-blue-900'
                }`}>
                  <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin shrink-0" />
                  <span className="text-xs font-mono">{syncStepText}</span>
                </div>
              )}
            </div>

            {/* Modal Bottom Actions */}
            <div className={`pt-3 border-t flex items-center justify-between gap-2 shrink-0 ${
              isDark ? 'border-slate-800' : 'border-slate-200'
            }`}>
              <button
                type="button"
                onClick={() => handleDownloadJsonLog(activeNote)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                  isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                }`}
                title="Download this record's payload as a .json file"
              >
                <Download className="w-3.5 h-3.5 text-cyan-500" />
                <span>Download JSON Log</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowSyncModal(false)}
                  disabled={isSyncing}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                    isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() => handleExecuteSync(activeNote)}
                  disabled={isSyncing}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 cursor-pointer disabled:opacity-50"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>{isSyncing ? 'Syncing...' : `Sync to ${targetCrm.split(' ')[0]}`}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MOCK EXTERNAL CRM DATABASE VIEWER MODAL */}
      {showDbModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className={`relative w-full max-w-3xl rounded-3xl p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col transition-colors ${
            isDark 
              ? 'glass-modal border border-white/15 text-slate-100' 
              : 'bg-white/95 border border-slate-200 text-slate-900 shadow-[0_25px_80px_rgba(15,23,42,0.18)]'
          }`}>
            
            <div className={`flex items-start justify-between pb-3 border-b shrink-0 ${
              isDark ? 'border-slate-800' : 'border-slate-200'
            }`}>
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-500 border border-cyan-500/20">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className={`text-base font-bold tracking-tight flex items-center gap-2 ${
                    isDark ? 'text-white' : 'text-slate-900'
                  }`}>
                    Mock External CRM Database Log
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 font-mono">
                      {syncedCount} Synchronized Records
                    </span>
                  </h3>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Live view of external CRM object records and task assignments committed from completed calls
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowDbModal(false)}
                className={`p-1.5 rounded-lg text-xs transition cursor-pointer ${
                  isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900'
                }`}
              >
                ✕
              </button>
            </div>

            {/* Database Table */}
            <div className="flex-1 overflow-y-auto pr-1">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className={`border-b text-[11px] font-mono uppercase ${
                    isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'
                  }`}>
                    <th className="py-2.5 px-3">CRM ID</th>
                    <th className="py-2.5 px-3">Target System</th>
                    <th className="py-2.5 px-3">Practice / Account</th>
                    <th className="py-2.5 px-3">Contact</th>
                    <th className="py-2.5 px-3">Tasks</th>
                    <th className="py-2.5 px-3">Synced At</th>
                  </tr>
                </thead>
                <tbody className={`divide-y font-mono text-[11px] ${
                  isDark ? 'divide-slate-800/60' : 'divide-slate-100'
                }`}>
                  {notes.map((note) => {
                    const sync = syncedMap[note.id];
                    return (
                      <tr key={note.id} className={isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}>
                        <td className="py-3 px-3 text-cyan-600 dark:text-cyan-300 font-bold">
                          {sync?.recordId || (
                            <span className={isDark ? 'text-slate-600 font-normal' : 'text-slate-400 font-normal'}>Pending Sync</span>
                          )}
                        </td>
                        <td className={`py-3 px-3 font-sans ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                          {sync ? sync.crmSystem : <span className="text-slate-400">-</span>}
                        </td>
                        <td className={`py-3 px-3 font-sans font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {note.practiceName}
                        </td>
                        <td className="py-3 px-3 text-teal-600 dark:text-teal-400 font-sans">
                          {note.doctorName}
                        </td>
                        <td className={`py-3 px-3 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                          {note.actionItems.length} Tasks
                        </td>
                        <td className={`py-3 px-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          {sync?.syncedAt || (
                            <button
                              onClick={() => {
                                setShowDbModal(false);
                                setSelectedNoteId(note.id);
                                setShowSyncModal(true);
                              }}
                              className="text-indigo-600 dark:text-indigo-400 hover:underline font-sans text-xs cursor-pointer font-semibold"
                            >
                              Sync Now
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Bottom Actions */}
            <div className={`pt-3 border-t flex items-center justify-between gap-2 shrink-0 ${
              isDark ? 'border-slate-800' : 'border-slate-200'
            }`}>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadAllJson}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                    isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                  }`}
                >
                  <Download className="w-3.5 h-3.5 text-cyan-500" />
                  <span>Download Master JSON Log</span>
                </button>

                <button
                  type="button"
                  onClick={handleBatchSyncAll}
                  disabled={isSyncing}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition cursor-pointer shadow-md shadow-indigo-600/20"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>Sync All ({notes.length})</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowDbModal(false)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs shadow-2xl animate-fade-in">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
