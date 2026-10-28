# Pulsar — Phase 0 (Trust Layer) Fixes — Phoenix Line

**Date:** 2026-10-22
**Tree:** `~/workspace/projects/pulsar-phoenix-line/` (copy of `pulsar-v2`; the AI Studio line source was not modified)
**Spec:** `Pulsar-Master-Build-Prompt.md` §Phase 0; findings from `Pulsar-Backend-Audit-2026-10-22.md`
**Status:** Complete, with one documented design deviation (C8 storage mechanism) and one open gap (M8). No git operations performed (repo `Pulsar-2.0` does not exist yet).

**Baseline (before changes):** `npx tsc --noEmit` clean; shipped `tests/security.test.ts` 11/11 pass — matching the audit's characterization of the source tree.

---

## Founder decision gate (C7) — action required, unchanged from the audit

Both hardcoded master-admin Gmail addresses found by the audit were removed from **everywhere**: `server/security.ts`, `firestore.rules`, and the client tree (`src/firebase.ts`, App/settings defaults, display fallbacks, seed data, an embedded rules sample). **No replacement address was hardcoded — not the founder's either.** Production owner selection is the founder's decision and is now pure configuration:

- Server owner gate: `OWNER_EMAILS` env (comma-separated). Unset/empty → **fails closed** (nobody is an owner) with a loud startup warning.
- Client owner recognition: `VITE_OWNER_EMAILS` build-time env, same value, unset → nobody.
- Firestore owner rule: the `platformConfig/masterAdmins` document (field `emails`), provisioned via Firebase console/Admin SDK.
- Scheduler briefing recipient: `BRIEFING_RECIPIENT_EMAIL` env or the owner-only config endpoint. Unset → the scheduler reports `not_configured` instead of emailing anyone.

Set these to the founder's chosen addresses before any production deploy. Acceptance tests used the throwaway `owner-test@example.com`.

## Verification summary (final run, 2026-10-22)

