# Phase 7.3 - After-call automation (Phoenix line)

Built locally only. Nothing pushed to GitHub, nothing deployed to Oracle,
no real phone call, email, or text made, no real API key or real contact
data used. Test fixtures only.

## What was built

- `server/afterCall.ts` (new, pure, no network, no sending):
  `processAfterCall` turns a Phase 7.2 call note into a pipeline stage,
  follow-up tasks, and, where asked, a follow-up message draft.
  Stages: new, contacted, interested, transferred_to_owner,
  callback_booked, nurture, closed_won, closed_lost, opted_out.
  Mapping: transferred -> transferred_to_owner with an owner summary
  and an owner follow-up task due in 1 day; callback_booked ->
  callback task at the time the prospect gave (or in 2 days);
  email_requested -> contacted with one email draft (status draft,
  sent false) and an email draft review task due in 1 day; blocked ->
  new with a gate review task; ended -> nurture with a check in
  7 days. Drafts carry an opt-out line and use only the pain point
  and proof from the brief. No outcome, result, or ROI is invented.
- Universal suppression: an already suppressed lead, or a
  not_interested outcome, always ends at opted_out, cancels pending
  follow-up tasks, and produces no draft and no owner summary, even
  if a transfer summary was passed. `applyOptOut` cancels pending
  tasks for that contact only and reports the count; the server
  opt-out route also revokes Phase 7.1 consent and adds a contact
  suppression record, so future gate checks block on all channels.
- Owner handoff summary: contact, business, pain point, proof
  offered, what was agreed (or "Nothing agreed yet"), and the next
  action for the owner, rendered by `formatOwnerSummary` and shown
  in the Admin Command Center.
- Server routes (master-admin only, in `server.ts`):
  GET /api/admin/phase73/overview, POST /api/admin/phase73/after-call,
  POST /api/admin/phase73/opt-out. None of these routes sends
  anything. Platform state gained `phase73` (pipeline, tasks,
  drafts, owner summaries) with a migration for older stores.
- Client API methods in `src/services/api.ts` and a Phase 7.3
  section in the Admin Command Center Outreach Gates tab showing
  pipeline counts, owner summaries, pending tasks, and an opt-out
  button for a contact. No existing tab was changed.

## Verification

- Before: tsc clean, npm 126/126, 36 suites.
- After: tsc clean, npm 136/136, 37 suites (10 new Phase 7.3
  tests in `tests/afterCall.test.ts`).
- New battery covers: transferred -> owner summary, not_interested
  -> opted_out with follow-ups cancelled and no draft, callback
  task at the prospect's time, send-email draft only with sent
  false, opt-out after a call stopping a scheduled follow-up,
  already-suppressed overriding a transfer, blocked -> gate
  review task, ended -> nurture in one week, per-contact
  cancellation only, and no em dash in drafts or summaries.
- `npm run build` succeeded. Live store file unchanged by the
  test run (diffed against the pre-build backup).

## Limitations, not built in this step

- No real sending of any draft, no real call, no HTTP route tests
  (routes are type-checked; the logic they call is unit-tested).
  A human-approved send step is still required before any draft
  is ever dispatched.
- No live National DNC lookup (same Phase 7.1 limitation:
  internal suppression plus user-supplied CSV only).
- Staging was not compiled in place (no node_modules there, same
  as Phase 7.1 and 7.2); dev tsc passed and staging files are
  byte-identical to dev.
- No owner dashboard screen beyond the Admin Command Center
  section, and no closed_won / closed_lost transition from a
  later owner action; those stages exist in the type for the
  Phase 7.4 owner dashboard step.
