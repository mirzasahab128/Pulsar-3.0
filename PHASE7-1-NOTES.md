# Phase 7.1 - Consent ledger, suppression, and contact gate

Built locally in the Phoenix line, 2026-10-28. NOT pushed to GitHub and NOT deployed to Oracle. This is a commit-ready local change set for Phoenix to push after user approval.

## What was built (first build order item only)
- server/contactGate.ts (new, pure, no network): consent ledger, suppression list, CSV DNC import, and the single server-side gate function canContact(contact, channel).
  - Consent types: PEWC (AI voice to mobile), PEC (landline voice), email_optin, SMS opt-in, each with source and timestamp.
  - Revocation by any channel revokes every active consent for that contact, and the server revoke route also adds suppression records, so revocation suppresses all channels.
  - Suppression: internal list by contact id, email, or phone (normalized to E.164). CSV import is phone numbers only, one per line, header skipped, invalid lines reported, duplicates skipped.
  - Gate order, fail closed: suppressed, then revoked, then unverified field, then missing consent. AI voice to a mobile, or to an unknown line type (treated as mobile), requires PEWC. Landline voice requires PEC or PEWC. Email requires email opt-in. SMS requires SMS opt-in.
  - Verification is per field with provenance and timestamp. No confidence score is returned anywhere.
  - National DNC: NOT claimed. The US National DNC Registry requires paid registration and cannot be queried from here. The gate uses the internal list plus user-supplied CSV imports only, and the overview and import responses say so.
- server/platform.ts: PlatformState.phase71 { consents, suppressions } with migration for older stores.
- server.ts: master-admin routes, all audit-logged and persisted:
  - GET /api/admin/phase71/overview
  - POST /api/admin/phase71/consents
  - POST /api/admin/phase71/consents/revoke
  - POST /api/admin/phase71/suppressions
  - DELETE /api/admin/phase71/suppressions/:id
  - POST /api/admin/phase71/suppressions/import
  - POST /api/admin/phase71/check (evaluates the gate only; it never sends an email, SMS, or call)
- src/services/api.ts: apiService methods for all seven routes.
- src/components/AdminCommandCenter.tsx: new "Outreach Gates" tab, no existing tab changed. Shows counts, consent list, suppression list, grant/revoke forms, suppression add/remove, CSV import, and a gate checker form.
- General framing only: Pulsar is for all businesses and industries. A healthcare practice is one example contact type, not the product. No RCM-only copy was added.

## Tests
- Baseline before changes: tsc clean, npm test 88/88.
- After changes: tsc clean, npm test 108/108 (88 baseline + 20 new Phase 7.1 tests in tests/contactGate.test.ts).
- New battery covers: phone/email normalization, grant and channel/type rejection, no duplicate grant, revocation suppresses all channels, revoked blocked on all channels, suppression add/dedupe/block, CSV import normalize/dedupe/invalid, verified plus consented allows on all three channels, unknown consent blocks AI voice to mobile, PEC alone does not allow AI voice to mobile, landline PEC allows while unknown line type blocks, unverified blocks all channels, email opt-in missing blocks cold email, no confidence score in any verdict, auditable reason text.
- Production build: npm run build succeeded (vite, dist/index.html present).
- server-data/store.json unchanged by the test run (diffed against the pre-build backup). Backup kept at server-data.bak-phase71-202610280745/store.json in the dev copy only; it is not part of the commit set.
- HTTP route tests were NOT run (they need a Firebase token stub and a live test server); routes are type-checked and the gate logic they call is unit-tested. The parent agent should run the HTTP battery before pushing if it wants route-level proof.

## Files changed (commit-ready set)
- server/contactGate.ts (new)
- server/platform.ts
- server.ts
- src/services/api.ts
- src/components/AdminCommandCenter.tsx
- tests/contactGate.test.ts (new)
- PHASE7-1-NOTES.md (new)

## Not done (later Phase 7 items, out of scope here)
- No voice agent, no dialer, no actual email/SMS sending, no call brief UI, no live National DNC lookup, no external service calls. Test fixtures only; no real phone or email data was used.