| Suite | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npx vite build` | OK |
| `npm test` (shipped suite + new Phase 0 suite) | **27/27 pass** (11 shipped + 16 new) |
| `python3 tests-phase0.py` (HTTP acceptance battery) | **38 passed, 0 failed, 2 skipped** (skips are sandbox-egress limits, below) |

The battery boots three real instances (main, `NODE_ENV=test` instance, low-quota instance) plus a local HTTP listener as an SSRF target, and re-runs the audit's failing checks. Test residue cleaned; `server-data/` and `tests/test-keys.json` are gitignored.

Skipped checks (environment-limited, not code failures): the two "webhook delivery to a real public 200 endpoint" checks — this sandbox cannot reach httpbin or similar public POST endpoints (DNS/egress restrictions; the CMS NPI registry, which the audit also used, IS reachable and was verified). Failure honesty for webhooks is proven in-sandbox (dead public IP → `success:false`, real per-record outcomes); the SSRF guard fails closed when DNS cannot be resolved.

---

## Per-finding log

### C1 — Fabricated data presented as real → FIXED
- **Lead scrape** (`POST /api/leads/scrape`): the Gemini "hyper-realistic lead" generator is deleted. With `DEMO_MODE=true` it returns the demo set, every record flagged `simulated: true, source: 'demo'`, response carries `simulated: true`. Otherwise: honest `{ status: 'no_live_source', leads: [] }`. (The prompt forbids inventing a provider; a real source is a later phase.)
- **LinkedIn prospects** (`/api/leads/linkedin-search`): invented-prospect fallback deleted → honest empty `not_configured` response. No compliant live source exists.
- **Daily briefing** (`/api/briefing/generate`): invented default metrics (42/18/6/35/3/$145,000) deleted — stats default to zeros; the invented-metrics fallback briefing deleted. No-Gemini path returns a deterministic briefing built only from caller-supplied stats with an explicit insufficient-data note (`source: 'deterministic'`). The Gemini prompt now forbids inventing metrics.
- **Call notes** (`/api/call/generate-notes`): fabricated fallback notes (always "Hot Lead") deleted → `not_configured` without a key; key + empty transcript → 400.
- **Transcription** (`/api/audio/transcribe`): fabricated "Dr. Vance" fallback transcript deleted → `not_configured`.
- **Smart filter** (`/api/linkedin/smart-filter`): fabricated "94%" confidence deleted; heuristic fallback returns `confidence: null` + a coarse `confidenceBand`, labeled `source: 'heuristic'`; Gemini results labeled `source: 'gemini'`.
- **Chat / live voice-turn fallbacks**: static fallbacks now carry `simulated: true` / `status: 'not_configured'`; the ai-turn deterministic fallback is flagged `simulated: true`.
- **NPI enrichment** (also M6): see M6.
- **Client**: demo records render with a visible "DEMO DATA — simulated sample records" banner in the leads view.
- Verified: battery A12a–A12g, A14 — invented names/metrics appear in NO response.

### C2 — One malformed request could kill the process → FIXED
- Root cause was unguarded fallback code running *outside* try/catch, plus zero field validation. Now: every route validates field types (`validateFields` + nested guards); both exact audit repros (`ai-turn` with string `objectionHandlers`, `scrape` with numeric `specialty`) return 400 — battery A8/A9, process alive after each.
- All 16 async API handlers are wrapped so rejections reach the new **global Express error handler** (JSON 500, malformed-JSON → 400); a body-shape guard rejects non-object JSON bodies with 400; `x-powered-by` disabled.
- Verified: battery A8–A11c (crash repros, malformed JSON, array body, wrong-typed field — process alive throughout).

### C3 — `NODE_ENV=test` auth bypass → FIXED (removed, not patched)
- The `TEST_AUTH_SECRET` short-circuit is **deleted**; no env combination skips signature verification. A served process running with `NODE_ENV=test` logs a loud warning; dev-mode test tokens now work only through the injectable cert-source pattern (§0.2 of the prompt), where verification always runs.
- Verified: battery instance B runs the plain server with `NODE_ENV=test` + `TEST_AUTH_SECRET` set — a self-minted owner JWT is rejected (401/503), never accepted (B1/B2); unit test "rejects a self-minted token with a garbage signature."

### C4 — `aud`/`iss`/`email_verified` unchecked → FIXED
- `verifyFirebaseIdToken` now enforces `aud` === Firebase project ID and `iss` === `https://securetoken.google.com/<projectId>` (project ID from `FIREBASE_PROJECT_ID` env, defaulting to `firebase-applet-config.json`), plus `iat` sanity and required `sub`; `requireOwnerMiddleware` additionally requires `email_verified === true`. Cert fetch has a 3s timeout and fails as **503 `AUTH_UPSTREAM_UNAVAILABLE`** (fail closed, distinguishable from a bad token).
- Verified: unit tests (valid token passes; wrong aud/iss/expired/wrong-key rejected) + battery A4/A6/A7.

