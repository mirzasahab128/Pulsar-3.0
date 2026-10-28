import React, { useCallback, useEffect, useState } from 'react';
import {
  ShieldCheck,
  Users,
  UserCheck,
  Layers,
  KeyRound,
  ScrollText,
  Plus,
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  MailWarning,
  Lock
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import {
  apiService,
  PlatformPlan,
  PlatformUserRecord,
  AuditLogEntry
} from '../services/api';

type AdminTab = 'users' | 'approvals' | 'plans' | 'master' | 'audit';

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

export const AdminAccessControlCenter: React.FC = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [tab, setTab] = useState<AdminTab>('users');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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

  // Plan editor
  const [editingPlan, setEditingPlan] = useState<PlatformPlan | null>(null);
  const [newPlanIdInput, setNewPlanIdInput] = useState('');

  // Master admin editor
  const [storedAdmins, setStoredAdmins] = useState<string[]>([]);
  const [envAdmins, setEnvAdmins] = useState<string[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');

  // Approval plan picks (uid -> planId)
  const [approvalPlan, setApprovalPlan] = useState<Record<string, string>>({});

  const cardCls = `rounded-2xl border backdrop-blur-xl ${
    isDark ? 'bg-[#111C2E]/90 border-slate-700/40 text-[#F1F5F9]' : 'bg-white/95 border-[#DCE5EC] text-[#172338] shadow-sm'
  }`;
  const inputCls = `px-2.5 py-1.5 rounded-lg border text-xs outline-none ${
    isDark ? 'bg-slate-900/60 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-800'
  }`;
  const btnCls = 'px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer';

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [u, r, p, a, m] = await Promise.all([
        apiService.getAdminUsers(),
        apiService.getSignupRequests(),
        apiService.getPlans(),
        apiService.getAuditLog(100),
        apiService.getMasterAdmins()
      ]);
      setUsers(u);
      setRequests(r);
      setPlans(p.plans);
      setFeatureKeys(p.featureKeys);
      setAudit(a);
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

  const tabs: Array<{ id: AdminTab; label: string; icon: React.ComponentType<{ className?: string }>; count?: number }> = [
    { id: 'users', label: 'Users', icon: Users, count: users.length },
    { id: 'approvals', label: 'Signup Approvals', icon: UserCheck, count: requests.length },
    { id: 'plans', label: 'Plans & Access', icon: Layers },
    { id: 'master', label: 'Master Admin', icon: KeyRound },
    { id: 'audit', label: 'Audit Log', icon: ScrollText }
  ];

  return (
    <div className="space-y-5">
      <div className={`${cardCls} p-4`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-violet-400" />
            <div>
              <h2 className="text-sm font-bold">Admin Access Control Center</h2>
              <p className="text-[11px] text-slate-500">Users, signup approvals, plans, master admins, and the audit trail. Every action here is enforced server-side and audit-logged.</p>
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
                    ? 'bg-violet-600 text-white shadow'
                    : isDark ? 'bg-white/5 text-slate-300 hover:bg-white/10' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
                  <th className="py-2 pr-3">Role</th>
                  <th className="py-2 pr-3">Plan</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Last sign-in</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.uid} className="border-b border-slate-700/20">
                    <td className="py-2 pr-3">
                      <div className="font-semibold">{u.displayName}</div>
                      <div className="text-slate-500">{u.email}</div>
                    </td>
                    <td className="py-2 pr-3">
                      <select
                        value={u.role === 'master_admin' ? 'master_admin' : u.role}
                        disabled={u.role === 'master_admin'}
                        onChange={e => runAction(async () => { await apiService.patchAdminUser(u.uid, { role: e.target.value }); }, 'Role updated')}
                        className={inputCls}
                        title={u.role === 'master_admin' ? 'Master admin is managed in the Master Admin tab' : undefined}
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
                    <td className="py-2 pr-3 text-slate-500">{u.lastSignInAt ? new Date(u.lastSignInAt).toLocaleString() : '—'}</td>
                    <td className="py-2">
                      <div className="flex gap-1.5">
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
                          onClick={() => {
                            if (window.confirm(`Delete the platform record for ${u.email}? (Their Firebase sign-in account itself is not deleted.)`)) {
                              runAction(async () => { await apiService.deleteAdminUser(u.uid); }, 'User record deleted');
                            }
                          }}
                          className={`${btnCls} text-rose-500 border border-rose-500/40 hover:bg-rose-500/10 flex items-center gap-1`}
                        >
                          <Trash2 className="w-3 h-3" /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={6} className="py-6 text-center text-slate-500">No user records yet. Records appear when users sign in or are created here.</td></tr>
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
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={approvalPlan[u.uid] || defaultPlanId}
                  onChange={e => setApprovalPlan(prev => ({ ...prev, [u.uid]: e.target.value }))}
                  className={inputCls}
                >
                  {plans.map(p => <option key={p.id} value={p.id}>{p.name}{p.isDefault ? ' (default)' : ''}</option>)}
                </select>
                <button
                  onClick={() => runAction(async () => {
                    const res = await apiService.approveSignup(u.uid, approvalPlan[u.uid] || defaultPlanId || undefined);
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
                    {(['leadsPerMonth', 'campaignsActive', 'seats', 'callsPerMonth'] as const).map(k => (
                      <label key={k} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-slate-500">{k}</span>
                        <input
                          type="number"
                          min={0}
                          value={editingPlan.limits[k]}
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

      {/* --------------------------- Master Admin tab ------------------------ */}
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
