# Pulsar — Phases 4–6 Build Notes (Phoenix line)

**Date:** 2026-10-23 (Asia/Karachi)
**Scope:** Master Build Prompt Phases 4, 5 and 6, per the MVP Blueprint build
order (lead discovery & enrichment → notes/tasks/daily summary → outreach
sequencing). Phase 7 (calling) was **not** built — it stays gated on the
founder's compliance review and calling budget. No dialing code was added,
and the "Call Studio sessions / simulated" labelling is unchanged everywhere.

Everything below was built on top of the verified Phase 0 + Phases 1–3 state
and verified live (see Test results). Founder gates were worked around with
the established Phase 0 pattern — injectable providers, honest
`not_configured` states, deterministic flagged fallbacks — never faked past.

---

## What shipped

### Phase 4 — Lead discovery, registry, enrichment, assisted LinkedIn

**Registry (server-side system of record)** — new module `server/pipeline.ts`,
persisted in the file-backed store (`pipeline` slot) behind the same
Firestore-shaped access pattern as Phases 0–3.

- `POST /api/leads/ingest` — accepts only sourced records. A record is
  **rejected** when it has no provenance source, is flagged `simulated: true`,
  or comes from a demo source (`gemini_synthetic`, `founder_demo`).
  Provenance `{source, sourceId, retrievedAt}` is stored on every lead;
  `sourceId` is derived (NPI → email → hash of the row), never invented.
- Dedupe precedence, workspace-scoped: **NPI → email → phone (last 10
  digits) → normalised name+address**. NPI-only CMS records (no email, no
  practice name — the address is the registry mailing address) merge onto
  matching rows instead of creating name-less duplicates.
- `GET /api/leads/registry` — returns the registry with a **live**
  suppression flag (`suppressedNow`) computed at read time.
- **Suppressions** — `GET/POST /api/suppressions`, `DELETE /api/suppressions/:id`
  (master-admin only, audit-logged). Types: email, phone, NPI, practice name.
  Matched at ingest (flagged), at enrollment (refused), and **again before
  every send**. Phone matching normalises to the last 10/7 digits.
- `POST /api/leads/enrich` — deterministic ruleset `thrivemed-default-v1`.
  Fit score is the sum of named rules (specialty fit +30, decision-maker
  title +20, registry-verified identity +15, organisation scale +15,
  has phone +10, has email +10); **every score stores the rules that
  produced it** plus derived `contactability`/`outreachReady` fields, each
  with its rule name. No field is ever invented: an NPI record has no EHR,
  no claim volume, no pain points — those are simply absent.

**Assisted LinkedIn** (no unattended automation, per blueprint):

- `POST /api/linkedin/assist/prepare` — from a registry lead or a prospect:
  creates an assist record with a draft (`draftSource: 'gemini'` only when a
  Gemini key is configured, otherwise `'template'`, built only from fields
  actually present), and returns `openInLinkedIn` for the human to open.
- `POST /api/linkedin/assist/:id/log-outcome` — the human logs
  `sent_manually | accepted | replied | declined | no_response`.
- The LinkedIn automator UI now uses this flow: **"Prepare & Open LinkedIn"**
  prepares one prospect (the auto-runner stops after one — human-paced),
  per-item outcome buttons log what the human actually did, and the old
  simulated auto-send path is gone from the UI. The server send route still
  returns its honest 501 `not_connected` (asserted by the battery).
- The existing live **CMS NPI Registry** search feeds ingest directly
  (Pipeline Ops → Registry tab), as does CSV import with `source: csv_import`.

### Phase 5 — Call notes, tasks, daily summary inputs

- `POST /api/notes` (manual) and `POST /api/notes/from-transcript` — a note
  exists **only** from a real transcript or a human's own words; an empty
  transcript is refused (400). The transcript is stored verbatim.
  - With a Gemini key: summary + action items, `summarySource: 'gemini'`.
  - Without: `summarySource: 'deterministic'`, `summary: null` (nothing is
    paraphrased or invented), and action items are extracted **only** from
    transcript lines containing explicit action markers ("follow up",
    "send", "schedule", "call back", …), each quoted from the transcript.
- Structured fields (interest level, objections, next step) create real
  tasks via the shared task-creation path — deduped by normalised title per
  lead+note, so re-submitting a transcript creates **zero** duplicate tasks.
- `GET /api/notes`, `GET/POST /api/tasks`, `PATCH /api/tasks/:id` — task
  status changes **only** through an explicit human action; completion
  stamps `completedBy`/`completedAt`. No auto-completion exists anywhere.
