import React, { useCallback, useEffect, useState } from 'react';
import { apiService } from '../services/api';

// Billing page, TEST MODE ONLY. Nothing here charges a card, collects a
// card number, or stores card details. The look reuses the existing pv
// theme tokens, so no colour scheme changes. A workspace is one team
// using Pulsar, billed per workspace, not per seat. A lead is a verified
// business contact in any industry. Calling is a separate add-on and its
// price is not set yet, so it is never charged from this page.

const cardCls = 'pv-card rounded-2xl border border-[var(--pv-border)] bg-[var(--pv-card)] text-[var(--pv-ink)] p-4 min-w-0';
const inputCls = 'w-full sm:w-auto px-3 py-2.5 rounded-lg border border-[var(--pv-border)] bg-[var(--pv-card-soft)] text-[var(--pv-ink)] text-sm outline-none focus:border-[var(--pv-accent)] min-h-[48px]';
const btnCls = 'px-4 py-2.5 rounded-lg text-sm font-semibold transition cursor-pointer min-h-[48px] inline-flex items-center justify-center';

export function BillingPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState('');
  const [planId, setPlanId] = useState('starter');
  const [amountDollars, setAmountDollars] = useState('149');
  const [manualNote, setManualNote] = useState('');
  const [stopFollowUps, setStopFollowUps] = useState(false);
  const [testSession, setTestSession] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await apiService.getBillingOverview()); } catch (e: any) { setError(e?.message || 'Failed to load billing'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const run = async (fn: () => Promise<any>, msg: string) => {
    setError(null); setNotice(null);
    try { await fn(); setNotice(msg); await load(); } catch (e: any) { setError(e?.message || 'Action failed'); }
  };

  const plans = data?.plans || [];
  const subs = data?.subscriptions || [];

  return (
    <div className="space-y-4 min-w-0 w-full">
      <div className={cardCls}>
        <div className="text-sm font-bold px-3 py-2 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-600 break-words">
          TEST MODE ONLY: No live charging here. No card is charged, no card number is collected or stored, and no payment provider is called from this page.
        </div>
        <h1 className="text-lg sm:text-xl font-bold break-words mt-4">Billing</h1>
        <p className="text-sm text-[var(--pv-muted)] mt-1 break-words">
          Per workspace, not per seat. A lead is a verified business contact in any industry.
          Calling is a separate add-on, and its price is not set yet, so it is never charged here.
        </p>
        <button onClick={load} className={`${btnCls} bg-[var(--pv-green)] text-white hover:brightness-110 mt-3`}>Refresh</button>
        {loading && <span className="text-sm text-[var(--pv-muted)] ml-2">Loading...</span>}
        {error && <div className="text-sm p-3 rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-500 mt-3 break-words">{error}</div>}
        {notice && <div className="text-sm p-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-500 mt-3 break-words">{notice}</div>}
        <p className="text-xs text-[var(--pv-muted)] mt-3 break-words">
          Payment provider: {data?.provider?.provider || 'stripe'}.
          Configured: {data?.provider?.configured ? 'Yes' : 'No'}.
          {data?.provider?.note ? ` ${data.provider.note}` : ''}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {plans.map((plan: any) => (
          <div key={plan.id} className={cardCls}>
            <div className="text-sm font-bold">{plan.name}</div>
            <div className="text-2xl font-bold mt-1">{plan.price} <span className="text-sm font-normal text-[var(--pv-muted)]">per month</span></div>
            <p className="text-sm text-[var(--pv-muted)] mt-1 break-words">Up to {plan.leadCapPerMonth} leads per month.</p>
            <p className="text-sm text-[var(--pv-muted)] break-words">{plan.prioritySupport ? 'Priority support included.' : 'Standard support.'}</p>
            <p className="text-sm text-[var(--pv-muted)] break-words">Calling add-on: not included, price not set yet.</p>
          </div>
        ))}
      </div>

      <div className={cardCls}>
        <div className="text-sm font-bold">Start a 14-day trial or manage a workspace</div>
        <p className="text-xs text-[var(--pv-muted)] mt-1 break-words">
          A trial lasts 14 days. During a trial the lead cap for the chosen plan still applies.
          After a trial, a plan change is scheduled for the next period, so no prorated charge is invented here.
        </p>
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 mt-3">
          <input value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} placeholder="Workspace ID" className={inputCls} />
          <select value={planId} onChange={(e) => setPlanId(e.target.value)} className={inputCls}>
            <option value="starter">Starter, $149, 200 leads</option>
            <option value="growth">Growth, $299, 1,000 leads</option>
            <option value="scale">Scale, $599, 3,000 leads, priority support</option>
          </select>
          <button onClick={() => run(() => apiService.startBillingTrial({ workspaceId, planId }), 'Trial started for 14 days. No charge.')} className={`${btnCls} bg-[var(--pv-green)] text-white hover:brightness-110`}>Start 14-day trial</button>
          <button onClick={() => run(() => apiService.selectBillingPlan({ workspaceId, planId }), 'Plan change saved. During a trial it applies at once, otherwise it starts next period.')} className={`${btnCls} bg-violet-600 text-white hover:bg-violet-500`}>Select plan</button>
          <button onClick={() => run(() => apiService.renewBilling({ workspaceId }), 'Billing period renewed or trial expiry applied.')} className={`${btnCls} bg-[var(--pv-card-soft)] border border-[var(--pv-border)]`}>Renew period</button>
        </div>
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 mt-3 items-start sm:items-center">
          <label className="flex items-center gap-2 text-sm min-h-[48px]">
            <input type="checkbox" checked={stopFollowUps} onChange={(e) => setStopFollowUps(e.target.checked)} />
            Stop new follow-ups when cancelled
          </label>
          <button onClick={() => run(() => apiService.cancelBilling({ workspaceId, stopFollowUpsOnCancel: stopFollowUps }), 'Cancellation saved. Access continues until the period ends.')} className={`${btnCls} bg-rose-600 text-white hover:bg-rose-500`}>Cancel at period end</button>
          <button onClick={async () => {
            setError(null); setNotice(null);
            try {
              const result = await apiService.createBillingTestCheckout({ workspaceId, planId });
              setTestSession(result.session);
              setNotice('Test checkout session created. Charged: no. This is a fake test id only.');
            } catch (e: any) { setError(e?.message || 'Test checkout failed'); }
          }} className={`${btnCls} bg-[var(--pv-card-soft)] border border-[var(--pv-border)]`}>Create test checkout</button>
        </div>
        {testSession && (
          <div className="text-sm p-3 rounded-xl border border-[var(--pv-border)] bg-[var(--pv-card-soft)] mt-3 break-words">
            Test session id: {testSession.sessionId}. Mode: test. Charged: no.
          </div>
        )}
      </div>

      <div className={cardCls}>
        <div className="text-sm font-bold">Record a manual payment</div>
        <p className="text-xs text-[var(--pv-muted)] mt-1 break-words">
          Use this for a payment taken outside the app, for example the ThriveMed-first pilot at Starter price.
          This records the payment only. It never charges a card and never stores card details.
        </p>
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 mt-3">
          <input value={amountDollars} onChange={(e) => setAmountDollars(e.target.value)} placeholder="Amount in dollars, e.g. 149" className={inputCls} />
          <input value={manualNote} onChange={(e) => setManualNote(e.target.value)} placeholder="Note, e.g. ThriveMed pilot, Starter" className={inputCls} />
          <button onClick={() => {
            const cents = Math.round(Number(amountDollars) * 100);
            if (!Number.isFinite(cents) || cents <= 0) { setError('Enter a valid amount in dollars.'); return; }
            run(() => apiService.recordBillingManualPayment({ workspaceId, amountCents: cents, note: manualNote }), 'Manual payment recorded. Billing is now active for one month from the payment date.');
          }} className={`${btnCls} bg-[var(--pv-green)] text-white hover:brightness-110`}>Record manual payment</button>
        </div>
      </div>

      <div className={cardCls}>
        <div className="text-sm font-bold">Subscriptions</div>
        {subs.length === 0 && <p className="text-sm text-[var(--pv-muted)] mt-2 break-words">No subscriptions yet. Start a trial above to create one in test mode.</p>}
        <div className="space-y-3 mt-3">
          {subs.map((sub: any) => (
            <div key={sub.workspaceId} className="p-3 rounded-xl border border-[var(--pv-border)] bg-[var(--pv-card-soft)] break-words">
              <div className="font-bold text-sm">{sub.workspaceId}</div>
              <p className="text-sm text-[var(--pv-muted)]">
                Plan: {sub.planName} ({sub.priceCentsPerMonth ? `$${Math.floor(sub.priceCentsPerMonth / 100)}` : ''} per month).
                Status: {sub.status}.
                Leads used: {sub.leadsUsedThisPeriod}. Leads remaining: {sub.leadsRemaining}.
                {sub.trialDaysRemaining ? ` Trial days left: ${sub.trialDaysRemaining}.` : ''}
                {sub.pendingPlanId ? ` Change to ${sub.pendingPlanId} starts next period.` : ''}
                {sub.cancelAtPeriodEnd ? ' Cancels at period end.' : ''}
                {sub.provider ? ` Provider record: ${sub.provider}.` : ''}
              </p>
              {sub.manualPayments && sub.manualPayments.length > 0 && (
                <p className="text-sm text-[var(--pv-muted)]">
                  Manual payments: {sub.manualPayments.map((p: any) => `$${Math.floor(p.amountCents / 100)} on ${p.paidAt.slice(0, 10)}${p.note ? ` (${p.note})` : ''}`).join(', ')}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className={cardCls}>
        <div className="text-sm font-bold">Still needed before any customer can pay</div>
        <ul className="text-sm text-[var(--pv-muted)] mt-2 space-y-1 list-disc list-inside break-words">
          <li>A real payment provider account, with test keys first, then live keys in the environment only.</li>
          <li>A live checkout flow and webhook handling, so a payment actually changes a subscription.</li>
          <li>A live test payment in test mode, checked end to end, before any live payment.</li>
          <li>A price for the calling add-on, before calling is ever charged.</li>
          <li>Terms, privacy policy, refund and cancellation terms, and a support contact, published for customers.</li>
        </ul>
      </div>
    </div>
  );
}
