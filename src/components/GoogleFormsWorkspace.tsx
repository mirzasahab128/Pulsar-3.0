import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  FileSpreadsheet, 
  Plus, 
  RefreshCw, 
  Trash2, 
  ExternalLink, 
  Share2, 
  Copy, 
  Check, 
  Sparkles, 
  ShieldCheck, 
  Search, 
  Filter, 
  Users, 
  Layers, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Building2, 
  Send, 
  FileText, 
  Eye, 
  ChevronRight, 
  ArrowRight,
  ClipboardList,
  Inbox,
  HelpCircle,
  X,
  Download
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { 
  googleFormsService, 
  GoogleForm, 
  DriveFormFile, 
  GoogleFormResponse 
} from '../services/googleFormsService';
import { GoogleSignInButton } from './GoogleSignInButton';
import { GoogleWorkspaceConfirmModal, ConfirmDialogState } from './GoogleWorkspaceConfirmModal';
import { RCMLead } from '../types';
import { NicheTemplate } from '../data/nicheTemplates';

interface GoogleFormsWorkspaceProps {
  leads?: RCMLead[];
  nicheTemplate?: NicheTemplate;
  onSelectLeadForForm?: (lead: RCMLead) => void;
}

export const GoogleFormsWorkspace: React.FC<GoogleFormsWorkspaceProps> = ({
  leads = [],
  nicheTemplate,
  onSelectLeadForForm
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { currentUser, googleAccessToken, acquireGoogleFormsToken } = useAuth();

  // State
  const [formsList, setFormsList] = useState<DriveFormFile[]>([]);
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [selectedFormDetail, setSelectedFormDetail] = useState<GoogleForm | null>(null);
  const [formResponses, setFormResponses] = useState<GoogleFormResponse[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Modals & Panels
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [selectedTemplate, setSelectedTemplate] = useState<'50_claim_audit' | 'clinical_denial' | 'niche_discovery' | 'provider_onboarding' | 'custom'>('50_claim_audit');
  const [customTitle, setCustomTitle] = useState<string>('');
  const [customDescription, setCustomDescription] = useState<string>('');
  const [targetPracticeName, setTargetPracticeName] = useState<string>('');
  const [isCreating, setIsCreating] = useState<boolean>(false);

  // Copy Feedback
  const [copiedFormId, setCopiedFormId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Destructive Action Confirmation Modal state (Mandatory per Skill Constitution)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    isOpen: false,
    title: '',
    description: '',
    confirmButtonText: 'Delete Form',
    confirmVariant: 'danger',
    onConfirm: () => {},
    onCancel: () => setConfirmDialog(prev => ({ ...prev, isOpen: false })),
    isLoading: false
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  /**
   * Load Forms from Google Drive
   */
  const loadForms = useCallback(async (token: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const files = await googleFormsService.listForms(token);
      setFormsList(files);

      // Auto-select first form if none selected
      if (files.length > 0 && !selectedFormId) {
        setSelectedFormId(files[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load Google Forms:', err);
      setError(err?.message || 'Failed to fetch forms from Google Drive.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedFormId]);

  /**
   * Load Details and Responses for Selected Form
   */
  const loadFormDetailsAndResponses = useCallback(async (formId: string, token: string) => {
    try {
      setIsLoadingDetail(true);
      const [formDetail, responses] = await Promise.all([
        googleFormsService.getForm(formId, token).catch(() => null),
        googleFormsService.listResponses(formId, token).catch(() => [])
      ]);
      setSelectedFormDetail(formDetail);
      setFormResponses(responses);
    } catch (err: any) {
      console.error('Error fetching form details/responses:', err);
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  // Initial load when token is available
  useEffect(() => {
    if (googleAccessToken) {
      loadForms(googleAccessToken);
    }
  }, [googleAccessToken, loadForms]);

  // When selectedFormId changes, fetch details & responses
  useEffect(() => {
    if (selectedFormId && googleAccessToken) {
      loadFormDetailsAndResponses(selectedFormId, googleAccessToken);
    } else {
      setSelectedFormDetail(null);
      setFormResponses([]);
    }
  }, [selectedFormId, googleAccessToken, loadFormDetailsAndResponses]);

  /**
   * Auth Handler with Google Sign-in
   */
  const handleConnectGoogle = async () => {
    try {
      setIsAuthenticating(true);
      setError(null);
      const token = await acquireGoogleFormsToken();
      if (token) {
        await loadForms(token);
      }
    } catch (err: any) {
      setError(err?.message || 'Google Forms connection was cancelled or rejected.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  /**
   * Create New Form from Template or Custom
   */
  const handleCreateForm = async () => {
    if (!googleAccessToken) {
      handleConnectGoogle();
      return;
    }

    try {
      setIsCreating(true);
      setError(null);

      let created: GoogleForm;

      if (selectedTemplate === 'custom') {
        const title = customTitle.trim() || 'Pulsar Client Questionnaire';
        created = await googleFormsService.createForm(title, title, googleAccessToken);
      } else {
        const practice = targetPracticeName.trim() || (leads[0]?.practiceName) || (nicheTemplate?.name) || 'Target Practice';
        created = await googleFormsService.createPresetForm(selectedTemplate, practice, googleAccessToken);
      }

      showToast(`Successfully created Google Form: "${created.info.title}"`);
      setShowCreateModal(false);
      setCustomTitle('');
      setCustomDescription('');
      setTargetPracticeName('');

      // Refresh list and select newly created form
      await loadForms(googleAccessToken);
      setSelectedFormId(created.formId);
    } catch (err: any) {
      console.error('Error creating Google Form:', err);
      setError(err?.message || 'Failed to create Google Form.');
    } finally {
      setIsCreating(false);
    }
  };

  /**
   * Delete Form with Mandatory User Confirmation Modal (Per Workspace Skill Constitution)
   */
  const requestDeleteForm = (formFile: DriveFormFile) => {
    setConfirmDialog({
      isOpen: true,
      title: `Delete Google Form?`,
      description: `Are you sure you want to delete "${formFile.name}"? This action will permanently remove the form and all its submitted responses from Google Drive.`,
      confirmButtonText: 'Yes, Delete Form',
      confirmVariant: 'danger',
      onCancel: () => setConfirmDialog(prev => ({ ...prev, isOpen: false })),
      onConfirm: async () => {
        if (!googleAccessToken) return;
        try {
          setConfirmDialog(prev => ({ ...prev, isLoading: true }));
          await googleFormsService.deleteForm(formFile.id, googleAccessToken);
          showToast(`Deleted form "${formFile.name}"`);
          setConfirmDialog(prev => ({ ...prev, isOpen: false, isLoading: false }));
          
          if (selectedFormId === formFile.id) {
            setSelectedFormId(null);
            setSelectedFormDetail(null);
          }
          await loadForms(googleAccessToken);
        } catch (err: any) {
          setError(err?.message || 'Failed to delete form.');
          setConfirmDialog(prev => ({ ...prev, isOpen: false, isLoading: false }));
        }
      }
    });
  };

  /**
   * Copy Responder Link to Clipboard
   */
  const handleCopyLink = (url: string, id: string) => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopiedFormId(id);
    showToast('Public Google Form link copied to clipboard!');
    setTimeout(() => setCopiedFormId(null), 2500);
  };

  /**
   * Export Responses as CSV
   */
  const handleExportCSV = () => {
    if (!formResponses.length || !selectedFormDetail) return;
    
    // Header row
    const questionHeaders = selectedFormDetail.items?.map(it => it.title || 'Question') || [];
    const csvRows = [
      ['Response ID', 'Timestamp', 'Respondent Email', ...questionHeaders].join(',')
    ];

    formResponses.forEach(r => {
      const answers = selectedFormDetail.items?.map(item => {
        const qId = item.questionItem?.question?.questionId;
        if (!qId || !r.answers?.[qId]) return '""';
        const text = r.answers[qId].textAnswers?.answers.map(a => a.value).join('; ') || '';
        return `"${text.replace(/"/g, '""')}"`;
      }) || [];

      csvRows.push([
        `"${r.responseId}"`,
        `"${new Date(r.lastSubmittedTime).toLocaleString()}"`,
        `"${r.respondentEmail || 'Anonymous'}"`,
        ...answers
      ].join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${selectedFormDetail.info.title || 'form_responses'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Responses exported to CSV file.');
  };

  // Filtered forms list
  const filteredForms = useMemo(() => {
    return formsList.filter(f => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return f.name.toLowerCase().includes(q) || (f.description && f.description.toLowerCase().includes(q));
    });
  }, [formsList, searchQuery]);

  return (
    <div className={`p-4 sm:p-6 rounded-3xl border transition-all duration-300 relative overflow-hidden backdrop-blur-2xl space-y-6 ${
      isDark 
        ? 'bg-slate-900/90 border-teal-500/25 shadow-2xl shadow-teal-500/5' 
        : 'bg-white border-teal-500/20 shadow-xl shadow-teal-600/5'
    }`}>
      {/* Top Ambient Bar */}
      <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-teal-500 via-cyan-400 to-blue-600 opacity-90" />

      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-teal-500/15">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/15 border border-teal-500/30 text-teal-400 text-xs font-bold uppercase tracking-wider mb-2">
            <ClipboardList className="w-3.5 h-3.5" />
            <span>Google Forms API • Workspace Integration</span>
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <span>Client Intake & 50-Claim Audit Forms</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
            Create, deploy, and inspect Google Forms questionnaires for provider qualification, diagnostic billing audits, and live response tracking.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {googleAccessToken ? (
            <>
              <button
                type="button"
                onClick={() => loadForms(googleAccessToken)}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 hover:bg-white/5 text-slate-300 text-xs font-semibold transition cursor-pointer"
                title="Refresh forms list"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-teal-400' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>

              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-slate-950 font-bold text-xs shadow-md shadow-teal-500/20 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create Google Form</span>
              </button>
            </>
          ) : (
            <GoogleSignInButton
              onClick={handleConnectGoogle}
              disabled={isAuthenticating}
              label={isAuthenticating ? 'Connecting Google...' : 'Connect Google Forms'}
            />
          )}
        </div>
      </div>

      {/* Error notification banner */}
      {error && (
        <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button 
            type="button"
            onClick={() => setError(null)}
            className="text-slate-400 hover:text-white text-xs font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-3 rounded-xl bg-teal-500/15 border border-teal-500/30 text-teal-300 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Auth Gate State if not authenticated */}
      {!googleAccessToken && (
        <div className={`p-8 rounded-3xl border text-center space-y-4 max-w-xl mx-auto my-6 ${
          isDark ? 'bg-slate-950/80 border-white/10' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="w-14 h-14 rounded-2xl bg-teal-500/15 border border-teal-500/30 text-teal-400 flex items-center justify-center mx-auto">
            <ClipboardList className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Connect Google Workspace to use Google Forms
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Grant permission to create and manage client questionnaires, 50-claim diagnostic audit forms, and read live responses directly with your Google account.
            </p>
          </div>

          <div className="pt-2 flex justify-center">
            <GoogleSignInButton
              onClick={handleConnectGoogle}
              disabled={isAuthenticating}
              label={isAuthenticating ? 'Connecting Google...' : 'Sign in with Google'}
            />
          </div>
          <div className="text-[11px] text-slate-500 font-mono flex items-center justify-center gap-1.5 pt-1">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
            <span>In-memory OAuth 2.0 token flow · Zero permanent credential exposure</span>
          </div>
        </div>
      )}

      {/* Authenticated Workspace Content */}
      {googleAccessToken && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column (1 Col): Forms List & Search */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider font-mono">
                Google Forms ({formsList.length})
              </span>
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="text-xs text-teal-400 hover:text-teal-300 font-bold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Form</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search forms by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-8 pr-3 py-2 rounded-xl text-xs border outline-none transition ${
                  isDark 
                    ? 'bg-slate-950/70 border-white/10 text-white placeholder-slate-500 focus:border-teal-500/50' 
                    : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-teal-500'
                }`}
              />
            </div>

            {/* Forms Scrollable List */}
            <div className="space-y-2 max-h-[580px] overflow-y-auto pr-1">
              {isLoading && formsList.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto text-teal-400" />
                  <span>Querying Google Drive for Google Forms...</span>
                </div>
              ) : filteredForms.length === 0 ? (
                <div className={`p-6 rounded-2xl border text-center space-y-3 ${
                  isDark ? 'bg-slate-950/40 border-white/5' : 'bg-slate-50 border-slate-200'
                }`}>
                  <Inbox className="w-6 h-6 mx-auto text-slate-500" />
                  <p className="text-xs text-slate-400">
                    {searchQuery ? 'No forms match your search.' : 'No Google Forms found in your Google Drive.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(true)}
                    className="px-3 py-1.5 rounded-xl bg-teal-500/20 text-teal-300 font-bold text-xs border border-teal-500/30 hover:bg-teal-500/30 transition cursor-pointer"
                  >
                    Create First 50-Claim Audit Form
                  </button>
                </div>
              ) : (
                filteredForms.map((form) => {
                  const isSelected = selectedFormId === form.id;
                  return (
                    <div
                      key={form.id}
                      onClick={() => setSelectedFormId(form.id)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative group ${
                        isSelected
                          ? isDark 
                            ? 'bg-slate-950 border-teal-500/60 ring-1 ring-teal-500/40 shadow-lg' 
                            : 'bg-teal-50/60 border-teal-500 ring-1 ring-teal-500/30 shadow-md'
                          : isDark 
                            ? 'bg-slate-950/60 border-white/5 hover:border-white/20' 
                            : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 space-y-1">
                          <h4 className="font-bold text-xs text-slate-900 dark:text-white line-clamp-1">
                            {form.name}
                          </h4>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                            <span>Modified: {form.modifiedTime ? new Date(form.modifiedTime).toLocaleDateString() : 'Recent'}</span>
                          </div>
                        </div>

                        {/* Direct Action Icons */}
                        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                          {form.webViewLink && (
                            <a
                              href={form.webViewLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-teal-400 transition"
                              title="Open in Google Forms"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              requestDeleteForm(form);
                            }}
                            className="p-1 rounded-lg hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition"
                            title="Delete form"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column (2 Cols): Selected Form Inspector & Live Responses */}
          <div className="lg:col-span-2 space-y-5">
            {isLoadingDetail ? (
              <div className={`p-12 rounded-3xl border text-center space-y-3 ${
                isDark ? 'bg-slate-950/70 border-white/10' : 'bg-white border-slate-200'
              }`}>
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-teal-400" />
                <span className="text-xs text-slate-400">Loading Google Form details & responses...</span>
              </div>
            ) : selectedFormDetail ? (
              <div className="space-y-5">
                {/* Form Hero Card */}
                <div className={`p-5 rounded-2xl border transition-all ${
                  isDark ? 'bg-slate-950/80 border-teal-500/25' : 'bg-white border-slate-200 shadow-sm'
                }`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base sm:text-lg text-slate-900 dark:text-white">
                          {selectedFormDetail.info.title}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-500/15 border border-teal-500/30 text-teal-400 font-bold">
                          Active Form
                        </span>
                      </div>
                      {selectedFormDetail.info.description && (
                        <p className="text-xs text-slate-400 max-w-xl">
                          {selectedFormDetail.info.description}
                        </p>
                      )}
                    </div>

                    {/* Share / Open buttons */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {selectedFormDetail.responderUri && (
                        <button
                          type="button"
                          onClick={() => handleCopyLink(selectedFormDetail.responderUri!, selectedFormDetail.formId)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 font-bold text-xs border border-teal-500/30 transition cursor-pointer"
                        >
                          {copiedFormId === selectedFormDetail.formId ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedFormId === selectedFormDetail.formId ? 'Link Copied!' : 'Copy Share Link'}</span>
                        </button>
                      )}

                      {selectedFormDetail.responderUri && (
                        <a
                          href={selectedFormDetail.responderUri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition border border-white/15"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Fill Form</span>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Form Metrics Strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 text-xs font-mono">
                    <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
                      <span className="text-slate-400 block text-[10px]">Questions:</span>
                      <strong className="text-teal-400 font-bold">{selectedFormDetail.items?.length || 0} Fields</strong>
                    </div>

                    <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
                      <span className="text-slate-400 block text-[10px]">Submissions:</span>
                      <strong className="text-cyan-400 font-bold">{formResponses.length} Responses</strong>
                    </div>

                    <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
                      <span className="text-slate-400 block text-[10px]">Form ID:</span>
                      <strong className="text-slate-300 font-bold truncate block">{selectedFormDetail.formId}</strong>
                    </div>

                    <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
                      <span className="text-slate-400 block text-[10px]">Audits Status:</span>
                      <strong className="text-emerald-400 font-bold">Ready for Leads</strong>
                    </div>
                  </div>
                </div>

                {/* Submissions & Responses Section */}
                <div className={`p-5 rounded-2xl border transition-all ${
                  isDark ? 'bg-slate-950/80 border-white/10' : 'bg-white border-slate-200'
                }`}>
                  <div className="flex items-center justify-between pb-3 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-teal-400" />
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                        Live Submitted Responses ({formResponses.length})
                      </h3>
                    </div>

                    {formResponses.length > 0 && (
                      <button
                        type="button"
                        onClick={handleExportCSV}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs border border-white/15 transition cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5 text-teal-400" />
                        <span>Export CSV</span>
                      </button>
                    )}
                  </div>

                  {formResponses.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400 space-y-2">
                      <Inbox className="w-6 h-6 mx-auto text-slate-500" />
                      <p>No submissions recorded yet for this form.</p>
                      <p className="text-[11px] text-slate-500">
                        Share the responder link with target businesses or clients to collect diagnostic data.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 pt-3 max-h-[380px] overflow-y-auto pr-1">
                      {formResponses.map((response, index) => (
                        <div
                          key={response.responseId}
                          className={`p-3.5 rounded-xl border text-xs space-y-2.5 ${
                            isDark ? 'bg-slate-900/60 border-white/5' : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between font-mono text-[11px] pb-1.5 border-b border-white/5">
                            <span className="font-bold text-teal-400">Response #{index + 1}</span>
                            <span className="text-slate-400">
                              {new Date(response.lastSubmittedTime).toLocaleString()}
                            </span>
                          </div>

                          {response.respondentEmail && (
                            <div className="text-[11px] text-slate-300">
                              <span className="text-slate-500">Respondent: </span>
                              <strong>{response.respondentEmail}</strong>
                            </div>
                          )}

                          {/* Response Answers */}
                          <div className="space-y-2 pt-1">
                            {selectedFormDetail.items?.map((item) => {
                              const qId = item.questionItem?.question?.questionId;
                              if (!qId || !response.answers?.[qId]) return null;
                              const answerList = response.answers[qId].textAnswers?.answers || [];
                              return (
                                <div key={qId} className="text-[11px] space-y-0.5">
                                  <span className="text-slate-400 font-medium block">
                                    {item.title}
                                  </span>
                                  <div className="font-bold text-white pl-2 border-l-2 border-teal-500/50">
                                    {answerList.map(a => a.value).join(', ')}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Form Questions & Structure Preview */}
                <div className={`p-5 rounded-2xl border transition-all ${
                  isDark ? 'bg-slate-950/80 border-white/10' : 'bg-white border-slate-200'
                }`}>
                  <div className="flex items-center gap-2 pb-3 border-b border-white/10">
                    <Layers className="w-4 h-4 text-cyan-400" />
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      Form Question Structure ({selectedFormDetail.items?.length || 0} Items)
                    </h3>
                  </div>

                  <div className="space-y-2.5 pt-3">
                    {selectedFormDetail.items?.map((item, idx) => (
                      <div
                        key={item.itemId || idx}
                        className={`p-3 rounded-xl border flex items-start justify-between gap-3 text-xs ${
                          isDark ? 'bg-slate-900/40 border-white/5' : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="text-teal-400 font-mono">Q{idx + 1}.</span>
                            <span>{item.title || 'Untitled Field'}</span>
                          </div>
                          {item.description && (
                            <p className="text-[11px] text-slate-400">
                              {item.description}
                            </p>
                          )}
                          {item.questionItem?.question?.choiceQuestion && (
                            <div className="flex items-center gap-2 flex-wrap pt-1">
                              {item.questionItem.question.choiceQuestion.options.map((opt, oIdx) => (
                                <span 
                                  key={oIdx}
                                  className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-slate-300 font-mono"
                                >
                                  {opt.value}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {item.questionItem?.question?.required && (
                          <span className="text-[10px] text-red-400 font-mono font-bold shrink-0">
                            Required
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            ) : (
              <div className={`p-12 rounded-3xl border text-center space-y-3 ${
                isDark ? 'bg-slate-950/70 border-white/10' : 'bg-white border-slate-200'
              }`}>
                <FileSpreadsheet className="w-8 h-8 mx-auto text-slate-500" />
                <h4 className="font-bold text-sm text-slate-300">
                  Select a Google Form to Inspect
                </h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Choose a questionnaire from the left sidebar to view its questions, live responses, and public shareable link.
                </p>
              </div>
            )}
          </div>

        </div>
      )}

      {/* CREATE NEW GOOGLE FORM MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-2xl rounded-3xl border shadow-2xl p-6 space-y-5 transition-all max-h-[90vh] overflow-y-auto ${
            isDark ? 'bg-slate-950 border-teal-500/30 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-teal-500/20 text-teal-400">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Create New Google Form</h3>
                  <p className="text-xs text-slate-400">
                    Deploy standard clinical audit questionnaires or custom client intake forms directly to your Google Workspace.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Template Selector Grid */}
            <div className="space-y-3">
              <span className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider">
                Select Questionnaire Preset:
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Preset 1: 50-Claim Audit */}
                <div
                  onClick={() => setSelectedTemplate('50_claim_audit')}
                  className={`p-3.5 rounded-2xl border transition cursor-pointer space-y-1.5 ${
                    selectedTemplate === '50_claim_audit'
                      ? 'bg-teal-500/15 border-teal-500 ring-1 ring-teal-500/30'
                      : isDark ? 'bg-slate-900/60 border-white/5 hover:border-white/20' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-teal-400">1. 50-Claim Audit Intake</span>
                    <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Diagnostic intake for NPI, EHR platform, gross billing volume, denial rate & aging AR days.
                  </p>
                </div>

                {/* Preset 2: Clinical Denial Overturns */}
                <div
                  onClick={() => setSelectedTemplate('clinical_denial')}
                  className={`p-3.5 rounded-2xl border transition cursor-pointer space-y-1.5 ${
                    selectedTemplate === 'clinical_denial'
                      ? 'bg-teal-500/15 border-teal-500 ring-1 ring-teal-500/30'
                      : isDark ? 'bg-slate-900/60 border-white/5 hover:border-white/20' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-cyan-400">2. Complex Denial Assessment</span>
                    <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Payer denial distribution, internal appeal staffing, and arbitration resolution benchmark.
                  </p>
                </div>

                {/* Preset 3: Niche Discovery */}
                <div
                  onClick={() => setSelectedTemplate('niche_discovery')}
                  className={`p-3.5 rounded-2xl border transition cursor-pointer space-y-1.5 ${
                    selectedTemplate === 'niche_discovery'
                      ? 'bg-teal-500/15 border-teal-500 ring-1 ring-teal-500/30'
                      : isDark ? 'bg-slate-900/60 border-white/5 hover:border-white/20' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-blue-400">3. Business Growth Discovery</span>
                    <Building2 className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Evaluates sales pipeline automation, target personas, and outbound calling bottlenecks.
                  </p>
                </div>

                {/* Preset 4: Provider Onboarding */}
                <div
                  onClick={() => setSelectedTemplate('provider_onboarding')}
                  className={`p-3.5 rounded-2xl border transition cursor-pointer space-y-1.5 ${
                    selectedTemplate === 'provider_onboarding'
                      ? 'bg-teal-500/15 border-teal-500 ring-1 ring-teal-500/30'
                      : isDark ? 'bg-slate-900/60 border-white/5 hover:border-white/20' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-emerald-400">4. Provider Onboarding Intake</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Medical director details, clearinghouse setup, billing locations & briefing email dispatch.
                  </p>
                </div>
              </div>
            </div>

            {/* Target Practice Name field */}
            <div className="space-y-1 text-xs">
              <label className="font-semibold text-slate-300">
                Target Practice / Client Organization Name:
              </label>
              <input
                type="text"
                placeholder={leads[0]?.practiceName || 'e.g. Austin Heart & Vascular Institute'}
                value={targetPracticeName}
                onChange={(e) => setTargetPracticeName(e.target.value)}
                className={`w-full px-3.5 py-2.5 rounded-xl border outline-none transition ${
                  isDark 
                    ? 'bg-slate-900 border-white/10 text-white placeholder-slate-500 focus:border-teal-500' 
                    : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-teal-500'
                }`}
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-xl border border-white/10 text-slate-400 hover:text-white text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateForm}
                disabled={isCreating}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-teal-500/20 transition cursor-pointer"
              >
                {isCreating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span>{isCreating ? 'Deploying to Google Forms...' : 'Create Form in Google Drive'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mandatory Destructive Action Confirmation Modal */}
      <GoogleWorkspaceConfirmModal {...confirmDialog} />
    </div>
  );
};