### C5 — SSRF guard existed but protected nothing; webhook receipts fabricated → FIXED
- Both webhook endpoints now validate the URL through a strengthened async guard before any connection: scheme check, literal-IP classification (loopback/private/link-local/**CGNAT 100.64/10**, multicast, benchmarking 198.18/15, IPv6 loopback/link-local/ULA/IPv4-mapped), **DNS resolution with every resolved address classified** (rebinding-safe), and a redirect-revalidating fetch (manual redirects, each hop re-checked, max 3, timeout).
- Receipts are real: webhook-test returns the actual status code (`success` only on 2xx; dead target → `success: false`); webhook-sync dispatches for real and records per-record `delivered`/`failed` with the real status code. The hardcoded `DELIVERED_200` and the always-"confirmed 200" test response are gone; invented per-record defaults (`smartFilterScore || 95`, `'High (Direct Signer)'`) are now `?? null`.
- These were the **only** server-side fetches of user-supplied URLs (verified by grep; the NPI fetch uses a fixed https host with a timeout — also fixed under M6).
- Verified: battery A16–A19 + listener received **zero** hits from guarded endpoints; A17b/A18 (metadata IP → 400); DNS-rebinding covered by unit tests (this sandbox's `/etc/hosts` is read-only, so the HTTP-level rebinding case runs against the injected-resolver unit test instead).

### C6 — LinkedIn send was a coin flip claiming success → FIXED (honest labeling; no automation built)
- Server: `POST /api/linkedin/send-connection` now returns **501** `{ success: false, simulated: true, status: 'not_connected', error: 'LinkedIn sending is not connected' }`. The `Math.random()` acceptance simulation and "safely dispatched" language are deleted.
- Client: `apiService.sendLinkedInConnection`'s catch branch fabricated `success: true` + a random `simulatedAccepted` — replaced with the honest not-connected shape; the outreach UI now shows "Not sent — LinkedIn sending is not connected. No invitation was dispatched." and never marks an item sent/accepted on a failed send.
- Verified: battery A13 (501 + flags).

### C7 — Master-admin identity was two hardcoded Gmail addresses → FIXED (see founder gate above)
- Server: `OWNER_EMAILS` is env-only; empty → fail closed + loud startup warning; boot log prints the configured owner count.
- Rules: `isOwner()` reads `platformConfig/masterAdmins` (and requires `email_verified`); no addresses remain in the file.
- Client: `src/firebase.ts` owner list is env-driven (`VITE_OWNER_EMAILS`, fail-closed empty); all display/default fallbacks to those addresses removed (App settings defaults are now empty strings — a stranger's address can no longer become the briefing recipient by default).
- Verified: `grep` for both addresses over `server/`, `server.ts`, `firestore.rules`, `src/` → **0 hits** (remaining mentions are test assertions of their absence and this document); battery A4–A6 with a throwaway env owner.

### C8 — Server persisted nothing → FIXED (one documented deviation)
- Scheduler config, send history (capped 30), and latest report stats now persist, along with per-user AI quota counters (M7). State loads at boot and saves on every mutation; the boot log reports whether persisted state was loaded. The in-process scheduler interval + in-handler dedupe now do a synchronous check-and-set on the **persisted** `lastTriggeredDate` before dispatch, so a restart can no longer re-send a day's briefing.
- **Deviation:** the prompt's example used a Firestore scheduler document. This build uses a minimal **file-backed store** (`server/serverStore.ts`, `server-data/store.json`, atomic tmp+rename writes) because no Firebase Admin credentials exist in this environment and restart-persistence had to be verifiable end-to-end; the load/save interface is shaped so a Firestore adapter can replace it without touching call sites. `server-data/` is gitignored, mirroring the RCM Copilot Phoenix line.
- Verified: battery P1–P5 — stats + config + trigger recorded, server killed and rebooted, all state intact.

### M1 — Firestore rules overexposed → FIXED
- `/test` read: public → signed-in only. `/users/{userId}` read: any signed-in user → self or admin. `/chat_sessions/{id}` read: any signed-in user → the session's `userId` or admin (list queries must filter by `userId`). `isOwner()` hardened per C7. (Rules can't be executed in this sandbox — verified by review; deploy-tested when the founder next publishes rules.)

### M2 — Google cert fetch had no timeout → FIXED
- 3s `AbortController` timeout; failures surface as 503 `AUTH_UPSTREAM_UNAVAILABLE` (battery instance B exercised this path live).

### M3 — Rate limiter evadable via spoofed X-Forwarded-For → FIXED
- Limiter keys on the verified Firebase `uid` when authenticated; `X-Forwarded-For` is honored **only** when `TRUST_PROXY=true` (behind a known proxy); otherwise the socket address is used.
- Verified: unit test + battery A15 (130 requests with rotating XFF still produce 429s).

### M4 — Scheduler status exposed to any signed-in user → FIXED
- `GET /api/scheduler/status` is now behind `requireOwnerMiddleware`. Verified: battery A5 (non-owner → 403).

### M5 — Scheduler wrapper laundered `not_configured` into `success: true` → FIXED
- The trigger wrapper's `success` is true only when the mailer status is `sent`; no recipient configured records an honest `not_configured` history entry. Verified: battery P3 (`trigger-now` without a Resend key → `success: false, status: 'not_configured'`).

### M6 — NPI records decorated with invented enrichment under `verified: true` → FIXED
- Invented fields (`ehrSystem`, `monthlyClaimVolume`, `painPoints`) moved under `estimates: { estimated: true, …null/empty }`; the `(555) 000-0000` placeholder phone is gone (`phone: null` when CMS reports none); response gains a `provenance` block (source NPPES, retrieval time, verified fields). Verified: battery A22 against the live CMS registry.

### M7 — Gemini spend unmetered → FIXED (server-side metering + daily cap)
- Authenticated per-user daily quota (default 200, env `AI_DAILY_QUOTA_PER_USER`) on all Gemini-backed routes; counters persist (C8 store); excess → **429 `AI_QUOTA_EXCEEDED`**. Spend is now metered and capped server-side. (Per-workspace plans/limits arrive with Phase 2's plan model.)
- Verified: battery instance C (quota = 3; 4th call → 429 `AI_QUOTA_EXCEEDED`).

### M8 — Unverifiable Gemini model IDs → OPEN (cannot complete in Phase 0)
- Model IDs in code (e.g. `gemini-3.8-flash`, `gemini-3.5-transcribe`, `gemini-3.8-live`) cannot be confirmed or corrected without a real Gemini API key to test against, and guessing replacements would repeat the original sin. Left untouched and flagged here, exactly as the prompt's Phase 0 direction requires. First task once a key exists: verify each ID against the live API and pin the verified set in config.

### M9 — Minor cleanups → OUT OF PHASE 0 SCOPE
- Not touched (later phases per the master prompt sequencing).

---

## What changed, by file

- `server/security.ts` — rewritten: env-only owners (fail closed), test-bypass deleted, aud/iss verification, cert timeout + 503 semantics, strengthened SSRF (DNS + redirect revalidation), uid-keyed rate limiter (XFF only behind `TRUST_PROXY`), injectable cert/DNS sources for tests. Exports `FIREBASE_PROJECT_ID`, `AuthUpstreamUnavailableError`.
- `server/serverStore.ts` — **new**: file-backed persistence (atomic writes).
- `server.ts` — global error handler + body-shape guard; `ah`/`validateFields`/`notConfigured` conventions; per-user AI quota middleware; honest rewrites of scrape / linkedin-search / send-connection / webhook-test / webhook-sync / generate-notes / briefing / transcribe / chat / voice-turn / ai-turn / smart-filter / NPI; scheduler persistence + owner-only status + honest success semantics; env-driven briefing recipient; loud boot diagnostics.
- `firestore.rules` — C7 owner lookup + M1 tightening.
- `src/firebase.ts`, `src/App.tsx`, `src/components/{Header,GoogleTasksWorkspace,LiquidGlassDashboard,SettingsModal,CodebaseViewerModal}.tsx`, `src/data/rcmSeedData.ts`, `src/types/rcmCopilot.ts` — hardcoded addresses removed (C7).
- `src/services/api.ts` — honest LinkedIn send fallback (C6). `src/components/LinkedInOutreachAutomator.tsx` — "Not sent" notice (C6). `src/components/LeadScraper.tsx` — DEMO DATA banner (C1).
- `tests/security-phase0.test.ts` — **new** (16 tests: token verification via injected cert source, owner gate, SSRF/DNS, XFF limiter). Shipped `tests/security.test.ts` untouched, still 11/11.
- `tests/test-server.ts`, `tests/gen-test-keys.mjs`, `tests/mint-token.mjs`, `tests-phase0.py` — **new** acceptance-battery harness.
- `.env.example` — documents `OWNER_EMAILS`, `BRIEFING_RECIPIENT_EMAIL`, `FIREBASE_PROJECT_ID`, `DEMO_MODE`, `AI_DAILY_QUOTA_PER_USER`, `TRUST_PROXY` (and `VITE_OWNER_EMAILS` belongs in the client build env). `.gitignore` — `server-data/`, `tests/test-keys.json`.

## Deploy notes for the founder

1. Set `OWNER_EMAILS` + `VITE_OWNER_EMAILS` (same value), `BRIEFING_RECIPIENT_EMAIL`, and create the `platformConfig/masterAdmins` Firestore doc with the same addresses.
2. Provide `GEMINI_API_KEY` / `RESEND_API_KEY` via the host's secret store; then close M8 (verify model IDs).
3. Set `TRUST_PROXY=true` only if the host terminates a known reverse proxy.
4. Publish the tightened `firestore.rules`; confirm the chat UI's session list query filters by `userId` (required by the M1 rule shape).
