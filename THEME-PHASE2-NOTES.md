# Pulsar Theme — Phase 2: Whole-Site First Theme + Logout + Menu Pin + Admin Reachability (Phoenix line)

**Status: built + verified locally, PUSHED (see commit below).** Founder
authorization 2026-10-24: "Go ahead with the dashboards and apply same look
on the whole site all pages… then we'll push for now… If it look good we'll
go ahead otherwise we'll revert back." Base head before push: `45bd2080`
(Google removal). No feature removed; no route removed; presentation only,
except the display-only role labels and the new unavailable panel (both
change no gate). No server code changed — none was needed (see §4).

## 1. Whole-site theme (the "separate dashboard" complaint)

Phase 1 themed the shell + dashboard only; every other module kept its own
interior styling, so the dashboard looked like a different app. Phase 2:

- **Glass bridge (`src/styles/theme-vessa.css`)**: module interiors share
  the legacy glass surface classes (`glass-standard/elevated/base/floating/
  panel/card`). Inside `.pv-shell` those surfaces now resolve to the theme
  card (white 24px / deep ink in dark mode, theme border + shadow), so all
  modules inherit the same card language. `.glass-modal` is deliberately NOT
  bridged: several modals pair it with an explicit dark background + light
  text, which a bridge would have made unreadable.
- **LiquidGlassDashboard interior, scoped retint**: the `--lg-*` tokens are
  shared with AuthGate/Header, so they were NOT changed globally. App.tsx
  wraps the LiquidGlassDashboard render in `<div className="pv-lg">` and
  theme-vessa.css re-maps the `--lg-*` tokens under `.pv-lg` only (light +
  dark). AuthGate and Header keep the original glass tokens. This resolves
  the Phase 1 open question in favor of "theme it in place" (the founder
  also approved pushing the whole theme now, so no default-view flip was
  made — the Classic dashboard remains one toggle away).
- **Dark-only workspaces converted, not just bridged** (a white bridged
  surface under legacy white text would be unreadable, so these files got
  real class conversions): CampaignManagementWorkspace, GoogleTasksWorkspace,
  AIAgentFleetWorkspace, IntegrationsAdminWorkspace — heroes, card names,
  inputs, rows and chips now use pv ink/muted/card-soft/border tokens, and
  violet/cyan primary buttons became the theme green gradient. All
  remaining `text-white` in those files is on green buttons (verified).
- **Shared-constant modules**: AdminCommandCenter (`cardCls`/`inputCls`,
  active tab → theme green) and PipelineWorkspace (`card`/`input`/`btn`/
  `btnGhost`, active tab → theme green) — one edit each retints every
  card/input/tab in those modules.
- **SettingsModal**: shell → pv card, header icon → theme green, inputs →
  pv card-soft/border/ink with theme focus ring. A few deliberate dark
  accent panels inside it (feature descriptions) were left dark with their
  white text intact.
- **LeadStatusPieChart**: the one non-ternary dark chart card — converted
  to pv card + pv text/chip tokens (its floating tooltip stays dark by
  design).
- **AuthGate screens**: loading, pending-approval and disabled screens now
  render on the theme gradient with pv cards (their own classes only; no
  global token change). Pending-screen copy and sign-out behavior unchanged.
- Left as-is on purpose: ambient canvas layers (ZoeyPulsarCore,
  FuturisticOrbWorld, voice listener chrome), chart segment fills, and the
  dark gradient hero panels in chart components (their gradient
  background-image is unaffected by the surface bridge and their light
  text still reads on it). Modal shells that use `.glass-modal` keep legacy
  glass — overlays, not pages.

## 2. Logout button — what was broken

`signOut` existed only in `Header.tsx`, which is **never rendered**, so the
app had no visible logout anywhere. Fixed in two places, both wired to the
existing `useAuth().signOut` (no new auth logic):
- `SpatialSidebar` footer: signed-in account block (avatar initial, email,
  role chip) + a Sign out icon button (visible in collapsed rail too).
- `SpatialCommandBar` profile dropdown: the old "Switch to
  Admin/Customer" button was a production no-op (`setQuickProfile` only
  logs a warning — it could never grant admin, yet looked like it could).
  Replaced with a real **Sign out** entry.

## 3. Menu expand + pin — what was broken

Two discoverability bugs in `SpatialSidebar`:
- The pin toggle rendered **only in the wide state** (`!isCollapsed`), so
  from the collapsed rail there was no way to pin at all.
