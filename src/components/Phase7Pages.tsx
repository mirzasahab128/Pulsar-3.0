import React, { useCallback, useEffect, useState } from 'react';
import { apiService } from '../services/api';

// Separate pages for the three visible 3.0 sidebar items. Previously these
// items all landed on the Admin Command Center Outreach Gates tab. Each page
// below loads only its own Phase 7 overview through the existing apiService
// methods and calls the same server actions as Admin Command Center. No
// sending or calling logic is duplicated here: drafts stay drafts, and the
// server is the only place that decides a gate, an outcome, or a snooze.
// The look reuses the existing pv theme tokens, so no colour scheme changes.

const cardCls = 'pv-card rounded-2xl border border-[var(--pv-border)] bg-[var(--pv-card)] text-[var(--pv-ink)] p-4 min-w-0';
const inputCls = 'w-full sm:w-auto px-3 py-2.5 rounded-lg border border-[var(--pv-border)] bg-[var(--pv-card-soft)] text-[var(--pv-ink)] text-sm outline-none focus:border-[var(--pv-accent)] min-h-[48px]';
const btnCls = 'px-4 py-2.5 rounded-lg text-sm font-semibold transition cursor-pointer min-h-[48px] inline-flex items-center justify-center';
const pillCls = 'px-2.5 py-1 rounded-full border border-[var(--pv-border)] bg-[var(--pv-card-soft)] text-[11px] font-semibold whitespace-nowrap';

function PageShell(props: { title: string; intro: string; error: string | null; notice: string | null; loading: boolean; onRefresh: () => void; children: React.ReactNode }) {
  return (
    <div className="space-y-4 min-w-0 w-full">
      <div className={`${cardCls}`}>
        <h1 className="text-lg sm:text-xl font-bold break-words">{props.title}</h1>
        <p className="text-sm text-[var(--pv-muted)] mt-1 break-words">{props.intro}</p>
        <div className="flex flex-wrap gap-2 mt-3">
          <button onClick={props.onRefresh} className={`${btnCls} bg-[var(--pv-green)] text-white hover:brightness-110`}>Refresh</button>
          {props.loading && <span className="text-sm text-[var(--pv-muted)] self-center">Loading...</span>}
        </div>
        {props.error && <div className="text-sm p-3 rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-500 mt-3 break-words">{props.error}</div>}
        {props.notice && <div className="text-sm p-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-500 mt-3 break-words">{props.notice}</div>}
      </div>
      {props.children}
    </div>
  );
}

function CountRow(props: { counts: Record<string, number | undefined> }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {Object.entries(props.counts).map(([label, value]) => (
        <span key={label} className={pillCls}>{label}: {value ?? 0}</span>
      ))}
    </div>
  );
}

function FieldRow(props: { children: React.ReactNode }) {
  return <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:items-center">{props.children}</div>;
}

