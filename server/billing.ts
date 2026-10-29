/**
 * Billing for Pulsar 3.0 - TEST MODE ONLY, no live charging.
 *
 * Pure module: no network, no card storage, no real payment call.
 * A lead is a verified business contact in any industry. Prices are
 * per workspace, not per seat. Calling is a separate add-on and its
 * price is not set yet, so it is never charged by this module.
 *
 * Money is stored in integer cents to avoid rounding errors.
 * Card numbers are never stored here, never logged here, and never
 * accepted by any function in this file.
 */

export type BillingPlanId = 'starter' | 'growth' | 'scale';

export interface BillingPlan {
  id: BillingPlanId;
  name: string;
  priceCentsPerMonth: number;
  leadCapPerMonth: number;
  prioritySupport: boolean;
  callingAddOnIncluded: false;
}

export const BILLING_PLANS: BillingPlan[] = [
  { id: 'starter', name: 'Starter', priceCentsPerMonth: 14900, leadCapPerMonth: 200, prioritySupport: false, callingAddOnIncluded: false },
  { id: 'growth', name: 'Growth', priceCentsPerMonth: 29900, leadCapPerMonth: 1000, prioritySupport: false, callingAddOnIncluded: false },
  { id: 'scale', name: 'Scale', priceCentsPerMonth: 59900, leadCapPerMonth: 3000, prioritySupport: true, callingAddOnIncluded: false },
];

export function getBillingPlan(planId: string): BillingPlan | null {
  return BILLING_PLANS.find((p) => p.id === planId) || null;
}

export function formatPriceCents(cents: number): string {
  return `$${Math.floor(cents / 100)}`;
}

export type BillingStatus = 'trialing' | 'active' | 'past_due' | 'cancelled' | 'trial_expired';

export interface ManualPayment {
  id: string;
  amountCents: number;
  paidAt: string;
  recordedBy: string;
  note: string;
}

export interface BillingSubscription {
  workspaceId: string;
  planId: BillingPlanId;
  status: BillingStatus;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  periodStartedAt: string;
  periodEndsAt: string;
  leadsUsedThisPeriod: number;
  callingAddOn: boolean;
  callingAddOnPriceCentsPerMonth: number | null;
  pendingPlanId: BillingPlanId | null;
  cancelAtPeriodEnd: boolean;
  stopFollowUpsOnCancel: boolean;
  cancelledAt: string | null;
  provider: 'none' | 'manual' | 'test' | 'stripe';
  providerSubscriptionId: string | null;
  manualPayments: ManualPayment[];
}

export const TRIAL_DAYS = 14;

function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date.getTime());
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

function iso(date: Date): string {
  return date.toISOString();
}

let paymentCounter = 0;

export function startTrial(workspaceId: string, planId: BillingPlanId, now: Date = new Date()): BillingSubscription {
  const plan = getBillingPlan(planId);
  if (!plan) throw new Error('UNKNOWN_PLAN');
  return {
    workspaceId,
    planId,
    status: 'trialing',
    trialStartedAt: iso(now),
    trialEndsAt: iso(addDays(now, TRIAL_DAYS)),
    periodStartedAt: iso(now),
    periodEndsAt: iso(addDays(now, TRIAL_DAYS)),
    leadsUsedThisPeriod: 0,
    callingAddOn: false,
    callingAddOnPriceCentsPerMonth: null,
    pendingPlanId: null,
    cancelAtPeriodEnd: false,
    stopFollowUpsOnCancel: false,
    cancelledAt: null,
    provider: 'none',
    providerSubscriptionId: null,
    manualPayments: [],
  };
}

