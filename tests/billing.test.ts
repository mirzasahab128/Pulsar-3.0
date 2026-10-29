import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BILLING_PLANS,
  canAddLead,
  cancelSubscription,
  createTestCheckoutSession,
  expireTrialIfDue,
  getBillingPlan,
  getBillingProviderConfig,
  leadsRemaining,
  recordLeadUse,
  recordManualPayment,
  renewPeriod,
  selectPlan,
  startTrial,
  trialDaysRemaining,
} from '../server/billing.js';

const at = (iso: string) => new Date(iso);

test('plans match the finalized pricing and lead caps', () => {
  assert.equal(BILLING_PLANS.length, 3);
  assert.deepEqual(
    BILLING_PLANS.map((p) => [p.id, p.priceCentsPerMonth, p.leadCapPerMonth]),
    [['starter', 14900, 200], ['growth', 29900, 1000], ['scale', 59900, 3000]],
  );
  assert.equal(getBillingPlan('scale')?.prioritySupport, true);
  assert.equal(getBillingPlan('starter')?.callingAddOnIncluded, false);
  assert.equal(getBillingPlan('nope'), null);
});

test('trial lasts 14 days and counts down', () => {
  const sub = startTrial('ws-1', 'starter', at('2026-10-29T00:00:00Z'));
  assert.equal(sub.status, 'trialing');
  assert.equal(sub.trialEndsAt, '2026-11-12T00:00:00.000Z');
  assert.equal(trialDaysRemaining(sub, at('2026-11-01T00:00:00Z')), 11);
  assert.equal(canAddLead(sub, at('2026-11-01T00:00:00Z')), true);
});

test('trial expiry blocks new leads', () => {
  const sub = startTrial('ws-1', 'starter', at('2026-10-29T00:00:00Z'));
  const expired = expireTrialIfDue(sub, at('2026-11-13T00:00:00Z'));
  assert.equal(expired.status, 'trial_expired');
  assert.equal(canAddLead(expired, at('2026-11-13T00:00:00Z')), false);
});

test('lead cap blocks at exactly the cap', () => {
  let sub = startTrial('ws-1', 'starter', at('2026-10-29T00:00:00Z'));
  sub = { ...sub, leadsUsedThisPeriod: 199 };
  assert.equal(leadsRemaining(sub), 1);
  const used = recordLeadUse(sub, at('2026-10-30T00:00:00Z'));
  assert.equal(used.ok, true);
  assert.equal(used.subscription.leadsUsedThisPeriod, 200);
  assert.equal(canAddLead(used.subscription, at('2026-10-30T00:00:00Z')), false);
  const blocked = recordLeadUse(used.subscription, at('2026-10-30T00:00:00Z'));
  assert.equal(blocked.ok, false);
});

test('trial plan change applies at once, paid plan change waits for renewal', () => {
  const trial = startTrial('ws-1', 'starter', at('2026-10-29T00:00:00Z'));
  const trialChanged = selectPlan(trial, 'growth');
  assert.equal(trialChanged.subscription.planId, 'growth');
  assert.equal(trialChanged.subscription.pendingPlanId, null);

  const paid = { ...trial, status: 'active' as const, trialStartedAt: null, trialEndsAt: null };
  const scheduled = selectPlan(paid, 'scale');
  assert.equal(scheduled.subscription.planId, 'starter');
  assert.equal(scheduled.subscription.pendingPlanId, 'scale');
  const renewed = renewPeriod(scheduled.subscription, at('2026-11-29T00:00:00Z'));
  assert.equal(renewed.planId, 'scale');
  assert.equal(renewed.leadsUsedThisPeriod, 0);
  assert.equal(renewed.status, 'active');
});

test('cancel keeps access until period end and records the follow-up choice', () => {
  const sub = startTrial('ws-1', 'growth', at('2026-10-29T00:00:00Z'));
  const cancelled = cancelSubscription(sub, { stopFollowUpsOnCancel: true, now: at('2026-11-01T00:00:00Z') });
  assert.equal(cancelled.cancelAtPeriodEnd, true);
  assert.equal(cancelled.stopFollowUpsOnCancel, true);
  assert.equal(cancelled.cancelledAt, '2026-11-01T00:00:00.000Z');
  const renewed = renewPeriod(cancelled, at('2026-11-12T00:00:00Z'));
  assert.equal(renewed.status, 'cancelled');
});

test('manual payment activates for one month and is logged, without card data', () => {
  const sub = startTrial('ws-thrivemed', 'starter', at('2026-10-29T00:00:00Z'));
  const result = recordManualPayment(sub, {
    amountCents: 14900,
    paidAt: '2026-10-29T00:00:00Z',
    recordedBy: 'admin@example.com',
    note: 'ThriveMed pilot, Starter',
  });
  assert.equal(result.ok, true);
  assert.equal(result.subscription.status, 'active');
  assert.equal(result.subscription.provider, 'manual');
  assert.equal(result.subscription.periodEndsAt, '2026-11-29T00:00:00.000Z');
  assert.equal(result.subscription.manualPayments.length, 1);
  assert.equal(result.subscription.manualPayments[0].amountCents, 14900);
  assert.equal(JSON.stringify(result.subscription).includes('card'), false);
  const bad = recordManualPayment(sub, { amountCents: 0, paidAt: '2026-10-29T00:00:00Z', recordedBy: 'a', note: '' });
  assert.equal(bad.ok, false);
});

test('provider config exposes names only, never a key value', () => {
  const unconfigured = getBillingProviderConfig({});
  assert.equal(unconfigured.configured, false);
  assert.equal(unconfigured.secretKeyRef, 'STRIPE_SECRET_KEY');
  assert.equal(unconfigured.webhookSecretRef, 'STRIPE_WEBHOOK_SECRET');
  assert.equal(JSON.stringify(unconfigured).includes('sk_live'), false);
  const configured = getBillingProviderConfig({ STRIPE_SECRET_KEY: 'sk_test_example', STRIPE_WEBHOOK_SECRET: 'whsec_example' });
  assert.equal(configured.configured, true);
  assert.equal(JSON.stringify(configured).includes('sk_test_example'), false);
});

test('test checkout never charges', () => {
  const session = createTestCheckoutSession('ws-1', 'starter');
  assert.equal(session.mode, 'test');
  assert.equal(session.charged, false);
  assert.ok(session.sessionId.startsWith('test_cs_ws-1_starter_'));
});