- `GET /api/briefing/daily-stats?date=YYYY-MM-DD` — the daily summary is
  counted from records: leads created/enriched, notes, tasks created /
  completed / overdue, LinkedIn outcomes, sequence sends and failures,
  plus call activity captioned **"Call Studio sessions"** with
  `simulated: true`, a `needsFounder` list (tasks assigned to the founder),
  and an honest zero-activity note. The Pipeline Ops UI shows this card so
  the founder can reconcile the figures against the underlying records.

### Phase 6 — Email sequencing with real delivery state

- `POST/GET /api/sequences`, `PATCH /api/sequences/:id` (draft → active →
  paused), `POST /api/sequences/:id/enroll` — 1–10 steps, per-step
  `delayDays` and a send window (`HH:MM` in the sequence's IANA timezone,
  validated server-side). Enrollment refuses leads with no email, suppressed
  leads, and duplicates.
- Engine (`processDueSequences`, run by a 60-second server interval and by
  `POST /api/sequences/tick`): for each due enrollment it **re-checks
  suppression at send time**, checks the send window, checks the sequence
  creator's **plan** (feature `campaigns` + the new `sendsPerMonth` limit —
  Trial 0, Starter 1,000, Growth 10,000), renders `{{practiceName}}`,
  `{{firstName}}`, `{{specialty}}`, `{{state}}` from real lead fields, and
  sends through the existing Resend mailer.
- **An enrollment advances only when the mailer reports `sent`.** Every
  attempt writes a delivery record (`GET /api/sequences/deliveries`) with
  the real outcome — `sent` + provider message id, `failed` + error, or
  `not_configured` (no key: nothing sent, enrollment **not** advanced,
  10-minute retry backoff). Pausing a sequence stops future sends.
- `POST /api/webhooks/resend` — Standard-Webhooks (Svix) signature
  verification with a 5-minute timestamp tolerance (signature is the auth;
  the route is exempt from Firebase auth only for that reason). Without
  `RESEND_WEBHOOK_SECRET` it returns an honest 503 `not_configured`; a bad
  signature returns 400. Verified events progress delivery status
  (`delivered` etc.); a **bounce or complaint suppresses the address, stops
  its active enrollments, and flags the lead** automatically.

Client: new **Pipeline Ops** module (nav: Outreach → Pipeline Ops) with
Registry / Notes & Tasks / Email Sequences tabs — NPI search+ingest, CSV
ingest, enrichment, suppression management, transcript→note+tasks, task
completion, today's counted stats, sequence create/enroll/activate/pause,
manual run, and the delivery log with real provider ids and honest
`not_configured` states.

---

## Endpoint contracts (new)

| Route | Auth / gates | Notes |
|---|---|---|
| `POST /api/leads/ingest` | active account, feature `lead_discovery`, `leadsPerMonth` on created | per-record outcomes: created/duplicate/rejected(+reason) |
| `GET /api/leads/registry` | any signed-in user | live `suppressedNow` flag |
| `POST /api/leads/enrich` | active account | ruleset `thrivemed-default-v1` |
| `GET/POST /api/suppressions` | any signed-in user | workspace-scoped |
| `DELETE /api/suppressions/:id` | master admin | audit-logged |
| `POST /api/linkedin/assist/prepare` | active account | draftSource: template \| gemini |
| `GET /api/linkedin/assist` | any signed-in user | |
| `POST /api/linkedin/assist/:id/log-outcome` | any signed-in user | fixed outcome enum |
| `POST /api/notes`, `POST /api/notes/from-transcript` | active account | empty transcript → 400 |
| `GET /api/notes`, `GET/POST /api/tasks`, `PATCH /api/tasks/:id` | any signed-in user | status only via explicit PATCH |
| `GET /api/briefing/daily-stats` | any signed-in user | workspace-scoped; date validated |
| `POST/GET /api/sequences`, `PATCH /api/sequences/:id` | create: feature `campaigns` | steps/window/timezone validated |
| `POST /api/sequences/:id/enroll` | signed-in user | ≤200 leads; per-lead outcomes |
| `GET /api/sequences/deliveries` | signed-in user | real provider status/ids |
| `POST /api/sequences/tick` | signed-in user | runs the due-send engine for the caller's workspace |
| `POST /api/webhooks/resend` | Svix signature | 503 `not_configured` without secret; 400 on bad signature |

Non-master users naming another workspace get 403, matching Phases 1–3.

