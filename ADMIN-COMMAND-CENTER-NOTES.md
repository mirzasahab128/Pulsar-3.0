# Pulsar — Admin Command Center (Phoenix line)

**Date:** 2026-10-23 (Asia/Karachi)
**Scope:** The Phase 2 Admin Command Center deltas from
`Pulsar-AI-Studio-Prompt-Parity-Fixes-2026-10-23.md`, built on top of the
verified Phases 0–6 state. The Phases 1–3 platform already had users, plans,
signup approvals, master admins, and the audit log; this build adds the
three missing pieces (per-user feature overrides, password-reset trigger,
Master Control overview + rename) and hardens delete/disable/demote
semantics against the spec's acceptance checks.

## Verification summary (final run, 2026-10-23)

| Suite | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npx vite build` | OK |
| `npm test` (85 = 78 baseline + 7 new platform unit tests) | **85/85 pass** |
| `python3 tests-admin-command-center.py` (new HTTP battery, 52 checks) | **52 passed, 0 failed** |
| `python3 tests-phase0.py` (regression) | **38 passed, 0 failed, 2 skipped** — identical to baseline (sandbox-egress skips) |
| `python3 tests-phase1-3.py` (regression) | **42 passed, 0 failed** |
| `python3 tests-phase4-6.py` (regression) | **51 passed, 0 failed** |

Test residue cleaned (`server-data` removed) after the runs.

---

## What shipped

### 1. Per-user feature overrides

- `PlatformUser.featureOverrides` (map feature key → `true` granted /
  `false` revoked) added to the platform record; new records start with `{}`.
- New pure helper `effectiveFeatures(plan, overrides)` in
  `server/platform.ts` is the single place the merge is defined. It is now
  used by **every** server-side access decision:
  - `featureGateDecision` (the `requireFeature` gates on 13+ endpoints),
  - `resolveAccess` (so `GET /api/me/access` returns effective features —
    the client's locked-not-hidden UI follows them),
  - the Phase 6 sequence engine's per-creator `email_outreach` check in
    `server/pipeline.ts` (previously read the raw plan).
- `AccessInfo` also echoes the raw `featureOverrides` so clients can show
  which areas are overridden.
- New endpoint **`PUT /api/admin/users/:uid/access`** (master-admin only):
  body is a map of feature key → `true` / `false` / `null` (null clears the
  override). Keys are validated against the fixed 10-key set and values must
  be boolean-or-null (400 otherwise; 404 unknown user). Each change is
  audit-logged as `user.access_update` with per-feature direction, e.g.
  `call_studio granted; …`, `npi_search revoked`, `npi_search override
  cleared (plan default on)`.
- **Overrides never lift plan limits** — they change feature access only.
  The battery pins this: a Trial user granted `call_studio` still gets
  `PLAN_LIMIT_REACHED` until the plan's `callsPerMonth` is raised.
- Users tab UI: an **Access** editor per user showing, for each area, the
  plan default and the override state (Plan default / Granted / Revoked)
  with Grant / Revoke / Plan default controls, plus an "areas" count
  (with a `±` marker when overrides exist). Changes take effect on the
  user's next request — no restart, no re-login.

### 2. Password-reset trigger

- **`POST /api/admin/users/:uid/password-reset`** (master-admin only,
  404 unknown user). Consistent with how the codebase already handles
  forgot-password (the sign-in page uses Firebase's
  `sendPasswordResetEmail` client-side) and with the Phase 0/1–3 deviation
  pattern (no Firebase Admin SDK here): the server emails the user through
  the existing Resend mailer saying a reset was requested and to complete
  it via **Forgot password** on the sign-in page, where Firebase sends the
  actual secure reset link. The response carries the mailer's real status
  (`sent` / `not_configured` / `failed`) and the Users tab surfaces it
  honestly — `not_configured` is shown as "email NOT sent", never as sent.
  Audit-logged as `user.password_reset` including the mail status.

### 3. Master Control overview + rename

- **`GET /api/admin/overview`** (master-admin only): `totalUsers`,
  `byStatus`, `byPlan` counts, `pendingApprovals`, `masterAdminCount`
  (effective set), `envFallbackActive` (whether the `OWNER_EMAILS`
  break-glass is configured), and the 10 most recent audit entries.
- The admin area is renamed **Admin Command Center** everywhere
  user-facing: sidebar label, component heading, and the component itself —
  `src/components/AdminAccessControlCenter.tsx` →
  **`src/components/AdminCommandCenter.tsx`** (route id stays
  `admin_access`, no deep-link breakage). Tabs are now **Overview, Users,
  Signup Approvals, Plans & Access, Master Control, Audit Log** (the
  Overview tab is the default; "Master Admin" tab is "Master Control").
  The Overview tab shows the counts, users-by-plan chips, the break-glass
  status note, and recent activity. The Plans editor also gained the
  `sendsPerMonth` limit field that Phase 6 added server-side.

### 4. Hardening against the spec's acceptance checks

- **Delete tombstones.** Previously, deleting a user record dropped the
  identity into the "no platform record = grandfathered" migration rule,
  so a deleted user with a still-valid Firebase token kept API access
  until their next `/api/me/access` call recreated a pending record. Now
  `DELETE /api/admin/users/:uid` also writes a tombstone
  (`PlatformState.deletedUsers`), and `featureGateDecision` /
  `requireActiveAccount` reject a tombstoned uid/email immediately with
  403 `ACCOUNT_NOT_ACTIVE` (`status: 'deleted'`). The tombstone clears if
  the identity is re-created by an admin or signs in again — in which case
  they restart as `pending_approval` with zero access. Battery-verified
  end-to-end.
- **Guardrails (all 409, battery-verified):** self-delete (existing),
  self-disable (existing), **demoting a `master_admin` record via PATCH
  role** (new — demotion happens only through the guarded master-admin
  list), **disabling or deleting the last effective master admin** (new),
  and removing yourself / emptying the effective master-admin set via the
  list (existing `validateMasterAdminUpdate`).
- Duplicate-email create → clean 409 (already present; re-verified by the
  Phase 1–3 regression).
- Audit coverage now spans: create, update, **access grant/revoke/clear**,
  **password reset**, disable/enable (via `user.update`), delete,
  approve, reject, plan create/update, master-admins update — each with
  actor, target email, and timestamp.

## Endpoint contracts (new/changed)

| Route | Auth | Notes |
|---|---|---|
| `PUT /api/admin/users/:uid/access` | master admin | body: `{ featureKey: true \| false \| null }`; 400 unknown key / non-boolean / empty; 404 unknown user; returns updated user |
| `POST /api/admin/users/:uid/password-reset` | master admin | returns `{ reset: { status, error?, messageId? } }` — the mailer's honest state |
| `GET /api/admin/overview` | master admin | counts by status/plan, pending count, master-admin count, env fallback flag, 10 recent audit entries |
| `GET /api/me/access` | signed-in | `access.features` is now effective (plan ± overrides); `access.featureOverrides` echoes the raw overrides |
| `DELETE /api/admin/users/:uid` | master admin | also writes a delete tombstone; response unchanged (`platformRecordDeleted: true, authAccountDeleted: false`) |
| `PATCH /api/admin/users/:uid` | master admin | role change on a `master_admin` record → 409; disabling the last master admin → 409 |

## Files changed

- **Server:** `server/platform.ts` (featureOverrides, `effectiveFeatures`,
  tombstones, gate/access/engine merge points), `server.ts` (access +
  password-reset + overview routes, PATCH/DELETE guardrails, tombstone on
  delete), `server/pipeline.ts` (sequence engine uses effective features).
- **Client:** `src/components/AdminCommandCenter.tsx` (new — renamed and
  extended), `src/components/AdminAccessControlCenter.tsx` (deleted),
  `src/App.tsx` (import/usage), `src/components/SpatialSidebar.tsx` (nav
  label), `src/services/api.ts` (`AdminOverview` type, `featureOverrides`
  on the record/access types, three new helpers, `sendsPerMonth` on plan
  limits).
- **Tests:** `tests/platform.test.ts` (+7 unit tests: effectiveFeatures,
  gate with overrides, resolveAccess overrides, tombstone reject +
  restart-as-pending), `tests-admin-command-center.py` (new, 52 checks).

## Deviations (standing, honestly flagged)

1. **No Firebase Admin SDK** (unchanged from Phases 1–3): admin-created
   users are platform records adopted at first sign-in, and delete removes
   the platform record, not the Firebase Auth account — now closed off by
   the tombstone so the leftover Auth account has no platform access.
   The password-reset trigger therefore emails a reset *request* notice
   via Resend and routes the user to Firebase's own forgot-password flow,
   instead of minting a Firebase reset link server-side.
2. Everything else follows the established pattern: platform state in the
   file-backed store behind Firestore-shaped interfaces; owner identity
   env-only (`OWNER_EMAILS` / `VITE_OWNER_EMAILS`), fail-closed; the
   master owner (mnabeel1777@gmail.com) is never hardcoded.
