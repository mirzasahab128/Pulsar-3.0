# Pulsar: Instructions for Google AI Studio

How to use: (1) upload `pulsar_stage2.zip` to your AI Studio project (or import the code), (2) paste **MASTER PROMPT** below as the first message, (3) when it finishes, paste the **FOLLOW-UP PROMPTS** one at a time, checking the report after each.

---

## MASTER PROMPT (paste this first)

You are the lead engineer for **Pulsar**, an AI-powered business-development workspace (lead discovery, prospect research, outreach preparation, call practice, meeting notes, reminders, daily executive report). First market: U.S. healthcare revenue-cycle (RCM) / medical billing, but the product is configurable for any industry.

### Ground rules (non-negotiable)
1. **Do not rebuild from scratch.** The uploaded code is the source of truth. Preserve working features, file structure and naming. Make targeted changes.
2. **Never fake it.** A button, dashboard, mock response or simulated call is not a working feature. If something is not connected to a real service, the UI must say "Not connected" and the report must say so. No random numbers, invented stats, invented leads or "200 OK" placeholders.
3. **Security first.** No secrets in client code. Every `/api/*` route requires a verified Firebase ID token. Authorisation is enforced by Firestore rules and the server, never by client state.
4. **Free options first.** Use free tiers (Firebase Spark, Gemini free tier, Resend free tier, NPI Registry, Cloud Run free tier). Never start a paid service or send live outreach without my explicit approval.
5. After every task, report: what changed, which files, how you verified it, and anything still **simulated / not connected**. Do not claim a feature works unless you ran it.

### What is already in the uploaded code (do not redo, build on it)
- React 19 + Vite + Tailwind 4 front end; Express server `server.ts` (+ `server/security.ts`, `server/mailer.ts`); Firebase Auth + Firestore; Gemini via `@google/genai`.
- **Owner/admin:** `drarshalooz@gmail.com` is the owner. Their verified account becomes role `admin`, display name **"Master Admin"**, workspace `ws_pulsar_master`. All other users are read-only `customer` users with their own workspace `ws_<uid>`. Owner list lives in env `OWNER_EMAILS` / `VITE_OWNER_EMAILS` and in `firestore.rules` (`isOwner()`); keep them in sync.
- **Backend security:** Firebase ID-token verification (no extra dependency), rate limits, security headers, SSRF guard for webhooks, owner-only scheduler routes. Tests in `tests/security.test.ts` (`npm test`).
- **Firestore rules** (`firestore.rules`): no self-assigned role/workspace, tenant isolation by `workspaceId`, private profiles and chats.
- **Honest integrations:** lead discovery via the public NPI Registry (`/api/leads/npi-search`); Gemini-generated leads are labelled UNVERIFIED; LinkedIn notes are prepared for manual sending (LinkedIn forbids automation); email reports via Resend (`RESEND_API_KEY`); phone calls, live transfer and WhatsApp are **not connected** and CallStudio is labelled a simulation.
- **Design system:** `src/styles/liquid-glass.css` (Liquid Glass tokens, light + dark) and `src/components/LiquidGlassDashboard.tsx` (new default Command Center; classic dashboard kept behind a toggle).
- **Auth UI:** `src/components/SignInPage.tsx` + `AuthGate.tsx` (full-page sign-in/sign-up with Google and email, forgot password, friendly errors). Nothing in the app is reachable until signed in.
- `README.md`, `.env.example`, `Dockerfile`, `STAGE2_CHANGELOG.md` describe setup and status.

### Task 1: get it building and running (do this first)
- Run `npm install`, `npm run lint` (tsc), `npm run build`, `npm test`. Fix every error **without deleting features**. The previous engineer could not run a build, so expect some type errors in recently changed files (`AuthContext.tsx`, `firebase.ts`, `LiquidGlassDashboard.tsx`, `SignInPage.tsx`, `server.ts`).
- Confirm the app starts, the sign-in page shows when signed out, and `/api/health` returns JSON without auth while every other `/api/*` route returns 401 without a token.

### Task 2: Firebase + owner setup
- Use the project's Firebase config. Enable Google and Email/Password sign-in. Make sure the app's deployed domain is in Firebase Authorized domains.
- Publish `firestore.rules`. Confirm with two test accounts: (a) the owner email, after verification, is created as `admin` / "Master Admin"; (b) any other account is created as `customer`, read-only, and a manual attempt to write `role: 'admin'` to its own profile is **rejected**.
- Remove any remaining hardcoded fake profiles or "quick admin" shortcuts. A signed-out visitor must see only the sign-in page.

### Task 3: sign-in page (polish)
Keep the existing component, improve only what is missing: loading states, keyboard/Enter submit, accessible labels and focus rings, mobile layout (375px), email-verification banner for unverified email users with a "Resend verification" action, and a sign-out control in the header. Light and dark both must look intentional.