export function trialDaysRemaining(sub: BillingSubscription, now: Date = new Date()): number {
  if (sub.status !== 'trialing' || !sub.trialEndsAt) return 0;
  const ms = new Date(sub.trialEndsAt).getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

export function isTrialExpired(sub: BillingSubscription, now: Date = new Date()): boolean {
  return sub.status === 'trialing' && !!sub.trialEndsAt && now.getTime() >= new Date(sub.trialEndsAt).getTime();
}

/** Expire a trial whose end date has passed. Pure: returns a new object. */
export function expireTrialIfDue(sub: BillingSubscription, now: Date = new Date()): BillingSubscription {
  if (!isTrialExpired(sub, now)) return sub;
  return { ...sub, status: 'trial_expired' };
}

/** Access for viewing and for adding leads. A cancelled workspace keeps
 *  access until its period ends, then it stops. A past-due workspace can
 *  still be viewed by an admin, but it cannot add new leads. */
export function hasActiveAccess(sub: BillingSubscription, now: Date = new Date()): boolean {
  const current = expireTrialIfDue(sub, now);
  if (current.status === 'trialing' || current.status === 'active') return true;
  if (current.status === 'cancelled') return now.getTime() < new Date(current.periodEndsAt).getTime();
  return false;
}

export function leadsRemaining(sub: BillingSubscription): number {
  const plan = getBillingPlan(sub.planId);
  if (!plan) return 0;
  return Math.max(0, plan.leadCapPerMonth - sub.leadsUsedThisPeriod);
}

export function canAddLead(sub: BillingSubscription, now: Date = new Date()): boolean {
  if (sub.status === 'past_due' || sub.status === 'trial_expired') return false;
  if (!hasActiveAccess(sub, now)) return false;
  return leadsRemaining(sub) > 0;
}

export function recordLeadUse(sub: BillingSubscription, now: Date = new Date()): { ok: boolean; subscription: BillingSubscription; error?: string } {
  if (!canAddLead(sub, now)) return { ok: false, subscription: sub, error: 'LEAD_CAP_OR_ACCESS' };
  return { ok: true, subscription: { ...sub, leadsUsedThisPeriod: sub.leadsUsedThisPeriod + 1 } };
}

/** Plan change: during a trial it applies at once. After a trial it is
 *  scheduled for the next period, so no prorated charge is invented here. */
export function selectPlan(sub: BillingSubscription, planId: BillingPlanId): { ok: boolean; subscription: BillingSubscription; error?: string } {
  if (!getBillingPlan(planId)) return { ok: false, subscription: sub, error: 'UNKNOWN_PLAN' };
  if (sub.planId === planId && !sub.pendingPlanId) return { ok: true, subscription: sub };
  if (sub.status === 'trialing') {
    return { ok: true, subscription: { ...sub, planId, pendingPlanId: null } };
  }
  return { ok: true, subscription: { ...sub, pendingPlanId: planId } };
}

/** Apply a scheduled plan change at renewal, and start a fresh period. */
export function renewPeriod(sub: BillingSubscription, now: Date = new Date()): BillingSubscription {
  if (sub.cancelAtPeriodEnd) {
    return { ...sub, status: 'cancelled', cancelledAt: sub.cancelledAt || iso(now), pendingPlanId: null };
  }
  const planId = sub.pendingPlanId || sub.planId;
  return {
    ...sub,
    planId,
    pendingPlanId: null,
    status: 'active',
    periodStartedAt: iso(now),
    periodEndsAt: iso(addMonths(now, 1)),
    leadsUsedThisPeriod: 0,
  };
}

export function cancelSubscription(
  sub: BillingSubscription,
  opts: { stopFollowUpsOnCancel: boolean; now?: Date } = { stopFollowUpsOnCancel: false },
): BillingSubscription {
  const now = opts.now || new Date();
  return {
    ...sub,
    cancelAtPeriodEnd: true,
    stopFollowUpsOnCancel: opts.stopFollowUpsOnCancel,
    cancelledAt: iso(now),
  };
}

/** Manual payment, for the ThriveMed-first pilot and any other offline
 *  payment. This records that money was taken outside the app. It never
 *  charges a card and never stores card details. */
export function recordManualPayment(
  sub: BillingSubscription,
  input: { amountCents: number; paidAt: string; recordedBy: string; note: string },
): { ok: boolean; subscription: BillingSubscription; error?: string } {
  if (!Number.isFinite(input.amountCents) || input.amountCents <= 0) {
    return { ok: false, subscription: sub, error: 'AMOUNT_REQUIRED' };
  }
  const paidAt = new Date(input.paidAt);
  if (Number.isNaN(paidAt.getTime())) return { ok: false, subscription: sub, error: 'INVALID_DATE' };
  paymentCounter += 1;
  const payment: ManualPayment = {
    id: `manual-${Date.now()}-${paymentCounter}`,
    amountCents: input.amountCents,
    paidAt: paidAt.toISOString(),
    recordedBy: input.recordedBy,
    note: input.note || '',
  };
  return {
    ok: true,
    subscription: {
      ...sub,
      status: 'active',
      periodStartedAt: paidAt.toISOString(),
      periodEndsAt: iso(addMonths(paidAt, 1)),
      leadsUsedThisPeriod: 0,
      pendingPlanId: null,
      cancelAtPeriodEnd: false,
      cancelledAt: null,
      provider: 'manual',
      manualPayments: [...sub.manualPayments, payment],
    },
  };
}

// ---------------------------------------------------------------------------
// Payment provider plug. Only environment variable NAMES are referenced.
// No key value is ever read into a return value, logged, or stored here.
// ---------------------------------------------------------------------------

export interface BillingProviderConfig {
  provider: 'stripe';
  configured: boolean;
  secretKeyRef: 'STRIPE_SECRET_KEY';
  webhookSecretRef: 'STRIPE_WEBHOOK_SECRET';
  note: string;
}

export function getBillingProviderConfig(env: Record<string, string | undefined> = process.env): BillingProviderConfig {
  const configured = Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET);
  return {
    provider: 'stripe',
    configured,
    secretKeyRef: 'STRIPE_SECRET_KEY',
    webhookSecretRef: 'STRIPE_WEBHOOK_SECRET',
    note: configured
      ? 'Provider keys are present in the environment. This module still does not charge anyone until a live checkout flow is added and tested.'
      : 'Provider is not configured. Set the two environment variables above, then test in test mode before any live payment.',
  };
}

export interface TestCheckoutSession {
  sessionId: string;
  mode: 'test';
  charged: false;
  workspaceId: string;
  planId: BillingPlanId;
}

/** Fake test provider. It only makes up a test session id. It never
 *  charges anyone and must never be used for a live payment. */
export function createTestCheckoutSession(workspaceId: string, planId: BillingPlanId): TestCheckoutSession {
  return {
    sessionId: `test_cs_${workspaceId}_${planId}_${Date.now()}`,
    mode: 'test',
    charged: false,
    workspaceId,
    planId,
  };
}
