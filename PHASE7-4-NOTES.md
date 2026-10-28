# Phase 7.4 - Owner dashboard (Phoenix line)

Built locally only. Nothing pushed to GitHub, nothing deployed to Oracle,
no real phone call, email, or text made, no real API key or real contact
data used. Test fixtures only.

## What was built

- `server/ownerDashboard.ts` (new, pure, no network, no sending):
  `buildOwnerDashboard` turns the Phase 7.3 pipeline, tasks, drafts,
  and owner summaries into an owner view. Lists: handed over
  (transferred_to_owner), hot (interested), waiting for callback
  (callback_booked), and stuck (an active lead with no pending task,
  or with an overdue pending task). Each lead shows contact, business,
  pain point, proof offered, what was agreed (or nothing agreed yet),
  next action, pending tasks, and unsent drafts. Summary strip counts:
  handed over, hot, waiting for callback, stuck, won, lost, opted
  out, plus active and total. No revenue or ROI figure is invented:
  a value is only shown when the owner entered it, and none is
  entered by this step.
- Reversible, logged owner actions (pure functions, wired to
  master-admin routes in `server.ts`):
  mark won or lost (`markLeadOutcome`) cancels that lead's pending
  tasks, so automatic follow-up stops, and records the previous stage
  and cancelled task ids; reopen (`reopenLead`) restores the previous
  stage and returns those tasks to pending, and cannot be applied
  twice. Snooze (`snoozeFollowUp`) moves one task to a new due time
  and records the old due time; unsnooze restores it. Confirm next
  step (`confirmNextStep`) updates one lead's owner summary next
  action and records the old one. Every action touches only its own
  contact or task, and every route also writes an audit entry.
- Platform state gained `phase74` (owner action log) with a migration
  for older stores, in `server/platform.ts`.
- Server routes (master-admin only, in `server.ts`):
  GET `/api/admin/phase74/dashboard`,
  POST `/api/admin/phase74/outcome`,
  POST `/api/admin/phase74/reopen`,
  POST `/api/admin/phase74/snooze`,
  POST `/api/admin/phase74/unsnooze`,
  POST `/api/admin/phase74/next-step`. None sends, calls, or changes
  consent or gate state.
- Client methods in `src/services/api.ts` and a Phase 7.4 section in
  the Admin Command Center Outreach Gates tab showing the summary
  strip, the four lists, and mark won / mark lost controls.

## Verification

- Before: tsc clean, npm 136/136, 37 suites.
- After: tsc clean, npm 149/149, 39 suites (13 new Phase 7.4
  tests in `tests/ownerDashboard.test.ts`), production build OK,
  live store file unchanged. One real failure found and fixed during
  the run: tsc initially failed on two possibly-null action values
  in the new test file; the tests now assert the action exists
  before using it, and tsc is clean after the fix.
- New battery covers: transferred lead in the handed-over list with
  full detail, callback lead in the waiting list, hot lead in the hot
  list, a lead with no pending task in the stuck list, an opted-out
  lead in no active list, drafts staying drafts with no invented
  value, won stopping follow-ups for that lead only, lost counting
  as lost, reopen restoring stage and task and refusing a second
  reopen, snooze moving one task and unsnooze restoring its due
  time, confirm next step updating only that lead, per-contact
  isolation, and no em dash in dashboard text.

## Limitations, not built in this step

- No real sending of any draft, no real call, no HTTP route tests
  (routes are type-checked; the logic they call is unit-tested).
  A human-approved send step is still required before any draft
  is ever dispatched.
- No live National DNC lookup (same Phase 7.1 limitation:
  internal suppression plus user-supplied CSV only).
- Staging was not compiled in place (no `node_modules` there, same
  as 7.1, 7.2, and 7.3); dev tsc passed and staging files are
  byte-identical to dev.
- The dashboard reuses Phase 7.3 data only; it does not add a
  separate owner-only screen outside the Admin Command Center, and
  reopening from the screen uses the action record id from the
  audit log or dashboard action list.