- The pin/collapse controls were wrapped in `hidden lg:flex`, so on mobile
  (the founder's phone) there was **no expand/pin control whatsoever**.
Fixed: the pin toggle now renders in every state (pinning from the rail
also expands it, since pinned ⇒ wide), the collapse toggle still hides
while pinned (locked wide by design — the unpin button is the escape
hatch, now titled "Unpin sidebar (collapse allowed again)"), and the
controls render on mobile too. Pin persists in the existing
`pulsar_sidebar_pinned` localStorage key and App's
`effectiveSidebarCollapsed = pinned ? false : collapsed` logic is
unchanged. Verified by code inspection + build (no browser session can
click through in this environment; live check is the founder's).

## 4. Admin Command Center reachability + the "Customer (Read-Only)" trap

What the founder saw, and why:
- `App.tsx` rendered `AdminCommandCenter` only when
  `access?.isMasterAdmin` (server-derived). The live site is static-only,
  so the server check never succeeds → the menu entry was silently absent
  and the role banner read "Customer (Read-Only)".
- `AuthContext` also derives a client `isMasterAdmin` from the Firestore
  profile role, which for the owner email depends on build-time
  `VITE_OWNER_EMAILS` — if the Vercel build lacks it, the client banner
  stays "Customer" even after the server is live. That is cosmetic only:
  the center itself is gated by the server.

What changed (display only — the gate is untouched):
- The sidebar now shows **Admin Command Center** to any signed-in user,
  with a lock mark until server-verified master admin. Non-masters land on
  a new `AdminUnavailablePanel`: it renders NO admin data and grants
  nothing. When the server is unreachable it says so plainly ("site is
  currently served as a static page… unlocks automatically once the Pulsar
  server is deployed"); when reachable but non-master it says to ask the
  owner or sign in with the owner account.
- The sidebar footer shows the signed-in email + role, and the App role
  banner + command-bar role chip now distinguish three states instead of
  lying: `Master Admin` / `Customer (Read-Only)` / `Server offline ·
  access unverified`. These labels change no permission.
- **Server verification (no deadlock):** `server/platform.ts`
  `ensureUserRecord` — an `OWNER_EMAILS` address is created as
  `master_admin` + `active`, and an existing record for that email is
  upgraded to `master_admin` + `active` on sign-in. No server fix was
  needed and none was made.

What the founder must still do himself for master access (stated once,
factually): sign in with **mnabeel1777@gmail.com** once the Oracle server
is live — the server deploy remains blocked on his SSH permission flip
(Deny → Ask on the muse.ai web settings page). There is NO master
password to share and none was created: master access is that owner email
(Firebase sign-in, with Forgot password on the gateway if he has
forgotten his own account password), recognized by the server on first
sign-in. The Vercel build env carrying `VITE_OWNER_EMAILS` would also fix
the client-side banner/profile role cosmetically, but it is NOT required
for the Admin Command Center itself.

## Verification (2026-10-24)
- `npx tsc --noEmit` — clean
- `npm test` — **88/88 pass**
- `npm run build` — OK (built CSS contains the pv bridge + `.pv-lg`;
  built JS contains the unavailable-panel copy and "Sign out")
- `python3 tests-access-gateway.py` — **13/13 pass**
- `python3 tests-phase1-3.py` — **42/42 pass**
- Pre-push blob check: repo head still `45bd2080`; staging files match
  the dev copy (diff-verified) before push.

## Pushed files (Phase 1 union + Phase 2)
Phase 1 (staged since 2026-10-24, first push now): `src/styles/
theme-vessa.css` (new), `src/index.css`, `src/context/ThemeContext.tsx`,
`src/App.tsx`, `src/components/SpatialSidebar.tsx`,
`src/components/SpatialCommandBar.tsx`, `src/components/NavigationDock.tsx`,
`src/components/DashboardProgress.tsx`, `src/components/Dashboard.tsx`,
`src/components/LiquidGlassDashboard.tsx`, `THEME-PHASE1-NOTES.md`.
Phase 2: `src/App.tsx`, `src/components/SpatialSidebar.tsx`,
`src/components/SpatialCommandBar.tsx`, `src/components/AuthGate.tsx`,
`src/components/AdminCommandCenter.tsx`,
`src/components/AdminUnavailablePanel.tsx` (new),
`src/components/PipelineWorkspace.tsx`,
`src/components/CampaignManagementWorkspace.tsx`,
`src/components/GoogleTasksWorkspace.tsx`,
`src/components/AIAgentFleetWorkspace.tsx`,
`src/components/IntegrationsAdminWorkspace.tsx`,
`src/components/SettingsModal.tsx`,
`src/components/LeadStatusPieChart.tsx`,
`src/styles/theme-vessa.css`, `THEME-PHASE2-NOTES.md` (this file).

## Revert path
Previous commit: `45bd2080` ("Gateway: remove Continue with Google option
(founder decision)"). The connector push is snapshot-based (add/update
only, no force-push, no deletions): revert by pushing a new commit that
restores the `45bd2080` tree for the files above (retrievable from repo
blobs; the pre-push dev tree is also backed up at
`/tmp/pulsar-phase2-backup/` — ephemeral, so the repo blobs are the
durable source). The only file that would linger is the new
`theme-vessa.css`/`AdminUnavailablePanel.tsx`, which become dead code
once `index.css`/`App.tsx` stop importing them.
