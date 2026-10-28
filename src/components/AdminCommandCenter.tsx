import React, { useCallback, useEffect, useState } from 'react';
import {
  ShieldCheck,
  Users,
  UserCheck,
  Layers,
  KeyRound,
  ScrollText,
  LayoutDashboard,
  Plus,
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  MailWarning,
  Lock,
  KeySquare
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import {
  apiService,
  PlatformPlan,
  PlatformUserRecord,
  AuditLogEntry,
  AdminOverview
} from '../services/api';

type AdminTab = 'overview' | 'users' | 'approvals' | 'plans' | 'master' | 'audit' | 'outreach';

const FEATURE_LABELS: Record<string, string> = {
  lead_discovery: 'Lead Discovery',
  npi_search: 'NPI Registry Search',
  campaigns: 'Campaigns',
  email_outreach: 'Email Outreach',
  call_studio: 'Call Studio',
  linkedin_workflows: 'LinkedIn Workflows',
  ai_assistant: 'AI Assistant',
  daily_briefing: 'Daily Briefing',
  territory_maps: 'Territory Maps',
  google_sync: 'Google Sync'
};

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  pending_approval: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  disabled: 'bg-rose-500/15 text-rose-500 border-rose-500/30'
};

export const AdminCommandCenter: React.FC = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [tab, setTab] = useState<AdminTab>('overview');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<PlatformUserRecord[]>([]);
  const [requests, setRequests] = useState<PlatformUserRecord[]>([]);
  const [plans, setPlans] = useState<PlatformPlan[]>([]);
  const [featureKeys, setFeatureKeys] = useState<string[]>([]);
  const [audit, setAudit] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  // Create-user form
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPlanId, setNewPlanId] = useState('');
  const [newRole, setNewRole] = useState('user');
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);
  const [customTitleUid, setCustomTitleUid] = useState<string | null>(null);
  const [customTitleText, setCustomTitleText] = useState('');
  /** Title picker options: titles already in use first (preexisting),
   *  then standard titles. Custom entry is handled by the Custom option. */
  const titleSuggestions = Array.from(new Set([
    ...users.map(u => u.title).filter((t): t is string => !!t),
    'Owner - Master Admin', 'Master Admin', 'Admin', 'Manager', 'Sales Manager', 'AR Manager', 'Team Lead', 'User'
  ]));

  // Per-user access editor (uid whose editor is expanded)
  const [accessEditorUid, setAccessEditorUid] = useState<string | null>(null);

  // Plan editor
  const [editingPlan, setEditingPlan] = useState<PlatformPlan | null>(null);
  const [newPlanIdInput, setNewPlanIdInput] = useState('');

  // Phase 7.1 outreach gates: consent ledger, suppression, gate check
  const [phase71, setPhase71] = useState<any>(null);
  // Phase 7.3 after-call automation: pipeline, tasks, drafts, owner summaries
  const [phase73, setPhase73] = useState<any>(null);
  // Phase 7.4 owner dashboard: handed over, hot, waiting, stuck, won, lost
  const [phase74, setPhase74] = useState<any>(null);
  const [outcomeContactId, setOutcomeContactId] = useState('');
  const [outcomeReason, setOutcomeReason] = useState('');
  const [optOutContactId, setOptOutContactId] = useState('');
  const [gateContactId, setGateContactId] = useState('');
  const [gateEmail, setGateEmail] = useState('');
  const [gatePhone, setGatePhone] = useState('');
  const [gateLineType, setGateLineType] = useState('mobile');
  const [gateChannel, setGateChannel] = useState('voice');
  const [gateEmailVerified, setGateEmailVerified] = useState(true);
  const [gatePhoneVerified, setGatePhoneVerified] = useState(true);
  const [gateResult, setGateResult] = useState<any>(null);
  const [consentContactId, setConsentContactId] = useState('');
  const [consentChannel, setConsentChannel] = useState('voice');
  const [consentType, setConsentType] = useState('pewc');
  const [consentSource, setConsentSource] = useState('');
  const [suppType, setSuppType] = useState('phone');
  const [suppValue, setSuppValue] = useState('');
  const [suppCsv, setSuppCsv] = useState('');

  // Master admin editor
  const [storedAdmins, setStoredAdmins] = useState<string[]>([]);
  const [envAdmins, setEnvAdmins] = useState<string[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');

  // Approval plan picks (uid -> planId)
  const [approvalPlan, setApprovalPlan] = useState<Record<string, string>>({});

  // Phase 2 theme: cards/inputs resolve to the theme tokens (which flip
  // with the existing .dark switch), so the admin screens read as the
  // same app as the themed dashboard. isDark is kept for the remaining
  // inline accents below.
  const cardCls = 'pv-card rounded-2xl border border-[var(--pv-border)] bg-[var(--pv-card)] text-[var(--pv-ink)]';
  const inputCls = 'px-2.5 py-1.5 rounded-lg border border-[var(--pv-border)] bg-[var(--pv-card-soft)] text-[var(--pv-ink)] text-xs outline-none focus:border-[var(--pv-accent)]';
  const btnCls = 'px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer';

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [o, u, r, p, a, m, g, h, d] = await Promise.all([
        apiService.getAdminOverview(),
        apiService.getAdminUsers(),
        apiService.getSignupRequests(),
        apiService.getPlans(),
        apiService.getAuditLog(100),
        apiService.getMasterAdmins(),
        apiService.getPhase71Overview().catch(() => null),
        apiService.getPhase73Overview().catch(() => null),
        apiService.getPhase74Dashboard().catch(() => null)
      ]);
      setOverview(o);
      setUsers(u);
      setRequests(r);
      setPlans(p.plans);
      setFeatureKeys(p.featureKeys);
      setAudit(a);
      setPhase71(g);
      setPhase73(h);
      setPhase74(d);
      setStoredAdmins(m.stored);
      setEnvAdmins(m.env);
    } catch (e: any) {
      setError(e?.message || 'Failed to load admin data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const defaultPlanId = plans.find(p => p.isDefault)?.id || plans[0]?.id || '';

  const runAction = async (fn: () => Promise<void>, successMsg?: string) => {
    setError(null);
    setNotice(null);
    try {
      await fn();
      if (successMsg) setNotice(successMsg);
      await loadAll();
    } catch (e: any) {
      setError(e?.message || 'Action failed');
    }
  };

  const handleCreateUser = async () => {
    if (!newEmail.trim()) {
      setError('Email is required');
      return;
    }
    setError(null);
    setInviteStatus(null);
    try {
      const result = await apiService.createAdminUser({
        email: newEmail.trim(),
        displayName: newName.trim() || undefined,
        planId: newPlanId || defaultPlanId || undefined,
        role: newRole
      });
      if (result.invite.status === 'sent') {
        setInviteStatus(`Invite email sent to ${result.user.email}.`);
      } else if (result.invite.status === 'not_configured') {
        setInviteStatus(
          `User created, but the invite email was NOT sent — the mailer is not configured (RESEND_API_KEY missing). Tell the user to sign up with ${result.user.email}; their plan activates on first sign-in.`
        );
      } else {
        setInviteStatus(`User created; invite email failed: ${result.invite.error || 'unknown error'}`);
      }
      setNewEmail('');
      setNewName('');
      await loadAll();
    } catch (e: any) {
      setError(e?.message || 'Failed to create user');
    }
  };

  // Effective access for display: plan features modified by the user's
  // overrides. (The server computes and enforces the same merge; this is
  // only the admin-facing view of it.)
  const planFor = (u: PlatformUserRecord) => plans.find(p => p.id === u.planId) || null;
  const effectiveFor = (u: PlatformUserRecord, key: string): boolean => {
    const override = u.featureOverrides?.[key];
    if (typeof override === 'boolean') return override;
    return planFor(u)?.features?.[key] === true;
  };
  const effectiveCount = (u: PlatformUserRecord) =>
    u.role === 'master_admin' ? featureKeys.length : featureKeys.filter(k => effectiveFor(u, k)).length;

  const applyOverride = (u: PlatformUserRecord, key: string, value: boolean | null) => {
    runAction(async () => {
      await apiService.setUserFeatureOverrides(u.uid, { [key]: value });
    }, value === null
      ? `${FEATURE_LABELS[key] || key} for ${u.email} now follows the plan`
      : value
        ? `${FEATURE_LABELS[key] || key} granted to ${u.email}`
        : `${FEATURE_LABELS[key] || key} revoked for ${u.email}`);
  };

  const handlePasswordReset = async (u: PlatformUserRecord) => {
    if (!window.confirm(`Email a password-reset request to ${u.email}?`)) return;
    setError(null);
    setNotice(null);
    try {
      const res = await apiService.triggerUserPasswordReset(u.uid);
      if (res.status === 'sent') {
        setNotice(`Password-reset email sent to ${u.email}.`);
      } else if (res.status === 'not_configured') {
        setNotice(`Reset recorded for ${u.email}, but the email was NOT sent — the mailer is not configured (RESEND_API_KEY missing). The user can still reset via "Forgot password" on the sign-in page.`);
      } else {
        setError(`Password-reset email failed for ${u.email}: ${res.error || 'unknown error'}`);
      }
      await loadAll();
    } catch (e: any) {
      setError(e?.message || 'Password reset failed');
    }
  };

  const handleDeleteUser = (u: PlatformUserRecord) => {
    const typed = window.prompt(
      `Delete the platform record for ${u.email}? Their access ends immediately.\n(The Firebase sign-in account itself is not deleted.)\n\nType the user's email to confirm:`
    );
    if (typed === null) return;
    if (typed.trim().toLowerCase() !== u.email.toLowerCase()) {
      setError('Email did not match — deletion cancelled.');
      return;
    }
    runAction(async () => { await apiService.deleteAdminUser(u.uid); }, `Deleted ${u.email}`);
  };

  const tabs: Array<{ id: AdminTab; label: string; icon: React.ComponentType<{ className?: string }>; count?: number }> = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'users', label: 'Users', icon: Users, count: users.length },
    { id: 'approvals', label: 'Signup Approvals', icon: UserCheck, count: requests.length },
    { id: 'plans', label: 'Plans & Access', icon: Layers },
    { id: 'master', label: 'Master Control', icon: KeyRound },
    { id: 'outreach', label: 'Outreach Gates', icon: ShieldCheck },
    { id: 'audit', label: 'Audit Log', icon: ScrollText }
  ];

  return (
    <div className="space-y-5">
      <div className={`${cardCls} p-4`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-violet-400" />
            <div>
              <h2 className="text-sm font-bold">Admin Command Center</h2>
              <p className="text-[11px] text-slate-500">Users, per-area access grants, signup approvals, plans, master control, and the audit trail. Every action here is enforced server-side and audit-logged.</p>
            </div>
          </div>
          <button onClick={loadAll} className={`${btnCls} border ${isDark ? 'border-slate-700 hover:bg-white/5' : 'border-slate-300 hover:bg-slate-100'} flex items-center gap-1.5`}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5 mt-4">
          {tabs.map(t => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`${btnCls} flex items-center gap-1.5 ${
                  active
                    ? 'bg-[var(--pv-green)] text-white shadow'
                    : 'bg-[var(--pv-card-soft)] text-[var(--pv-muted)] hover:bg-[var(--pv-mint)] hover:text-[var(--pv-ink)]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
                {t.count !== undefined && t.count > 0 && (
                  <span className="font-mono text-[10px] px-1 rounded bg-black/20">{t.count}</span>
                )}
              </button>
            );
          })}
        </div>

        {error && (
          <div className="mt-3 flex items-start gap-2 text-xs text-rose-500 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> <span>{error}</span>
          </div>
        )}
        {notice && (
          <div className="mt-3 flex items-start gap-2 text-xs text-emerald-500 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3 py-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" /> <span>{notice}</span>
          </div>
        )}
      </div>

      {/* ---------------------------- Overview tab ----------------------------- */}
      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'Total users', value: overview?.totalUsers ?? 0 },
              { label: 'Active', value: overview?.byStatus?.active ?? 0 },
              { label: 'Pending approval', value: overview?.pendingApprovals ?? 0 },
              { label: 'Disabled', value: overview?.byStatus?.disabled ?? 0 },
              { label: 'Master admins', value: overview?.masterAdminCount ?? 0 }
            ].map(card => (
              <div key={card.label} className={`${cardCls} p-4`}>
                <div className="text-[11px] uppercase tracking-wide text-slate-500">{card.label}</div>
                <div className="text-2xl font-extrabold mt-1 tabular-nums">{card.value}</div>
              </div>
            ))}
          </div>

          <div className={`${cardCls} p-4 space-y-3`}>
            <div className="text-xs font-bold">Users by plan</div>
            <div className="flex flex-wrap gap-1.5">
              {overview && Object.entries(overview.byPlan).length === 0 && (
                <span className="text-xs text-slate-500">No users yet.</span>
              )}
              {overview && Object.entries(overview.byPlan).map(([planId, count]) => (
                <span key={planId} className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold ${isDark ? 'border-slate-700 bg-white/5' : 'border-slate-200 bg-slate-50'}`}>
                  {planId === 'none' ? 'No plan' : (plans.find(p => p.id === planId)?.name || planId)} · {count}
                </span>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 flex items-start gap-1.5">
              <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              {overview?.envFallbackActive
                ? 'Break-glass fallback is ACTIVE: addresses in the OWNER_EMAILS environment variable are always master admins, in addition to the Master Control list.'
                : 'Break-glass fallback is NOT configured (OWNER_EMAILS is empty) — the Master Control list is the only master-admin source. It fails closed: if the list is ever emptied, admin access is lost until the environment is fixed.'}
            </p>
          </div>

          <div className={`${cardCls} p-4`}>
            <div className="text-xs font-bold mb-2">Recent activity</div>
            {(overview?.recentAudit ?? []).length === 0 && (
              <div className="py-4 text-center text-xs text-slate-500">No audit entries yet.</div>
            )}
            <div className="space-y-1.5">
              {(overview?.recentAudit ?? []).map(entry => (
                <div key={entry.id} className={`flex flex-wrap items-baseline gap-x-3 px-3 py-2 rounded-lg border text-xs ${isDark ? 'border-slate-700/60' : 'border-slate-200'}`}>
                  <span className="text-slate-500 whitespace-nowrap">{new Date(entry.at).toLocaleString()}</span>
                  <span className="font-mono font-semibold">{entry.action}</span>
                  <span>{entry.target}</span>
                  <span className="text-slate-500">by {entry.actorEmail}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------ Users tab ------------------------------ */}
      {tab === 'users' && (
        <div className={`${cardCls} p-4 space-y-4`}>
          <div className={`p-3 rounded-xl border ${isDark ? 'border-slate-700/60 bg-slate-900/40' : 'border-slate-200 bg-slate-50'}`}>
            <div className="text-xs font-bold mb-2 flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> Create user</div>
            <div className="flex flex-wrap gap-2 items-center">
              <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="email@company.com" className={`${inputCls} w-52`} />
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Display name" className={`${inputCls} w-40`} />
              <select value={newPlanId || defaultPlanId} onChange={e => setNewPlanId(e.target.value)} className={inputCls}>
                {plans.map(p => <option key={p.id} value={p.id}>{p.name}{p.isDefault ? ' (default)' : ''}</option>)}
              </select>
              <select value={newRole} onChange={e => setNewRole(e.target.value)} className={inputCls}>
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
              <button onClick={handleCreateUser} className={`${btnCls} bg-violet-600 text-white hover:bg-violet-500`}>Create &amp; invite</button>
            </div>
            {inviteStatus && (
              <div className="mt-2 flex items-start gap-2 text-[11px] text-amber-500">
                <MailWarning className="w-3.5 h-3.5 shrink-0 mt-0.5" /> <span>{inviteStatus}</span>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-700/30">
                  <th className="py-2 pr-3">User</th>
                  <th className="py-2 pr-3">Title</th>
                  <th className="py-2 pr-3">Role</th>
                  <th className="py-2 pr-3">Plan</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Areas</th>
                  <th className="py-2 pr-3">Last sign-in</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <React.Fragment key={u.uid}>
                    <tr className="border-b border-slate-700/20">
                      <td className="py-2 pr-3">
                        <div className="font-semibold">{u.displayName}</div>
                        <div className="text-slate-500">{u.email}</div>
                      </td>
                      <td className="py-2 pr-3">
                        <select
                          value={customTitleUid === u.uid ? '__custom__' : (u.title || '')}
                          onChange={e => {
                            const v = e.target.value;
                            if (v === '__custom__') { setCustomTitleUid(u.uid); setCustomTitleText(u.title || ''); }
                            else { runAction(async () => { await apiService.patchAdminUser(u.uid, { title: v }); }, v ? 'Title updated' : 'Title cleared'); }
                          }}
                          className={inputCls}
                        >
                          <option value="">No title</option>
                          {titleSuggestions.map(t => <option key={t} value={t}>{t}</option>)}
                          <option value="__custom__">Custom title…</option>
                        </select>
                        {customTitleUid === u.uid && (
                          <div className="flex gap-1 mt-1">
                            <input value={customTitleText} onChange={e => setCustomTitleText(e.target.value)} placeholder="Custom title" maxLength={80} className={inputCls} />
                            <button onClick={() => { const t = customTitleText.trim(); if (!t) return; runAction(async () => { await apiService.patchAdminUser(u.uid, { title: t }); }, 'Title updated'); setCustomTitleUid(null); }} className="px-2 py-1 rounded bg-violet-600 text-white text-xs shrink-0">Save</button>
                          </div>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        <select
                          value={u.role === 'master_admin' ? 'master_admin' : u.role}
                          disabled={u.role === 'master_admin'}
                          onChange={e => runAction(async () => { await apiService.patchAdminUser(u.uid, { role: e.target.value }); }, 'Role updated')}
                          className={inputCls}
                          title={u.role === 'master_admin' ? 'Master admin is managed in the Master Control tab' : undefined}
                        >
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                          {u.role === 'master_admin' && <option value="master_admin">Master Admin</option>}
                        </select>
                      </td>
                      <td className="py-2 pr-3">
                        <select
                          value={u.planId || ''}
                          onChange={e => runAction(async () => { await apiService.patchAdminUser(u.uid, { planId: e.target.value || null }); }, 'Plan updated')}
                          className={inputCls}
                        >
                          <option value="">No plan</option>
                          {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </td>
                      <td className="py-2 pr-3">
                        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${STATUS_STYLES[u.status] || ''}`}>
                          {u.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-2 pr-3 tabular-nums">
                        {effectiveCount(u)}/{featureKeys.length}
                        {u.featureOverrides && Object.keys(u.featureOverrides).length > 0 && (
                          <span className="ml-1 text-[10px] text-violet-400" title="This user has per-user overrides">±</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-slate-500">{u.lastSignInAt ? new Date(u.lastSignInAt).toLocaleString() : '—'}</td>
                      <td className="py-2">
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            onClick={() => setAccessEditorUid(accessEditorUid === u.uid ? null : u.uid)}
                            className={`${btnCls} border ${accessEditorUid === u.uid ? 'border-violet-500 text-violet-400' : isDark ? 'border-slate-600 hover:bg-white/5' : 'border-slate-300 hover:bg-slate-100'} flex items-center gap-1`}
                          >
                            <KeySquare className="w-3 h-3" /> Access
                          </button>
                          {u.status === 'disabled' ? (
                            <button
                              onClick={() => runAction(async () => { await apiService.patchAdminUser(u.uid, { status: 'active' }); }, 'User re-enabled')}
                              className={`${btnCls} bg-emerald-600 text-white hover:bg-emerald-500`}
                            >
                              Enable
                            </button>
                          ) : (
                            <button
                              onClick={() => runAction(async () => { await apiService.patchAdminUser(u.uid, { status: 'disabled' }); }, 'User disabled')}
                              className={`${btnCls} border ${isDark ? 'border-slate-600 hover:bg-white/5' : 'border-slate-300 hover:bg-slate-100'}`}
                            >
                              Disable
                            </button>
                          )}
                          <button
                            onClick={() => handlePasswordReset(u)}
                            className={`${btnCls} border ${isDark ? 'border-slate-600 hover:bg-white/5' : 'border-slate-300 hover:bg-slate-100'}`}
                          >
                            Reset password
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u)}
                            className={`${btnCls} text-rose-500 border border-rose-500/40 hover:bg-rose-500/10 flex items-center gap-1`}
                          >
                            <Trash2 className="w-3 h-3" /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                    {accessEditorUid === u.uid && (
                      <tr className="border-b border-slate-700/20">
                        <td colSpan={7} className={`py-3 px-3 ${isDark ? 'bg-slate-900/40' : 'bg-slate-50'}`}>
                          {u.role === 'master_admin' ? (
                            <div className="text-[11px] text-slate-500">Master admins have every area; per-user overrides do not apply. Manage master admins in the Master Control tab.</div>
                          ) : (
                            <div className="space-y-1.5">
                              <div className="text-[11px] text-slate-500">
                                Per-area access for <span className="font-semibold">{u.email}</span> — plan: <span className="font-semibold">{planFor(u)?.name || 'none'}</span>.
                                Grants and revokes override the plan and take effect on the user&apos;s next request; every change is audit-logged.
                              </div>
                              <div className="grid sm:grid-cols-2 gap-1.5">
                                {featureKeys.map(k => {
                                  const planDefault = planFor(u)?.features?.[k] === true;
                                  const override = u.featureOverrides?.[k];
                                  const stateLabel = override === undefined
                                    ? `Plan default (${planDefault ? 'on' : 'off'})`
                                    : override ? 'Granted by override' : 'Revoked by override';
                                  return (
                                    <div key={k} className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border ${isDark ? 'border-slate-700/60' : 'border-slate-200'}`}>
                                      <div>
                                        <div className="font-semibold">{FEATURE_LABELS[k] || k}</div>
                                        <div className={`text-[10px] ${override === undefined ? 'text-slate-500' : 'text-violet-400'}`}>{stateLabel}</div>
                                      </div>
                                      <div className="flex gap-1">
                                        <button
                                          disabled={override === true}
                                          onClick={() => applyOverride(u, k, true)}
                                          className={`${btnCls} bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40`}
                                        >
                                          Grant
                                        </button>
                                        <button
                                          disabled={override === false}
                                          onClick={() => applyOverride(u, k, false)}
                                          className={`${btnCls} bg-rose-600 text-white hover:bg-rose-500 disabled:opacity-40`}
                                        >
                                          Revoke
                                        </button>
                                        <button
                                          disabled={override === undefined}
                                          onClick={() => applyOverride(u, k, null)}
                                          className={`${btnCls} border ${isDark ? 'border-slate-600 hover:bg-white/5' : 'border-slate-300 hover:bg-slate-100'} disabled:opacity-40`}
                                        >
                                          Plan default
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={7} className="py-6 text-center text-slate-500">No user records yet. Records appear when users sign in or are created here.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --------------------------- Approvals tab ----------------------------- */}
      {tab === 'approvals' && (
        <div className={`${cardCls} p-4 space-y-3`}>
          {requests.length === 0 && (
            <div className="py-6 text-center text-xs text-slate-500">No signups are waiting for approval.</div>
          )}
          {requests.map(u => (
            <div key={u.uid} className={`flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-xl border ${isDark ? 'border-slate-700/60 bg-slate-900/40' : 'border-slate-200 bg-slate-50'}`}>
              <div>
                <div className="text-xs font-bold">{u.displayName} <span className="font-normal text-slate-500">· {u.email}</span></div>
                <div className="text-[11px] text-slate-500">Signed up {new Date(u.createdAt).toLocaleString()}</div>
                {(u.accessRequest || u.organization) && (
                  <div className="text-[11px] text-slate-500">
                    Organization: <span className="font-semibold">{u.accessRequest?.organization || u.organization}</span>
                    {u.accessRequest?.requestedPlanId && (
                      <> · Requested plan: <span className="font-semibold">{plans.find(p => p.id === u.accessRequest?.requestedPlanId)?.name || u.accessRequest.requestedPlanId}</span></>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={approvalPlan[u.uid] || u.accessRequest?.requestedPlanId || defaultPlanId}
                  onChange={e => setApprovalPlan(prev => ({ ...prev, [u.uid]: e.target.value }))}
                  className={inputCls}
                >
                  {plans.map(p => <option key={p.id} value={p.id}>{p.name}{p.isDefault ? ' (default)' : ''}</option>)}
                </select>
                <button
                  onClick={() => runAction(async () => {
                    const res = await apiService.approveSignup(u.uid, approvalPlan[u.uid] || u.accessRequest?.requestedPlanId || defaultPlanId || undefined);
                    if (res.approvalEmail.status === 'not_configured') {
                      setNotice(`Approved ${u.email}, but the approval email was NOT sent — mailer not configured (RESEND_API_KEY missing).`);
                    }
                  }, `Approved ${u.email}`)}
                  className={`${btnCls} bg-emerald-600 text-white hover:bg-emerald-500`}
                >
                  Approve
                </button>
                <button
                  onClick={() => {
                    const note = window.prompt(`Reject ${u.email}? Optional note:`) ?? null;
                    if (note !== null) {
                      runAction(async () => { await apiService.rejectSignup(u.uid, note || undefined); }, `Rejected ${u.email}`);
                    }
                  }}
                  className={`${btnCls} text-rose-500 border border-rose-500/40 hover:bg-rose-500/10`}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ----------------------------- Plans tab ------------------------------- */}
      {tab === 'plans' && (
        <div className="grid md:grid-cols-[240px_1fr] gap-4">
          <div className={`${cardCls} p-3 space-y-2`}>
            {plans.map(p => (
              <button
                key={p.id}
                onClick={() => setEditingPlan({ ...p, features: { ...p.features }, limits: { ...p.limits } })}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  editingPlan?.id === p.id
                    ? 'bg-violet-600 text-white'
                    : isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-slate-100 hover:bg-slate-200'
                }`}
              >
                {p.name}
                {p.isDefault && <span className="ml-2 text-[10px] opacity-80">default</span>}
                <div className="font-normal opacity-70 text-[10px]">{p.id} · {p.limits.leadsPerMonth} leads/mo · {p.limits.seats} seat(s)</div>
              </button>
            ))}
            <div className="flex gap-1.5 pt-2">
              <input
                value={newPlanIdInput}
                onChange={e => setNewPlanIdInput(e.target.value)}
                placeholder="new-plan-id"
                className={`${inputCls} flex-1`}
              />
              <button
                onClick={() => {
                  const id = newPlanIdInput.trim().toLowerCase();
                  if (!id) return;
                  setEditingPlan({
                    id,
                    name: id,
                    priceNote: '',
                    features: Object.fromEntries(featureKeys.map(k => [k, false])),
                    limits: { leadsPerMonth: 0, campaignsActive: 0, seats: 1, callsPerMonth: 0 },
                    isDefault: false
                  });
                  setNewPlanIdInput('');
                }}
                className={`${btnCls} bg-violet-600 text-white hover:bg-violet-500 flex items-center gap-1`}
              >
                <Plus className="w-3 h-3" /> New
              </button>
            </div>
          </div>

          <div className={`${cardCls} p-4`}>
            {!editingPlan && <div className="py-8 text-center text-xs text-slate-500">Select a plan to edit its features and limits.</div>}
            {editingPlan && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2 items-center">
                  <input
                    value={editingPlan.name}
                    onChange={e => setEditingPlan({ ...editingPlan, name: e.target.value })}
                    className={`${inputCls} w-44`}
                    placeholder="Plan name"
                  />
                  <input
                    value={editingPlan.priceNote}
                    onChange={e => setEditingPlan({ ...editingPlan, priceNote: e.target.value })}
                    className={`${inputCls} w-44`}
                    placeholder="Price note (free text)"
                  />
                  <label className="flex items-center gap-1.5 text-xs">
                    <input
                      type="checkbox"
                      checked={editingPlan.isDefault}
                      onChange={e => setEditingPlan({ ...editingPlan, isDefault: e.target.checked })}
                    />
                    Default for new approvals
                  </label>
                </div>

                <div>
                  <div className="text-xs font-bold mb-2">Features</div>
                  <div className="grid sm:grid-cols-2 gap-1.5">
                    {featureKeys.map(k => (
                      <label key={k} className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs ${isDark ? 'border-slate-700/60' : 'border-slate-200'}`}>
                        <span>{FEATURE_LABELS[k] || k}</span>
                        <input
                          type="checkbox"
                          checked={editingPlan.features[k] === true}
                          onChange={e => setEditingPlan({ ...editingPlan, features: { ...editingPlan.features, [k]: e.target.checked } })}
                        />
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-bold mb-2">Limits</div>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {(['leadsPerMonth', 'campaignsActive', 'seats', 'callsPerMonth', 'sendsPerMonth'] as const).map(k => (
                      <label key={k} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-slate-500">{k}</span>
                        <input
                          type="number"
                          min={0}
                          value={editingPlan.limits[k] ?? 0}
                          onChange={e => setEditingPlan({ ...editingPlan, limits: { ...editingPlan.limits, [k]: Math.max(0, Number(e.target.value) || 0) } })}
                          className={`${inputCls} w-24`}
                        />
                      </label>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => runAction(async () => {
                    const saved = await apiService.savePlan(editingPlan);
                    setEditingPlan(saved);
                  }, `Plan "${editingPlan.name}" saved`)}
                  className={`${btnCls} bg-violet-600 text-white hover:bg-violet-500`}
                >
                  Save plan
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --------------------------- Master Control tab ---------------------- */}
      {tab === 'master' && (
        <div className={`${cardCls} p-4 space-y-4`}>
          <p className="text-xs text-slate-500 flex items-start gap-2">
            <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            Master admins can open this area and manage every account. The stored list below is editable;
            addresses from the <span className="font-mono">OWNER_EMAILS</span> environment variable are a break-glass
            fallback and can only be changed in the deployment environment. You cannot remove yourself, and the
            last master admin cannot be removed (the server returns 409).
          </p>

          <div className="space-y-1.5">
            {envAdmins.map(e => (
              <div key={`env-${e}`} className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs ${isDark ? 'border-slate-700/60' : 'border-slate-200'}`}>
                <span className="font-mono">{e}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full border border-cyan-500/40 text-cyan-500">OWNER_EMAILS env · read-only</span>
              </div>
            ))}
            {storedAdmins.map(e => (
              <div key={`stored-${e}`} className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs ${isDark ? 'border-slate-700/60' : 'border-slate-200'}`}>
                <span className="font-mono">{e}</span>
                <button
                  onClick={() => runAction(async () => {
                    const next = storedAdmins.filter(x => x !== e);
                    const res = await apiService.saveMasterAdmins(next);
                    setStoredAdmins(res.stored);
                    setEnvAdmins(res.env);
                  }, `Removed ${e}`)}
                  className={`${btnCls} text-rose-500 border border-rose-500/40 hover:bg-rose-500/10`}
                >
                  Remove
                </button>
              </div>
            ))}
            {envAdmins.length === 0 && storedAdmins.length === 0 && (
              <div className="text-xs text-rose-500">No master admins configured — admin routes fail closed until OWNER_EMAILS is set or an address is added.</div>
            )}
          </div>

          <div className="flex gap-2 items-center">
            <input
              value={newAdminEmail}
              onChange={e => setNewAdminEmail(e.target.value)}
              placeholder="new-admin@company.com"
              className={`${inputCls} w-64`}
            />
            <button
              onClick={() => runAction(async () => {
                const email = newAdminEmail.trim().toLowerCase();
                if (!email) return;
                const res = await apiService.saveMasterAdmins([...storedAdmins, email]);
                setStoredAdmins(res.stored);
                setEnvAdmins(res.env);
                setNewAdminEmail('');
              }, 'Master admin added')}
              className={`${btnCls} bg-violet-600 text-white hover:bg-violet-500 flex items-center gap-1`}
            >
              <Plus className="w-3 h-3" /> Add master admin
            </button>
          </div>
        </div>
      )}

      {/* --------------------------- Outreach Gates tab (Phase 7.1) ------------ */}
      {tab === 'outreach' && (
        <div className="space-y-4">
          <div className={`${cardCls} p-4`}>
            <div className="text-xs font-bold">Phase 7.1 outreach gates</div>
            <p className="text-[11px] text-slate-500 mt-1">
              Consent ledger, internal suppression list, and the fail-closed contact gate for email, voice, and SMS.
              For every business and industry. A healthcare practice is one example contact type, not the product.
              The US National DNC Registry is not queried from here: it requires paid registration. This gate uses
              the internal suppression list plus user-supplied CSV imports only, and every gate decision, consent
              change, and suppression change is audit-logged.
            </p>
            <div className="flex flex-wrap gap-1.5 mt-3">
              <span className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold ${isDark ? 'border-slate-700 bg-white/5' : 'border-slate-200 bg-slate-50'}`}>Consent records: {phase71?.counts?.consents ?? 0}</span>
              <span className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold ${isDark ? 'border-slate-700 bg-white/5' : 'border-slate-200 bg-slate-50'}`}>Active consents: {phase71?.counts?.activeConsents ?? 0}</span>
              <span className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold ${isDark ? 'border-slate-700 bg-white/5' : 'border-slate-200 bg-slate-50'}`}>Suppressions: {phase71?.counts?.suppressions ?? 0}</span>
            </div>
          </div>

          <div className={`${cardCls} p-4 space-y-3`}>
            <div className="text-xs font-bold">Check the gate for a contact</div>
            <div className="flex flex-wrap gap-2 items-center">
              <input value={gateContactId} onChange={e => setGateContactId(e.target.value)} placeholder="Contact ID" className={`${inputCls} w-40`} />
              <input value={gateEmail} onChange={e => setGateEmail(e.target.value)} placeholder="email@company.com" className={`${inputCls} w-52`} />
              <input value={gatePhone} onChange={e => setGatePhone(e.target.value)} placeholder="+1 phone" className={`${inputCls} w-40`} />
              <select value={gateLineType} onChange={e => setGateLineType(e.target.value)} className={inputCls}>
                <option value="mobile">Mobile</option>
                <option value="landline">Landline</option>
                <option value="unknown">Unknown line type</option>
              </select>
              <select value={gateChannel} onChange={e => setGateChannel(e.target.value)} className={inputCls}>
                <option value="voice">Voice</option>
                <option value="email">Email</option>
                <option value="sms">SMS</option>
              </select>
              <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={gateEmailVerified} onChange={e => setGateEmailVerified(e.target.checked)} /> Email verified</label>
              <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={gatePhoneVerified} onChange={e => setGatePhoneVerified(e.target.checked)} /> Phone verified</label>
              <button
                onClick={() => runAction(async () => {
                  const fieldVerifications = [
                    { field: 'email', verified: gateEmailVerified, provenance: 'admin gate check', verifiedAt: new Date().toISOString() },
                    { field: 'phone', verified: gatePhoneVerified, provenance: 'admin gate check', verifiedAt: new Date().toISOString() }
                  ];
                  const verdict = await apiService.checkPhase71Gate(
                    { id: gateContactId, email: gateEmail || null, phone: gatePhone || null, phoneLineType: gateLineType, fieldVerifications },
                    gateChannel
                  );
                  setGateResult(verdict);
                }, 'Gate checked')}
                className={`${btnCls} bg-violet-600 text-white hover:bg-violet-500`}
              >
                Check gate
              </button>
            </div>
            {gateResult && (
              <div className={`text-xs p-3 rounded-xl border ${gateResult.allowed ? 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10' : 'text-rose-500 border-rose-500/30 bg-rose-500/10'}`}>
                <span className="font-bold">{gateResult.allowed ? 'Allowed' : 'Blocked'}</span> ({gateResult.reasonCode}): {gateResult.reason}
              </div>
            )}
          </div>

          <div className={`${cardCls} p-4 space-y-3`}>
            <div className="text-xs font-bold">Consent ledger</div>
            <div className="flex flex-wrap gap-2 items-center">
              <input value={consentContactId} onChange={e => setConsentContactId(e.target.value)} placeholder="Contact ID" className={`${inputCls} w-40`} />
              <select value={consentChannel} onChange={e => { setConsentChannel(e.target.value); setConsentType(e.target.value === 'voice' ? 'pewc' : e.target.value === 'email' ? 'email_optin' : 'sms_optin'); }} className={inputCls}>
                <option value="voice">Voice</option>
                <option value="email">Email</option>
                <option value="sms">SMS</option>
              </select>
              <select value={consentType} onChange={e => setConsentType(e.target.value)} className={inputCls}>
                {consentChannel === 'voice' && (<><option value="pewc">Prior express written consent</option><option value="pec">Prior express consent</option></>)}
                {consentChannel === 'email' && (<option value="email_optin">Email opt-in</option>)}
                {consentChannel === 'sms' && (<option value="sms_optin">SMS opt-in</option>)}
              </select>
              <input value={consentSource} onChange={e => setConsentSource(e.target.value)} placeholder="Source, e.g. web form" className={`${inputCls} w-44`} />
              <button onClick={() => runAction(async () => { await apiService.grantPhase71Consent({ contactId: consentContactId, channel: consentChannel, type: consentType, source: consentSource }); }, 'Consent granted')} className={`${btnCls} bg-emerald-600 text-white hover:bg-emerald-500`}>Grant</button>
              <button onClick={() => runAction(async () => { await apiService.revokePhase71Consent({ contactId: consentContactId, source: consentSource || 'admin revoke' }); }, 'Consent revoked on all channels')} className={`${btnCls} text-rose-500 border border-rose-500/40 hover:bg-rose-500/10`}>Revoke all channels</button>
            </div>
            <div className="space-y-1">
              {(phase71?.consents ?? []).slice(0, 50).map((c: any) => (
                <div key={c.id} className={`flex flex-wrap gap-x-3 px-3 py-1.5 rounded-lg border text-xs ${isDark ? 'border-slate-700/60' : 'border-slate-200'}`}>
                  <span className="font-semibold">{c.contactId}</span>
                  <span>{c.channel} / {c.type}</span>
                  <span className="text-slate-500">from {c.source}</span>
                  <span className={c.revokedAt ? 'text-rose-500' : 'text-emerald-500'}>{c.revokedAt ? `revoked ${new Date(c.revokedAt).toLocaleString()}` : 'active'}</span>
                </div>
              ))}
              {(phase71?.consents ?? []).length === 0 && <div className="text-xs text-slate-500">No consent records yet.</div>}
            </div>
          </div>

          <div className={`${cardCls} p-4 space-y-3`}>
            <div className="text-xs font-bold">Suppression list</div>
            <div className="flex flex-wrap gap-2 items-center">
              <select value={suppType} onChange={e => setSuppType(e.target.value)} className={inputCls}>
                <option value="phone">Phone</option>
                <option value="email">Email</option>
                <option value="contact">Contact ID</option>
              </select>
              <input value={suppValue} onChange={e => setSuppValue(e.target.value)} placeholder="Phone, email, or contact ID" className={`${inputCls} w-52`} />
              <button onClick={() => runAction(async () => { await apiService.addPhase71Suppression({ identifierType: suppType, identifier: suppValue, reason: 'manual', source: 'admin' }); setSuppValue(''); }, 'Suppression added')} className={`${btnCls} bg-violet-600 text-white hover:bg-violet-500`}>Add</button>
            </div>
            <div className="space-y-1">
              {(phase71?.suppressions ?? []).slice(0, 100).map((s: any) => (
                <div key={s.id} className={`flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-lg border text-xs ${isDark ? 'border-slate-700/60' : 'border-slate-200'}`}>
                  <span><span className="font-semibold">{s.identifier}</span> <span className="text-slate-500">({s.identifierType}, {s.reason}, {s.source})</span></span>
                  <button onClick={() => runAction(async () => { await apiService.removePhase71Suppression(s.id); }, 'Suppression removed')} className={`${btnCls} text-rose-500 border border-rose-500/40 hover:bg-rose-500/10`}>Remove</button>
                </div>
              ))}
              {(phase71?.suppressions ?? []).length === 0 && <div className="text-xs text-slate-500">No suppressions yet.</div>}
            </div>
            <div className="space-y-2">
              <div className="text-xs font-bold">Import a DNC list (CSV of phone numbers, one per line)</div>
              <textarea value={suppCsv} onChange={e => setSuppCsv(e.target.value)} placeholder={"(555) 123-4567\n+1 555 987 6543"} rows={4} className={`${inputCls} w-full`} />
              <button onClick={() => runAction(async () => { const r = await apiService.importPhase71Suppressions(suppCsv, 'dnc_import'); setSuppCsv(''); setNotice(`Imported ${r.added} numbers, ${r.duplicates} duplicates skipped, ${r.errors.length} invalid lines.`); }, 'DNC list imported')} className={`${btnCls} bg-violet-600 text-white hover:bg-violet-500`}>Import CSV</button>
              <p className="text-[11px] text-slate-500">This is an internal list import only, not a live National DNC Registry lookup.</p>
            </div>
          </div>

          <div className={`${cardCls} p-4 space-y-3`}>
            <div className="text-xs font-bold">Phase 7.3 after-call automation</div>
            <p className="text-[11px] text-slate-500">
              Pipeline stage, follow-up task, and owner handoff summary for every completed call.
              Follow-up drafts are drafts only and are never sent from here. An opt-out from any
              channel stops all follow-ups for that lead, across email, voice, and text.
            </p>
            <div className="flex flex-wrap gap-1.5">
              <span className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold ${isDark ? 'border-slate-700 bg-white/5' : 'border-slate-200 bg-slate-50'}`}>Leads in pipeline: {phase73?.counts?.pipelineLeads ?? 0}</span>
              <span className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold ${isDark ? 'border-slate-700 bg-white/5' : 'border-slate-200 bg-slate-50'}`}>Pending tasks: {phase73?.counts?.pendingTasks ?? 0}</span>
              <span className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold ${isDark ? 'border-slate-700 bg-white/5' : 'border-slate-200 bg-slate-50'}`}>Drafts (unsent): {phase73?.counts?.drafts ?? 0}</span>
            </div>
            <div className="space-y-2">
              <div className="text-xs font-bold">Owner handoff summaries</div>
              {(phase73?.ownerSummaries ?? []).slice(0, 50).map((s: any) => (
                <div key={s.contactId} className={`px-3 py-2 rounded-lg border text-xs ${isDark ? 'border-slate-700/60' : 'border-slate-200'}`}>
                  <div><span className="font-semibold">{s.contactName}</span> at {s.businessName}</div>
                  <div className="text-slate-500">Cares about: {s.painPoint}</div>
                  <div className="text-slate-500">Proof offered: {s.proofOffered}</div>
                  <div className="text-slate-500">Agreed: {s.agreed || 'Nothing agreed yet.'}</div>
                  <div>Next action for {s.ownerName}: {s.nextAction}</div>
                </div>
              ))}
              {(phase73?.ownerSummaries ?? []).length === 0 && <div className="text-xs text-slate-500">No transferred leads yet.</div>}
            </div>
            <div className="space-y-2">
              <div className="text-xs font-bold">Pending follow-up tasks</div>
              {(phase73?.tasks ?? []).filter((t: any) => t.status === 'pending').slice(0, 50).map((t: any) => (
                <div key={t.id} className={`px-3 py-1.5 rounded-lg border text-xs ${isDark ? 'border-slate-700/60' : 'border-slate-200'}`}>
                  <span className="font-semibold">{t.title}</span> <span className="text-slate-500">due {new Date(t.dueAt).toLocaleString()}</span>
                </div>
              ))}
              {(phase73?.tasks ?? []).filter((t: any) => t.status === 'pending').length === 0 && <div className="text-xs text-slate-500">No pending follow-up tasks.</div>}
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <input value={optOutContactId} onChange={e => setOptOutContactId(e.target.value)} placeholder="Contact ID to opt out" className={`${inputCls} w-52`} />
              <button onClick={() => runAction(async () => { await apiService.applyPhase73OptOut({ contactId: optOutContactId, source: 'admin opt-out' }); setOptOutContactId(''); }, 'Opt-out applied on all channels')} className={`${btnCls} text-rose-500 border border-rose-500/40 hover:bg-rose-500/10`}>Opt out on all channels</button>
            </div>
          </div>

          <div className={`${cardCls} p-4 space-y-3`}>
            <div className="text-xs font-bold">Phase 7.4 owner dashboard</div>
            <p className="text-[11px] text-slate-500">
              At a glance: leads handed to you, hot leads, leads waiting for a callback, and
              leads stuck with no next step. Marking a lead won or lost stops its automatic
              follow-ups. Every action here is logged and can be undone. Follow-up drafts
              stay drafts and are never sent from here. No revenue figure is shown unless
              you entered it yourself.
            </p>
            <div className="flex flex-wrap gap-1.5">
              <span className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold ${isDark ? 'border-slate-700 bg-white/5' : 'border-slate-200 bg-slate-50'}`}>Handed to you: {phase74?.counts?.handedOver ?? 0}</span>
              <span className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold ${isDark ? 'border-slate-700 bg-white/5' : 'border-slate-200 bg-slate-50'}`}>Hot: {phase74?.counts?.hot ?? 0}</span>
              <span className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold ${isDark ? 'border-slate-700 bg-white/5' : 'border-slate-200 bg-slate-50'}`}>Waiting for callback: {phase74?.counts?.waitingCallback ?? 0}</span>
              <span className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold ${isDark ? 'border-slate-700 bg-white/5' : 'border-slate-200 bg-slate-50'}`}>Stuck: {phase74?.counts?.stuck ?? 0}</span>
              <span className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold ${isDark ? 'border-slate-700 bg-white/5' : 'border-slate-200 bg-slate-50'}`}>Won: {phase74?.counts?.won ?? 0}</span>
              <span className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold ${isDark ? 'border-slate-700 bg-white/5' : 'border-slate-200 bg-slate-50'}`}>Lost: {phase74?.counts?.lost ?? 0}</span>
              <span className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold ${isDark ? 'border-slate-700 bg-white/5' : 'border-slate-200 bg-slate-50'}`}>Opted out: {phase74?.counts?.optedOut ?? 0}</span>
            </div>
            {(Object.entries({ handedOver: 'Handed to you', hot: 'Hot leads', waitingCallback: 'Waiting for callback', stuck: 'Stuck, no next step' }) as [string, string][]).map(([key, label]) => (
              <div key={key} className="space-y-2">
                <div className="text-xs font-bold">{label}</div>
                {(phase74?.[key] ?? []).slice(0, 50).map((l: any) => (
                  <div key={l.contactId} className={`px-3 py-2 rounded-lg border text-xs ${isDark ? 'border-slate-700/60' : 'border-slate-200'}`}>
                    <div><span className="font-semibold">{l.contactName || l.contactId}</span>{l.businessName ? ` at ${l.businessName}` : ''}</div>
                    {l.painPoint && <div className="text-slate-500">Cares about: {l.painPoint}</div>}
                    {l.proofOffered && <div className="text-slate-500">Proof offered: {l.proofOffered}</div>}
                    <div className="text-slate-500">Agreed: {l.agreed || 'Nothing agreed yet.'}</div>
                    {l.nextAction && <div>Next action: {l.nextAction}</div>}
                    {l.pendingTasks?.length > 0 && <div className="text-slate-500">Follow-up due: {new Date(l.pendingTasks[0].dueAt).toLocaleString()}</div>}
                    {l.drafts?.length > 0 && <div className="text-slate-500">Draft ready to review (not sent): {l.drafts.length}</div>}
                  </div>
                ))}
                {(phase74?.[key] ?? []).length === 0 && <div className="text-xs text-slate-500">None here.</div>}
              </div>
            ))}
            <div className="flex flex-wrap gap-2 items-center">
              <input value={outcomeContactId} onChange={e => setOutcomeContactId(e.target.value)} placeholder="Contact ID" className={`${inputCls} w-52`} />
              <input value={outcomeReason} onChange={e => setOutcomeReason(e.target.value)} placeholder="Short reason (optional)" className={`${inputCls} w-52`} />
              <button onClick={() => runAction(async () => { await apiService.markPhase74Outcome({ contactId: outcomeContactId, outcome: 'closed_won', reason: outcomeReason }); setOutcomeContactId(''); setOutcomeReason(''); }, 'Lead marked won, follow-ups stopped')} className={`${btnCls} text-emerald-500 border border-emerald-500/40 hover:bg-emerald-500/10`}>Mark won</button>
              <button onClick={() => runAction(async () => { await apiService.markPhase74Outcome({ contactId: outcomeContactId, outcome: 'closed_lost', reason: outcomeReason }); setOutcomeContactId(''); setOutcomeReason(''); }, 'Lead marked lost, follow-ups stopped')} className={`${btnCls} text-rose-500 border border-rose-500/40 hover:bg-rose-500/10`}>Mark lost</button>
            </div>
            <p className="text-[11px] text-slate-500">Won and lost leads can be reopened from the audit log action record; reopening restores the previous stage and its follow-up tasks.</p>
          </div>
        </div>
      )}

      {/* ----------------------------- Audit tab ------------------------------- */}
      {tab === 'audit' && (
        <div className={`${cardCls} p-4 overflow-x-auto`}>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-700/30">
                <th className="py-2 pr-3">When</th>
                <th className="py-2 pr-3">Actor</th>
                <th className="py-2 pr-3">Action</th>
                <th className="py-2 pr-3">Target</th>
                <th className="py-2">Details</th>
              </tr>
            </thead>
            <tbody>
              {audit.map(entry => (
                <tr key={entry.id} className="border-b border-slate-700/20">
                  <td className="py-2 pr-3 whitespace-nowrap text-slate-500">{new Date(entry.at).toLocaleString()}</td>
                  <td className="py-2 pr-3">{entry.actorEmail}</td>
                  <td className="py-2 pr-3 font-mono">{entry.action}</td>
                  <td className="py-2 pr-3">{entry.target}</td>
                  <td className="py-2 text-slate-500">{entry.details}</td>
                </tr>
              ))}
              {audit.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-slate-500">No audit entries yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
