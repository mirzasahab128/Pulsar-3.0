# Pulsar — Phases 1–3 (Dashboard rename, Admin Access Control Center, Dashboard graphs) — Phoenix Line

**Date:** 2026-10-23
**Tree:** `~/workspace/projects/pulsar-phoenix-line/` (Phase 0 tree; `pulsar-v2` untouched, no git/GitHub operations — the `Pulsar-2.0` repo still does not exist)
**Spec:** `Pulsar-AI-Studio-Prompt-Dashboard-Admin-2026-10-22.md` Parts 1–3, sequenced per `Pulsar-Master-Build-Prompt.md` Phases 1–3 (Part 1 rename → Part 3 platform → Part 2 graphs, so the stats endpoint respects the platform's workspace scoping).

## Verification summary (final run, 2026-10-23)

| Suite | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npx vite build` | OK |
| `npm test` (shipped 11 + Phase 0 16 + new platform 21) | **48/48 pass** |
| `python3 tests-phase0.py` (Phase 0 regression battery) | **38 passed, 0 failed, 2 skipped** — identical to the Phase 0 baseline (skips are the sandbox-egress webhook checks, unchanged) |
| `python3 tests-phase1-3.py` (new HTTP battery, 42 checks) | **42 passed, 0 failed** |

The new battery boots the real server (test-server cert-source stub, real RS256 verification) and exercises: 401/403/200 on `/api/admin/*`, the full signup → pending → approve → Trial flow, `ACCOUNT_NOT_ACTIVE` / `PLAN_FEATURE_NOT_INCLUDED` / `PLAN_LIMIT_REACHED` gates, admin-create + email-adoption, plan CRUD validation, master-admin guardrails (remove-self 409, stored-list grant/revoke), disable/re-enable, audit contents, stats shape for 7d/30d/90d, invalid-range 400, and workspace isolation.

---

## Part 1 — "Command Center" → "Dashboard" (prompt Part 1)

- `src/components/CommandCenterDashboard.tsx` → **`src/components/Dashboard.tsx`**; component `CommandCenterDashboard` → `Dashboard`, props interface renamed; `src/App.tsx` import + usage updated.
- `SpatialSidebar.tsx`: nav id `command_center` label is now **Dashboard** (id unchanged — no deep-link breakage, per the prompt's option).
- `SpatialCommandPalette.tsx`: entry title "Command Center Dashboard" → **Dashboard**.
- `server/mailer.ts`: briefing footer copy "Pulsar Command Center" → **Pulsar Dashboard**.
- Acceptance: codebase search for "Command Center" now returns only the deliberately preserved `AIAgentFleetWorkspace` heading ("AI Agent Fleet Command Center") and one internal code comment in `TelephonyStatusCard.tsx` — exactly the prompt's acceptance check 2.

## Part 3 — Admin Access Control Center (prompt Part 3; built before Part 2 per the master's delivery order)

**Server — `server/platform.ts` (new) + routes in `server.ts`:**

- Identity model (Firestore-shaped): `users` (uid → email, displayName, role `master_admin|admin|user`, planId, status `pending_approval|active|disabled`, createdAt, approvedBy/At, rejectionNote, invitedBy, lastSignInAt), `plans`, `platformConfig/masterAdmins` (stored list), `adminAudit` entries (actorEmail, action, target, details, at). Persisted via `serverStore` (see Deviation 1).
- **Master admin** = verified email in `OWNER_EMAILS` env (break-glass, fail-closed when unset — Phase 0 C7 unchanged) **∪** the stored `platformConfig/masterAdmins` list, editable in the Master Admin tab with the prompt's guardrails: removing yourself → **409**, emptying the effective set → **409**. `requireMasterAdmin` gates all `/api/admin/*`; the Phase 0 `requireOwnerMiddleware` still guards the scheduler routes.
- **Signup flow:** `GET /api/me/access` (and `POST /api/me/register`) ensures a users record on sign-in. Self-signups start `pending_approval`, plan-less → every feature is off, `AuthGate.tsx` shows the "awaiting approval" screen, and feature endpoints return **403 `ACCOUNT_NOT_ACTIVE`**. Approve (plan preselected to the default) / reject (status `disabled` + note) are audit-logged; the approval email goes through the real Resend mailer and its status is returned honestly (`not_configured` when no key — verified in the battery).
- **Plans:** seed plans exactly per §3e — **Trial** (lead_discovery + npi_search, 100 leads/mo, 1 seat, default), **Starter** (+ campaigns, email_outreach, daily_briefing, 1,000 leads/mo, 3 seats), **Growth** (all 10 feature keys, 5,000 leads/mo, 10 seats) — all admin-editable via `PUT /api/admin/plans/:planId` (unknown feature keys and negative limits → 400).
- **Enforcement:** `requireFeature(key)` now fronts the mapped endpoints (npi_search → `/api/leads/npi-search`; lead_discovery → scrape / maps-search / linkedin-search; call_studio → `/api/call/*` + `/api/live/voice-turn`; linkedin_workflows → smart-filter / send-connection / crm-webhook-*; ai_assistant → chat / transcribe / search-grounding; daily_briefing → `/api/briefing/generate`), running **before** the AI quota middleware so blocked calls never burn quota. Monthly usage counters (leads produced by NPI search/scrape, call turns) persist in the store; exceeding a plan limit → **403 `PLAN_LIMIT_REACHED`** with `limit` + `usage`. Master admins bypass all plan gates. `territory_maps` and `google_sync` have no server endpoints (client-side Google integrations) — they are plan-gated in the UI only.
- **Client:** new `src/components/AdminAccessControlCenter.tsx` (tabs: Users / Signup Approvals / Plans & Access / Master Admin / Audit Log), sidebar gains the owner-only **Admin Access Control** item (id `admin_access`, Administration group, separate from `IntegrationsAdminWorkspace`), `AuthContext` fetches `/api/me/access` at sign-in, and plan-excluded nav items render **locked-not-hidden** (lock icon + "Not in your plan" tooltip; selecting one raises an upgrade notice naming the current plan). A server 403 surfaces as an error message in the admin UI, never a fake success. `firestore.rules` gained explicit deny-all client matches for `plans`, `platformConfig`, `adminAudit` (§3g).

**Endpoint contracts (all behind global auth; admin ones behind `requireMasterAdmin`):**

| Endpoint | Notes |
|---|---|
| `GET /api/me/access` | any signed-in user; ensures record; returns `{ success, access: { uid, email, role, status, planId, plan, features, limits (null for master admin), usage, isMasterAdmin } }` |
| `POST /api/me/register` | explicit ensure after signup; returns access + user + `created` |
| `GET /api/admin/users` | all records, newest first |
| `POST /api/admin/users` | `{ email, displayName?, planId?, role? }` → 201 `{ user, invite: { status, error?, messageId? } }`; duplicate email → 409 (see Deviation 2) |
| `PATCH /api/admin/users/:uid` | planId / role (`admin|user`) / status / displayName; self-disable → 409 |
| `DELETE /api/admin/users/:uid` | self-delete → 409; returns `{ platformRecordDeleted: true, authAccountDeleted: false }` (see Deviation 2) |
| `GET /api/admin/signup-requests` | pending users, newest first |
| `POST /api/admin/signup-requests/:uid/approve` | `{ planId? }` (default plan if omitted); returns user + honest `approvalEmail` status |
| `POST /api/admin/signup-requests/:uid/reject` | `{ note? }` → status `disabled` + `rejectionNote` |
| `GET /api/admin/plans` | `{ plans, featureKeys }` |
| `PUT /api/admin/plans/:planId` | create-or-update; validates feature keys + non-negative limits; `isDefault` unsets the others |
| `GET /api/admin/config/master-admins` | `{ stored, env, effective }` |
| `PUT /api/admin/config/master-admins` | `{ emails }` replaces the stored list; guardrail violations → 409 |
| `GET /api/admin/audit?limit=100` | newest first, limit clamped 1–500 |

## Part 2 — Dashboard graphs (prompt Part 2)

- **Endpoint:** `GET /api/dashboard/stats?range=7d|30d|90d` (invalid range → 400). Response `{ success, range, workspaceId, generatedAt, stats }` where `stats` carries: `kpis` (totalLeads, qualifiedLeads, activeCampaigns, outreachSent, outreachReplies, callsMade, meetingsBooked, tasksDueToday, tasksOverdue — each `{ value, newInRange, delta }`, delta `null` where not honestly derivable), `funnel` (all lead stages, zero-filled), `leadsOverTime` (zero-filled per-day series), `campaignPerformance` (per campaign sent/opened/replied), `callActivity` (`caption: 'Call Studio sessions'`, `simulated: true`, per-day bars + outcome buckets), `followUpHealth` (dueToday, overdue, completedInRange, completed series), `snapshotUpdatedAt`.
- **Data path (see Deviation 3):** `POST /api/dashboard/snapshot` accepts partial sections (`leads`, `campaigns`, `callSessions`, `tasks`) and merges them per workspace; the stats endpoint aggregates the stored snapshot. Workspace is derived server-side (`ws_pulsar_master` for master admins, `ws_<uid>` otherwise); a non-admin naming another workspace → 403 (battery-verified: a second user sees zeros, never the owner's records).
- **Client:** new `DashboardProgress` section at the top of the renamed Dashboard — range switch refetches, KPI strip, recharts funnel / leads-over-time / campaign performance / call activity + outcome donut / follow-up health, loading skeletons, and honest empty states ("No activity recorded… real zeros"). The call panel is captioned **"Call Studio sessions — sessions recorded in the app (simulated in-browser; not carrier calls)"**. `CampaignManagementWorkspace` syncs its real campaign counters (opened/replied derived from each campaign's stored delivered count × open/reply rates). `RCMLead.createdAt` is stamped when leads enter the app and `ActionItem.completedAt` when a task is completed — going forward only, never backfilled.

---

## Deviations (all forced by the environment, each following a Phase 0 precedent)

1. **Platform data persists in `serverStore`, not Firestore.** The prompt's model is written by the server via the Firebase Admin SDK; this environment has no `firebase-admin` package and no Admin credentials — the identical constraint behind Phase 0's C8 deviation. The state is held in Firestore-shaped collections (`users`, `plans`, `masterAdminEmails`, `audit`, `usage`, `snapshots`) inside the existing persisted store, so a Firestore adapter can replace the accessors in `server/platform.ts` without touching handlers or middleware. The client-side rules (§3g) were still updated as specified.
2. **Admin user creation cannot mint a Firebase Auth account** (no Admin SDK). `POST /api/admin/users` creates the platform record `active` on the chosen plan with uid `invite:<uuid>`; on the invitee's first sign-in the record is adopted by email and re-keyed to their real uid (battery-verified). The invite email says to sign up with that email address — it never claims an account was created in Firebase. Likewise DELETE removes only the platform record and reports `authAccountDeleted: false`.
3. **Stats aggregate a client-synced snapshot, not server-read Firestore.** The server has no Firestore read path (Deviation 1), so — extending the existing `/api/scheduler/report-stats` precedent — the client syncs the real records it holds and the server aggregates them. Consequences, all honest-by-construction: records without timestamps count toward totals but never into a dated series (no backfilled history); campaign outreach KPIs report `delta: null` because campaign counters are cumulative and undated; tasks due-today/overdue are point-in-time counts (`delta: null`).
4. **Master-admin stored list starts empty rather than seeded from `OWNER_EMAILS`.** Prompt §3b suggested seeding the Firestore list from env; the Phase 0 constraint (owner identity env-only, fail-closed) is preserved by keeping env as a separate, always-effective break-glass source and letting the tab manage only the stored list — the union is the effective set, and the 409 guardrails evaluate the union.
5. **Plan/status gates apply to users who have a platform record.** Records are created at sign-in (`/api/me/access`), via `/api/me/register`, or by an admin. Authenticated users with no record predate the platform model and pass the gates — this is what keeps the Phase 0 battery (whose tokens never touch `/api/me/*`) green while every real signup through the new client is gated from its first `/api/me/access` call.
6. **Call-outcome mapping for the snapshot** (client-derived from real records): warm transfers and completed Call Studio sessions → `answered`; leads in `Voicemail` status with a contact date → `voicemail`; leads in `Audit Scheduled` with a contact date → `callback_booked`. `no_answer` has no recording source yet and stays 0 rather than being inferred.
7. The graphs live in the renamed **Dashboard** (the classic view the prompt was grounded in). The alternate `LiquidGlassDashboard` view was outside the prompt's scope and is unchanged.

## Files changed

- **New:** `server/platform.ts`, `src/components/AdminAccessControlCenter.tsx`, `src/components/DashboardProgress.tsx`, `tests/platform.test.ts` (21 tests), `tests-phase1-3.py` (42-check battery).
- **Renamed:** `src/components/CommandCenterDashboard.tsx` → `src/components/Dashboard.tsx` (component + props renamed).
- **Server:** `server.ts` (platform routes, feature/limit gates on 13 existing endpoints, usage metering, boot log), `server/serverStore.ts` (platform state slot), `server/mailer.ts` (footer copy).
- **Client:** `src/App.tsx` (Dashboard import, admin route, sidebar access props, upgrade notice, createdAt/completedAt stamping), `src/components/SpatialSidebar.tsx` (Dashboard label, feature map, locked rendering, owner-only Admin item), `src/components/SpatialCommandPalette.tsx` (entry title), `src/components/AuthGate.tsx` (awaiting-approval + disabled screens), `src/context/AuthContext.tsx` (access state), `src/services/api.ts` (access/admin/dashboard helpers + types), `src/components/CampaignManagementWorkspace.tsx` (campaign snapshot sync), `src/components/CSVUploadModal.tsx` (createdAt alias row), `src/types.ts` (`admin_access` module, `createdAt`, `completedAt`).
- **Rules:** `firestore.rules` (§3g deny-all matches for plans/platformConfig/adminAudit).

## Deploy notes for the founder (unchanged gates + one addition)

1. Phase 0 items stand: set `OWNER_EMAILS` + `VITE_OWNER_EMAILS`, `BRIEFING_RECIPIENT_EMAIL`, and the `platformConfig/masterAdmins` Firestore doc; publish the updated `firestore.rules`.
2. The stored master-admin list starts empty — env owners are effective immediately; add stored admins from the Master Admin tab as needed.
3. M8 remains open (Gemini model IDs unverifiable without a real key) — unchanged from Phase 0.
