# Pulsar Access Gateway — Notes (Phoenix line, 2026-10-23)

Built at the founder's request to mirror the RCM Copilot gateway screens
(sign-in gateway + "Request Enterprise Access" + administrator approval),
adapted to Pulsar's model (plans instead of roles).

## What was checked first

The live RCM Copilot deployment (rcm-copilot-20.vercel.app, AI Studio line)
was inspected before building: it is also static-only on Vercel — its
`/api/*` calls return 404 there. Its gateway works as far as Firebase Auth
sign-in goes (Firebase is its primary auth, with a backend `/api/auth/signin`
fallback that is dead on Vercel). Pulsar already uses Firebase Auth, so its
sign-in works live today; what the gateway adds is the structured
**Request Access** flow whose details feed the existing approval engine.

## What changed

### Client — `src/components/SignInPage.tsx`
- The "Create Account" tab is now **Request Access**, modelled on the
  Copilot form: Full Name, Work Email, **Organization**, **Requested Plan**
  (Trial/Starter/Growth select with one-line descriptors), Password,
  **Confirm Password**, and a required **Terms of Service / Privacy
  Policy acceptance checkbox** ("accounts require administrator approval").
- Validation: password ≥ 8 chars, passwords must match, organization
  required, terms required.
- On success the account is created (Firebase) and the request details are
  submitted to the server; the success copy now states the truth: the
  account is **pending administrator approval**.
- Sign-in gained **"Remember this workstation"** — a real control wired to
  Firebase persistence (local vs session) via `signInWithEmail(email,
  pass, remember)` in `src/firebase.ts` / `AuthContext`.
- Google sign-in button already existed ("Continue with Google") — kept.

### Client — delivery that cannot be lost (`src/services/api.ts`)
- `submitAccessRequest(details)` POSTs `/api/me/access-request` with the
  user's ID token. It **never throws**: if the API is unreachable (the
  current static-only production reality), the details are stashed in
  localStorage under the uid.
- `retryStashedAccessRequest()` is called from `AuthGate` whenever the
  awaiting-approval screen renders, so a stashed request is delivered on
  a later sign-in once the server is live. The stash clears on success.
- `PlatformUserRecord` gained `organization?` and `accessRequest?`.

### Server — `server/platform.ts` + `server.ts`
- `PlatformUser` gained `organization?` and `accessRequest?`
  ({ organization, requestedPlanId, termsAcceptedAt, submittedAt }).
- `submitAccessRequest(state, user, input)` validates: organization
  required (≤120 chars), requestedPlanId must exist in the plan catalogue
  (else `UNKNOWN_PLAN`), termsAcceptedAt must be a parseable timestamp
  (else `TERMS_ACCEPTANCE_REQUIRED`). Writes an audit entry
  (`user.access_request`). The requested plan is a **preference only** —
  it grants nothing; status stays `pending_approval`, planId stays null.
- New route `POST /api/me/access-request` (token-authenticated; reachable
  in `pending_approval` state by design) returns the updated access + user.

### Admin — `src/components/AdminCommandCenter.tsx`
- Signup Approvals rows now show **Organization** and **Requested plan**,
  and the plan dropdown **preselects the requested plan** (the admin can
  still override before approving).

### AuthGate copy fix
- The awaiting-approval screen no longer promises an approval email
  (delivery depends on the mailer being configured); it now says approval
  is checked by signing back in and the screen clears automatically.

## Verification

- `npx tsc --noEmit` — clean. `npx vite build` — OK.
- `npm test` — **88/88** (85 + 3 new `submitAccessRequest` unit tests).
- New HTTP battery `tests-access-gateway.py` — **13/13**: 401 signed out,
  pending signup, the three 400 validations, details persisted on the
  record, submission grants nothing (feature endpoint still 403
  ACCOUNT_NOT_ACTIVE), non-admin 403 on the queue, admin queue shows org
  + requested plan, approve-with-requested-plan activates on Growth.
- Regressions: Phase 0 battery 38 pass / 2 sandbox skips; Phases 1–3
  42/42; Admin Command Center 52/52; Phases 4–6 51/51.

## Live-state note

Production (pulsar-20.vercel.app) serves the new gateway UI immediately
(static deploy). The request-details endpoint activates when the Pulsar
server goes live on the Oracle VM (pending the founder's SSH-permission
step); until then, submissions made on the live site are stashed on the
user's device and auto-delivered on their next sign-in after the server
is up. No request is silently dropped.