---

## Test results (2026-10-23, final code)

- `npx tsc --noEmit` — **clean**. `npx vite build` — **OK**.
- `npm test` — **78/78** (48 previous + 30 new pipeline unit tests:
  provenance/dedupe/suppression, enrichment rules, draft builder,
  transcript extraction, task status path, daily stats, template render,
  send window, plan caps, sequence advance/non-advance/pause, webhook
  sign/verify/bounce-suppression).
- `python3 tests-phase4-6.py` — **51 passed, 0 failed, 0 skipped**.
  Includes: live CMS NPI ingest **hand-verified field-by-field against the
  real CMS record**; dedupe of an NPI-only record onto its emailed row;
  hand-built lead refused; transcript → tasks with zero duplicates on
  re-submit; daily-stats reconciliation to a hand count + honest zero day;
  plan gates (pending account 403, Trial plan 403, cross-workspace 403);
  no-key tick → `not_configured` delivery and enrollment **not** advanced;
  and, against a local mock Resend endpoint via `RESEND_API_URL`, real
  3-step delivery with provider message ids, signed delivered-webhook
  progression, bad-signature 400, pause, post-enrollment suppression
  (`skipped_suppressed`), bounce webhook suppression, and the plan send cap.
- Regression: `python3 tests-phase0.py` — **38 passed, 2 skipped** (same
  sandbox-internet skips as baseline); `python3 tests-phase1-3.py` —
  **42 passed, 0 failed**. No regressions.
- Test residue cleaned (server-data removed; all test servers killed via
  `fuser -k <port>/tcp`).

---

## Deviations & founder gates (honest list)

1. **File-backed store** (standing Phase 0/1–3 deviation): pipeline state
   persists in `server-data/store.json` behind Firestore-shaped access —
   no Firebase Admin credentials exist in this environment.
2. **Suppressions are workspace-scoped**, not global. The blueprint models
   one founder-run workspace; per-workspace scoping is the multi-tenant-safe
   reading and matches the rest of the platform. Promote to global when the
   founder confirms single-workspace operation.
3. **Fit ruleset is a code-level default.** The founder's written ICP
   (blueprint decision D2) is still open, so `thrivemed-default-v1` encodes
   conservative, inspectable defaults (RCM-relevant specialties, decision-maker
   titles, verified identity, contactability). Revising the ICP = editing
   one ruleset, and historical scores keep the ruleset name that made them.
4. **Send windows use the sequence timezone** (per-lead timezone is not
   sourced anywhere yet); steps default to 08:00–21:00 sequence-local.
5. **Plan context for sequences** resolves from the sequence creator's
   platform record; creators with no record (pre-platform accounts) are
   grandfathered with no cap, per the platform migration rule — never an
   invented limit. A `sendsPerMonth` counter/limit was added to plans
   (Trial 0 / Starter 1,000 / Growth 10,000 seeds).
6. **Phase 4's "50-lead pilot list" acceptance** was verified mechanically —
   live NPI ingest + field-level hand-verification in the battery — not by
   persisting a founder pilot list. Building ThriveMed's actual list needs
   the founder's ICP sign-off (D2) and his target geography.
7. **Phase 5's "five consecutive days" acceptance** is satisfied
   structurally (stats counted from records, reconciled to a hand count,
   honest zero days) but the literal 5-day live run has not happened — it
   starts when the founder uses the app daily.
8. **Phase 6's "test inbox" delivery** was proven against a local mock
   Resend endpoint (`RESEND_API_URL` override added to the mailer for
   exactly this; production default unchanged). The mock's message ids are
   real within that proof and are reported as mock ids. A real inbox
   delivery + real webhook events need the founder's Resend API key and
   `RESEND_WEBHOOK_SECRET` — both are his to provide via Secure Vault.
9. **Gemini-summarised notes/drafts** need a Gemini API key (founder gate,
   same as Phase 0 finding M8 — the in-code Gemini model IDs remain
   unverified until a key exists). Until then: template drafts and
   verbatim-transcript notes, both labelled as such.
10. **Push still blocked** on the founder creating the empty private
    `Pulsar-2.0` repo (Phoenix cannot create repos) — unchanged from
    Phases 1–3, and per his instruction his part stays with him.

## Not built (by design)

- Phase 7 calling / handoff — founder's compliance review + budget gate.
- Any LinkedIn automation beyond prepare-and-log (ToS/ban risk).
- Any invented data: no synthetic leads, metrics, summaries, or delivery
  states exist on these paths.