### Task 4: dashboards (take it further)
Build on `LiquidGlassDashboard.tsx`; keep the glass system in `liquid-glass.css`. Add a dashboard switcher (segmented control in the header) with these views. **Every number must come from real data (Firestore documents, API responses) or show an empty state.**
1. **Overview** (exists): KPIs, pipeline flow, growth rings, priority queue, tasks, "What is live".
2. **Pipeline:** funnel by lead status, source breakdown (NPI / AI draft / CSV import / manual), verified vs unverified, state heat map (reuse existing map components), aging (days since last contact).
3. **Outreach:** emails drafted/sent (only counts real sends), LinkedIn notes prepared vs marked sent manually, practice calls, reminders due today/overdue.
4. **Executive report:** a live preview of exactly what the 4:00 PM Pacific daily email contains, with a "Send test to me" button (owner only) that calls `/api/scheduler/trigger-now` and shows the real delivery status (`sent`, `not_configured`, `failed`).
5. **Compliance:** suppression list size, leads missing consent/eligibility checks, outbound kill-switch state.
Persist daily numbers: create a Firestore collection `daily_stats/{workspaceId_YYYY-MM-DD}` updated from real events, and have the client POST the latest snapshot to `/api/scheduler/report-stats` so the 4 PM job has real data. Add sparklines/trends only when there are at least 2 real data points.

### Design requirements (apply to every new screen)
Concept "Growth Spectrum", Apple-style spatial **Liquid Glass**:
- Colours: deep-ocean navy base, **emerald #10B981** = growth (primary, hero tile), aqua #22D3EE = intelligence, gold #F5B83D = wins/opportunity, coral #F43F5E = risk, violet #8B5CF6 = AI only.
- Two distinct moods: **Dark** = night ocean, luminous translucent glass, glowing accents. **Light** = morning mint, frosted white glass, soft shadows. Not just inverted colours.
- Glass: `backdrop-filter: blur(26px) saturate(185%)`, 1px translucent border, inner top highlight, soft long shadow, drifting aurora backdrop, pointer-following specular sheen and subtle tilt (max 5deg).
- Typography: Outfit for numbers/headings, Plus Jakarta Sans for body, tabular figures for metrics.
- Accessibility: WCAG AA contrast in both themes, visible focus, `prefers-reduced-motion` and `prefers-reduced-transparency` fallbacks, 44px touch targets, works from 360px to 4K.
- Reuse tokens (`--lg-*`) and classes (`lg-glass`, `lg-btn`, `lg-pill`, `lg-chip`, `lg-track`). Do not add one-off colours.

### Task 5: report back
Give me a table: Feature | Real / Partial / Simulated / Not connected | How you verified it. Include build, test and rules-test results. List anything you could not do in AI Studio and what I must do manually (keys, console clicks).

---

## FOLLOW-UP PROMPTS (one at a time, after the master prompt succeeds)

### Prompt A: persistence and workspace settings
Move `pulsercm_settings`, niche template choice and LinkedIn/CRM settings from `localStorage` into Firestore under `workspaces/{workspaceId}` (and subcollections where needed). Keep localStorage only for UI preferences (theme, sidebar). Respect read-only customers (no writes). Add Firestore rules tests for tenant isolation (user in workspace A cannot read or write workspace B). Migrate existing localStorage values once on first load.

### Prompt B: compliance guardrails (required before any outreach goes live)
Add: (1) a **suppression / do-not-contact list** (Firestore, per workspace) checked before any email, call or message is prepared; (2) **consent and eligibility fields** on leads (source, lawful basis note, last verified date) and a block on contacting unverified AI-generated leads; (3) a global **"Pause all outbound"** kill switch (owner only) that every outbound path checks server-side; (4) **human approval** step before any email is sent; (5) an audit log collection recording who approved what and when. Add unit tests for each rule. Add a clear in-app note that AI-voice calling and cold outreach are regulated (e.g. TCPA, state laws) and need legal review before use.

### Prompt C: real email sending (free tier)
Wire the Email Outreach screen to send through `server/mailer.ts` (Resend). Requirements: server-side only; auth + rate limit; per-workspace daily cap (default 50); unsubscribe link and physical-address footer; suppression check; store each send in Firestore with provider message id and status; receive Resend webhooks (delivered, bounced, complained) on a verified-signature endpoint and update status; bounced/complained addresses go to the suppression list automatically. Do not send anything until I approve a test to my own address.

### Prompt D: scheduler that survives restarts
Replace the in-memory `setInterval` scheduler with a reliable approach: an endpoint `/api/scheduler/run` protected by a secret header, called by Google Cloud Scheduler (free tier) at 4:00 PM `America/Los_Angeles` daily. Store config and run history in Firestore, make runs idempotent per day, and report real delivery status. Document the exact Cloud Scheduler setup steps for me.

### Prompt E: telephony plan (do NOT activate; plan only)
Write a design for real AI calling with live transfer using a provider trial (Twilio or Telnyx): architecture, webhooks, call-state machine, how transfer to the owner's phone works, consent/recording-disclosure handling, costs per minute, what accounts/numbers/verification I must complete, and a test plan using only my own phone numbers. Mark CallStudio clearly as simulation until this is built and tested. Wait for my approval before implementing.

### Prompt F: deployment
Prepare a production deploy on Google Cloud Run (free tier) from the Dockerfile: env var/secret inventory, min-instances setting, custom domain notes, Firebase Authorized domains, a post-deploy smoke-test checklist (sign-in, 401 on API without token, health, report test email to me), and rollback steps.

---

## Things I (the owner) must do manually
- Add keys in AI Studio Secrets / `.env`: `GEMINI_API_KEY`, `RESEND_API_KEY` (free), optional `VITE_GOOGLE_MAPS_API_KEY` (restrict by referrer).
- Publish `firestore.rules` in the Firebase console if AI Studio cannot.
- Add the deployed domain to Firebase Authorized domains.
- Sign in once with the owner Google account so the Master Admin profile is created.
