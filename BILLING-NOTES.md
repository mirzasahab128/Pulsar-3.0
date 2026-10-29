# Pulsar 3.0 Billing - TEST MODE ONLY

Status: built locally only. Not pushed, not deployed, no one charged.
No card number is collected, stored, or logged anywhere in this module.

## What was built

- server/billing.ts (new, pure logic): Starter $149/month up to 200 leads,
  Growth $299/month up to 1,000 leads, Scale $599/month up to 3,000 leads
  plus priority support, per workspace not per seat, 14-day trial,
  lead caps, plan selection, renewal, cancel at period end, manual
  payments, and a provider-neutral plug.
- server/platform.ts: billing state added with a migration for older stores.
- server.ts: master-admin only billing routes under /api/admin/billing/:
  overview, trial, select-plan, renew, cancel, manual-payment, lead-use,
  test-checkout. Every write goes to the audit log.
- src/services/api.ts: billing client methods.
- src/components/BillingPage.tsx (new): Billing page in the existing
  theme, with a TEST MODE ONLY banner on every view.
- src/components/SpatialSidebar.tsx and src/App.tsx: Billing item under
  Administration, marked NEW, master-admin gated like the Phase 7 pages.
- tests/billing.test.ts (new): 9 tests covering pricing, caps, trial,
  expiry, plan changes, cancel, manual payment, provider config, and
  test checkout.

## Rules kept on purpose

- Trial plan change applies at once. Paid plan change is scheduled for
  the next period, so no prorated charge is invented.
- Cancel keeps access until the period ends. The stop-follow-ups choice
  stops new follow-ups for the workspace after cancellation; it does not
  delete per-lead Phase 7 tasks, which are stopped by per-lead opt-out.
- Calling add-on: status can be recorded, price is null (not set yet),
  so it is never charged.
- Provider config returns only the names STRIPE_SECRET_KEY and
  STRIPE_WEBHOOK_SECRET plus a configured flag. Key values are never
  returned, logged, or stored. Test checkout returns a fake id only.

## Still needed before any customer can pay

1. A real payment provider account, test keys first, in the environment only.
2. A live checkout flow and webhook handling, so a payment actually
   changes a subscription (this module records state, it does not call Stripe).
3. A live test payment in test mode, checked end to end, before live mode.
4. A price for the calling add-on, before calling is ever charged.
5. Terms, privacy policy, refund and cancellation terms, and a support
   contact, published for customers.
6. HTTP route tests were not run (same limitation as Phase 7: they need
   a Firebase token stub and a live test server). Routes are type-checked;
   the logic they call is unit-tested.