export function ConsentGatesPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
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

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await apiService.getPhase71Overview()); } catch (e: any) { setError(e?.message || 'Failed to load consent gates'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const run = async (fn: () => Promise<void>, msg?: string) => {
    setError(null); setNotice(null);
    try { await fn(); if (msg) setNotice(msg); await load(); } catch (e: any) { setError(e?.message || 'Action failed'); }
  };

  return (
    <PageShell title="Consent Gates" intro="Who can be contacted, on which channel, and who must never be contacted again. The gate is fail-closed: if consent is missing, unverified, revoked, or suppressed, contact is blocked. An opt-out stops email, voice, and text at once." error={error} notice={notice} loading={loading} onRefresh={load}>
      <div className={cardCls}>
        <div className="text-sm font-bold">At a glance</div>
        <div className="mt-3"><CountRow counts={{ 'Consent records': data?.counts?.consents, 'Active consents': data?.counts?.activeConsents, 'Suppressions': data?.counts?.suppressions }} /></div>
        <p className="text-xs text-[var(--pv-muted)] mt-3 break-words">The US National DNC Registry is not queried from here. It requires paid registration. This gate uses the internal suppression list plus lists you import yourself, and every decision is recorded.</p>
      </div>
      <div className={cardCls}>
        <div className="text-sm font-bold">Check the gate for a contact</div>
        <p className="text-xs text-[var(--pv-muted)] mt-1 break-words">This check only evaluates. It never sends or calls anyone.</p>
        <div className="mt-3 space-y-2">
          <FieldRow>
            <input value={gateContactId} onChange={e => setGateContactId(e.target.value)} placeholder="Contact ID" className={inputCls} />
            <input value={gateEmail} onChange={e => setGateEmail(e.target.value)} placeholder="email@company.com" className={inputCls} />
            <input value={gatePhone} onChange={e => setGatePhone(e.target.value)} placeholder="+1 phone" className={inputCls} />
          </FieldRow>
          <FieldRow>
            <select value={gateLineType} onChange={e => setGateLineType(e.target.value)} className={inputCls}><option value="mobile">Mobile</option><option value="landline">Landline</option><option value="unknown">Unknown line type</option></select>
            <select value={gateChannel} onChange={e => setGateChannel(e.target.value)} className={inputCls}><option value="voice">Voice</option><option value="email">Email</option><option value="sms">SMS</option></select>
            <label className="flex items-center gap-2 text-sm min-h-[48px]"><input type="checkbox" checked={gateEmailVerified} onChange={e => setGateEmailVerified(e.target.checked)} /> Email verified</label>
            <label className="flex items-center gap-2 text-sm min-h-[48px]"><input type="checkbox" checked={gatePhoneVerified} onChange={e => setGatePhoneVerified(e.target.checked)} /> Phone verified</label>
            <button onClick={() => run(async () => {
              const verdict = await apiService.checkPhase71Gate({ id: gateContactId, email: gateEmail || null, phone: gatePhone || null, phoneLineType: gateLineType, fieldVerifications: [{ field: 'email', verified: gateEmailVerified, provenance: 'admin gate check', verifiedAt: new Date().toISOString() }, { field: 'phone', verified: gatePhoneVerified, provenance: 'admin gate check', verifiedAt: new Date().toISOString() }] }, gateChannel);
              setGateResult(verdict);
            }, 'Gate checked')} className={`${btnCls} bg-violet-600 text-white hover:bg-violet-500`}>Check gate</button>
          </FieldRow>
          {gateResult && <div className={`text-sm p-3 rounded-xl border break-words ${gateResult.allowed ? 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10' : 'text-rose-500 border-rose-500/30 bg-rose-500/10'}`}><span className="font-bold">{gateResult.allowed ? 'Allowed' : 'Blocked'}</span> ({gateResult.reasonCode}): {gateResult.reason}</div>}
        </div>
      </div>
      <div className={cardCls}>
        <div className="text-sm font-bold">Consent ledger</div>
        <div className="mt-3 space-y-2">
          <FieldRow>
            <input value={consentContactId} onChange={e => setConsentContactId(e.target.value)} placeholder="Contact ID" className={inputCls} />
            <select value={consentChannel} onChange={e => { setConsentChannel(e.target.value); setConsentType(e.target.value === 'voice' ? 'pewc' : e.target.value === 'email' ? 'email_optin' : 'sms_optin'); }} className={inputCls}><option value="voice">Voice</option><option value="email">Email</option><option value="sms">SMS</option></select>
            <select value={consentType} onChange={e => setConsentType(e.target.value)} className={inputCls}>
              {consentChannel === 'voice' && (<><option value="pewc">Prior express written consent</option><option value="pec">Prior express consent</option></>)}
              {consentChannel === 'email' && (<option value="email_optin">Email opt-in</option>)}
              {consentChannel === 'sms' && (<option value="sms_optin">SMS opt-in</option>)}
            </select>
            <input value={consentSource} onChange={e => setConsentSource(e.target.value)} placeholder="Source, e.g. web form" className={inputCls} />
          </FieldRow>
          <FieldRow>
            <button onClick={() => run(async () => { await apiService.grantPhase71Consent({ contactId: consentContactId, channel: consentChannel, type: consentType, source: consentSource }); }, 'Consent granted')} className={`${btnCls} bg-emerald-600 text-white hover:bg-emerald-500`}>Grant</button>
            <button onClick={() => run(async () => { await apiService.revokePhase71Consent({ contactId: consentContactId, source: consentSource || 'admin revoke' }); }, 'Consent revoked on all channels')} className={`${btnCls} text-rose-500 border border-rose-500/40 hover:bg-rose-500/10`}>Revoke all channels</button>
          </FieldRow>
          <div className="space-y-1">
            {(data?.consents ?? []).slice(0, 50).map((c: any) => (
              <div key={c.id} className="flex flex-col sm:flex-row sm:flex-wrap gap-x-3 px-3 py-2 rounded-lg border border-[var(--pv-border)] text-sm break-words"><span className="font-semibold">{c.contactId}</span><span>{c.channel} / {c.type}</span><span className="text-[var(--pv-muted)]">from {c.source}</span><span className={c.revokedAt ? 'text-rose-500' : 'text-emerald-500'}>{c.revokedAt ? `revoked ${new Date(c.revokedAt).toLocaleString()}` : 'active'}</span></div>
            ))}
            {(data?.consents ?? []).length === 0 && <div className="text-sm text-[var(--pv-muted)]">No consent records yet.</div>}
          </div>
        </div>
      </div>
      <div className={cardCls}>
        <div className="text-sm font-bold">Suppression list</div>
        <p className="text-xs text-[var(--pv-muted)] mt-1 break-words">Anyone on this list is blocked on every channel, even if a consent record still exists.</p>
        <div className="mt-3 space-y-2">
          <FieldRow>
            <select value={suppType} onChange={e => setSuppType(e.target.value)} className={inputCls}><option value="phone">Phone</option><option value="email">Email</option><option value="contact">Contact ID</option></select>
            <input value={suppValue} onChange={e => setSuppValue(e.target.value)} placeholder="Phone, email, or contact ID" className={inputCls} />
            <button onClick={() => run(async () => { await apiService.addPhase71Suppression({ identifierType: suppType, identifier: suppValue, reason: 'manual', source: 'admin' }); setSuppValue(''); }, 'Suppression added')} className={`${btnCls} bg-violet-600 text-white hover:bg-violet-500`}>Add</button>
          </FieldRow>
          <div className="space-y-1">
            {(data?.suppressions ?? []).slice(0, 100).map((s: any) => (
              <div key={s.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-3 py-2 rounded-lg border border-[var(--pv-border)] text-sm break-words"><span><span className="font-semibold">{s.identifier}</span> <span className="text-[var(--pv-muted)]">({s.identifierType}, {s.reason}, {s.source})</span></span><button onClick={() => run(async () => { await apiService.removePhase71Suppression(s.id); }, 'Suppression removed')} className={`${btnCls} text-rose-500 border border-rose-500/40 hover:bg-rose-500/10`}>Remove</button></div>
            ))}
            {(data?.suppressions ?? []).length === 0 && <div className="text-sm text-[var(--pv-muted)]">No suppressions yet.</div>}
          </div>
          <div className="text-sm font-bold pt-2">Import a DNC list (CSV of phone numbers, one per line)</div>
          <textarea value={suppCsv} onChange={e => setSuppCsv(e.target.value)} placeholder={"(555) 123-4567\n+1 555 987 6543"} rows={4} className="w-full px-3 py-2.5 rounded-lg border border-[var(--pv-border)] bg-[var(--pv-card-soft)] text-[var(--pv-ink)] text-sm outline-none" />
          <button onClick={() => run(async () => { const r = await apiService.importPhase71Suppressions(suppCsv, 'dnc_import'); setSuppCsv(''); setNotice(`Imported ${r.added} numbers, ${r.duplicates} duplicates skipped, ${r.errors.length} invalid lines.`); }, 'DNC list imported')} className={`${btnCls} bg-violet-600 text-white hover:bg-violet-500`}>Import CSV</button>
          <p className="text-xs text-[var(--pv-muted)]">This is an internal list import only, not a live National DNC Registry lookup.</p>
        </div>
      </div>
    </PageShell>
  );
}

export function AfterCallPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [optOutContactId, setOptOutContactId] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await apiService.getPhase73Overview()); } catch (e: any) { setError(e?.message || 'Failed to load after-call follow-up'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const run = async (fn: () => Promise<void>, msg?: string) => {
    setError(null); setNotice(null);
    try { await fn(); if (msg) setNotice(msg); await load(); } catch (e: any) { setError(e?.message || 'Action failed'); }
  };
  const pipeline = data?.pipeline ?? {};
  const pendingTasks = (data?.tasks ?? []).filter((t: any) => t.status === 'pending');
  return (
    <PageShell title="After-call follow-up" intro="What happens after a call ends, without anyone having to remember it. A lead moves to the right stage, a short summary is prepared for the owner, a follow-up is booked, and a draft is prepared but never sent from here. An opt-out stops everything." error={error} notice={notice} loading={loading} onRefresh={load}>
      <div className={cardCls}>
        <div className="text-sm font-bold">At a glance</div>
        <div className="mt-3"><CountRow counts={{ 'Leads in pipeline': data?.counts?.pipelineLeads, 'Pending tasks': data?.counts?.pendingTasks, 'Drafts (unsent)': data?.counts?.drafts, 'Owner summaries': data?.counts?.ownerSummaries }} /></div>
      </div>
      <div className={cardCls}>
        <div className="text-sm font-bold">Pipeline stages</div>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {Object.entries(pipeline).length === 0 && <div className="text-sm text-[var(--pv-muted)]">No leads in the pipeline yet.</div>}
          {Object.entries(pipeline).map(([contactId, stage]) => (
            <div key={contactId} className="px-3 py-2 rounded-lg border border-[var(--pv-border)] text-sm break-words"><span className="font-semibold">{contactId}</span><span className="text-[var(--pv-muted)]">: {String(stage)}</span></div>
          ))}
        </div>
      </div>
      <div className={cardCls}>
        <div className="text-sm font-bold">Owner handoff summaries</div>
        <div className="mt-3 space-y-2">
          {(data?.ownerSummaries ?? []).slice(0, 50).map((s: any) => (
            <div key={s.contactId} className="px-3 py-2 rounded-lg border border-[var(--pv-border)] text-sm break-words"><div><span className="font-semibold">{s.contactName}</span> at {s.businessName}</div><div className="text-[var(--pv-muted)]">Cares about: {s.painPoint}</div><div className="text-[var(--pv-muted)]">Proof offered: {s.proofOffered}</div><div className="text-[var(--pv-muted)]">Agreed: {s.agreed || 'Nothing agreed yet.'}</div><div>Next action for {s.ownerName}: {s.nextAction}</div></div>
          ))}
          {(data?.ownerSummaries ?? []).length === 0 && <div className="text-sm text-[var(--pv-muted)]">No transferred leads yet.</div>}
        </div>
      </div>
      <div className={cardCls}>
        <div className="text-sm font-bold">Pending follow-up tasks</div>
        <div className="mt-3 space-y-1">
          {pendingTasks.slice(0, 50).map((t: any) => (
            <div key={t.id} className="px-3 py-2 rounded-lg border border-[var(--pv-border)] text-sm break-words"><span className="font-semibold">{t.title}</span> <span className="text-[var(--pv-muted)]">due {new Date(t.dueAt).toLocaleString()}</span></div>
          ))}
          {pendingTasks.length === 0 && <div className="text-sm text-[var(--pv-muted)]">No pending follow-up tasks.</div>}
        </div>
      </div>
      <div className={cardCls}>
        <div className="text-sm font-bold">Draft follow-ups (never sent from here)</div>
        <p className="text-xs text-[var(--pv-muted)] mt-1 break-words">Drafts need a human approval step before anything is ever sent. This page only shows them.</p>
        <div className="mt-3 space-y-2">
          {(data?.drafts ?? []).slice(0, 50).map((d: any) => (
            <div key={d.id} className="px-3 py-2 rounded-lg border border-[var(--pv-border)] text-sm break-words"><div><span className="font-semibold">{d.contactId}</span> <span className="text-[var(--pv-muted)]">({d.channel}, draft, not sent)</span></div>{d.subject && <div>Subject: {d.subject}</div>}<div className="text-[var(--pv-muted)]">{d.body}</div></div>
          ))}
          {(data?.drafts ?? []).length === 0 && <div className="text-sm text-[var(--pv-muted)]">No drafts yet.</div>}
        </div>
      </div>
      <div className={cardCls}>
        <div className="text-sm font-bold">Opt out on all channels</div>
        <div className="mt-3"><FieldRow>
          <input value={optOutContactId} onChange={e => setOptOutContactId(e.target.value)} placeholder="Contact ID to opt out" className={inputCls} />
          <button onClick={() => run(async () => { await apiService.applyPhase73OptOut({ contactId: optOutContactId, source: 'admin opt-out' }); setOptOutContactId(''); }, 'Opt-out applied on all channels')} className={`${btnCls} text-rose-500 border border-rose-500/40 hover:bg-rose-500/10`}>Opt out on all channels</button>
        </FieldRow></div>
      </div>
    </PageShell>
  );
}

export function OwnerDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [outcomeContactId, setOutcomeContactId] = useState('');
  const [outcomeReason, setOutcomeReason] = useState('');
  const [snoozeTaskId, setSnoozeTaskId] = useState('');
  const [snoozeDue, setSnoozeDue] = useState('');
  const [nextStepContactId, setNextStepContactId] = useState('');
  const [nextStepText, setNextStepText] = useState('');
  const [reopenActionId, setReopenActionId] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await apiService.getPhase74Dashboard()); } catch (e: any) { setError(e?.message || 'Failed to load owner dashboard'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const run = async (fn: () => Promise<void>, msg?: string) => {
    setError(null); setNotice(null);
    try { await fn(); if (msg) setNotice(msg); await load(); } catch (e: any) { setError(e?.message || 'Action failed'); }
  };
  const lists: [string, string][] = [['handedOver', 'Handed to you'], ['hot', 'Hot leads'], ['waitingCallback', 'Waiting for callback'], ['stuck', 'Stuck, no next step'], ['won', 'Won'], ['lost', 'Lost'], ['optedOut', 'Opted out']];
  return (
    <PageShell title="Owner dashboard" intro="Everything that needs the owner, in one place. Marking a lead won or lost stops its automatic follow-ups. Every action here is logged and can be undone. No revenue figure is shown unless you entered it yourself." error={error} notice={notice} loading={loading} onRefresh={load}>
      <div className={cardCls}>
        <div className="text-sm font-bold">At a glance</div>
        <div className="mt-3"><CountRow counts={{ 'Handed to you': data?.counts?.handedOver, 'Hot': data?.counts?.hot, 'Waiting for callback': data?.counts?.waitingCallback, 'Stuck': data?.counts?.stuck, 'Won': data?.counts?.won, 'Lost': data?.counts?.lost, 'Opted out': data?.counts?.optedOut }} /></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {lists.map(([key, label]) => (
          <div key={key} className={cardCls}>
            <div className="text-sm font-bold">{label}</div>
            <div className="mt-3 space-y-2">
              {(data?.[key] ?? []).slice(0, 50).map((l: any) => (
                <div key={l.contactId} className="px-3 py-2 rounded-lg border border-[var(--pv-border)] text-sm break-words">
                  <div><span className="font-semibold">{l.contactName || l.contactId}</span>{l.businessName ? ` at ${l.businessName}` : ''}</div>
                  {l.painPoint && <div className="text-[var(--pv-muted)]">Cares about: {l.painPoint}</div>}
                  {l.proofOffered && <div className="text-[var(--pv-muted)]">Proof offered: {l.proofOffered}</div>}
                  <div className="text-[var(--pv-muted)]">Agreed: {l.agreed || 'Nothing agreed yet.'}</div>
                  {l.nextAction && <div>Next action: {l.nextAction}</div>}
                  {l.pendingTasks?.length > 0 && <div className="text-[var(--pv-muted)]">Follow-up due: {new Date(l.pendingTasks[0].dueAt).toLocaleString()}</div>}
                  {l.drafts?.length > 0 && <div className="text-[var(--pv-muted)]">Draft ready to review (not sent): {l.drafts.length}</div>}
                </div>
              ))}
              {(data?.[key] ?? []).length === 0 && <div className="text-sm text-[var(--pv-muted)]">None here.</div>}
            </div>
          </div>
        ))}
      </div>
      <div className={cardCls}>
        <div className="text-sm font-bold">Mark won or lost</div>
        <div className="mt-3 space-y-2">
          <FieldRow>
            <input value={outcomeContactId} onChange={e => setOutcomeContactId(e.target.value)} placeholder="Contact ID" className={inputCls} />
            <input value={outcomeReason} onChange={e => setOutcomeReason(e.target.value)} placeholder="Short reason (optional)" className={inputCls} />
          </FieldRow>
          <FieldRow>
            <button onClick={() => run(async () => { await apiService.markPhase74Outcome({ contactId: outcomeContactId, outcome: 'closed_won', reason: outcomeReason }); setOutcomeContactId(''); setOutcomeReason(''); }, 'Lead marked won, follow-ups stopped')} className={`${btnCls} text-emerald-500 border border-emerald-500/40 hover:bg-emerald-500/10`}>Mark won</button>
            <button onClick={() => run(async () => { await apiService.markPhase74Outcome({ contactId: outcomeContactId, outcome: 'closed_lost', reason: outcomeReason }); setOutcomeContactId(''); setOutcomeReason(''); }, 'Lead marked lost, follow-ups stopped')} className={`${btnCls} text-rose-500 border border-rose-500/40 hover:bg-rose-500/10`}>Mark lost</button>
          </FieldRow>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={cardCls}>
          <div className="text-sm font-bold">Move a follow-up to later</div>
          <div className="mt-3 space-y-2">
            <input value={snoozeTaskId} onChange={e => setSnoozeTaskId(e.target.value)} placeholder="Follow-up task ID" className={inputCls} />
            <input type="datetime-local" value={snoozeDue} onChange={e => setSnoozeDue(e.target.value)} className={inputCls} />
            <button onClick={() => run(async () => { await apiService.snoozePhase74Task({ taskId: snoozeTaskId, dueAt: new Date(snoozeDue).toISOString() }); setSnoozeTaskId(''); setSnoozeDue(''); }, 'Follow-up moved to later')} className={`${btnCls} bg-violet-600 text-white hover:bg-violet-500`}>Move to later</button>
          </div>
        </div>
        <div className={cardCls}>
          <div className="text-sm font-bold">Confirm the next step</div>
          <div className="mt-3 space-y-2">
            <input value={nextStepContactId} onChange={e => setNextStepContactId(e.target.value)} placeholder="Contact ID" className={inputCls} />
            <input value={nextStepText} onChange={e => setNextStepText(e.target.value)} placeholder="Next step" className={inputCls} />
            <button onClick={() => run(async () => { await apiService.confirmPhase74NextStep({ contactId: nextStepContactId, nextStep: nextStepText }); setNextStepContactId(''); setNextStepText(''); }, 'Next step confirmed')} className={`${btnCls} bg-violet-600 text-white hover:bg-violet-500`}>Confirm next step</button>
          </div>
        </div>
      </div>
      <div className={cardCls}>
        <div className="text-sm font-bold">Undo a won, lost, or snooze action</div>
        <p className="text-xs text-[var(--pv-muted)] mt-1 break-words">Reopening restores the previous stage and its follow-up tasks. Use an action ID from the recent actions list below, or from the Admin audit log.</p>
        <div className="mt-3"><FieldRow>
          <input value={reopenActionId} onChange={e => setReopenActionId(e.target.value)} placeholder="Action ID" className={inputCls} />
          <button onClick={() => run(async () => { await apiService.reopenPhase74Action({ actionId: reopenActionId }); setReopenActionId(''); }, 'Action reopened')} className={`${btnCls} text-[var(--pv-ink)] border border-[var(--pv-border)] hover:bg-[var(--pv-card-soft)]`}>Reopen</button>
        </FieldRow></div>
        <div className="mt-3 space-y-1">
          {(data?.actions ?? []).slice(-20).reverse().map((a: any) => (
            <div key={a.id} className="px-3 py-2 rounded-lg border border-[var(--pv-border)] text-sm break-words"><span className="font-semibold">{a.kind || a.type || 'action'}</span> <span className="text-[var(--pv-muted)]">{a.contactId} (action ID: {a.id})</span></div>
          ))}
          {(data?.actions ?? []).length === 0 && <div className="text-sm text-[var(--pv-muted)]">No owner actions yet.</div>}
        </div>
      </div>
    </PageShell>
  );
}
