# Pulsar — UI Fixes Notes (Phoenix line)

**Date:** 2026-10-23 (Asia/Karachi)
**Scope:** Three user-reported UI fixes, client-side only. No server behavior
changed. Shipped to `mirzasahab128/Pulsar-2.0` main (Vercel production,
pulsar-20.vercel.app) in two commits:

- `0b242a218c7f1d1b283bf6813a50cd69e71f3d9f` — voice panel, Header brand, sidebar pin (4 paths)
- `9c49211d12cc4a6fb691da5d46710826912e7207` — sidebar brand button follow-up (1 path; see Fix 2 note)

---

## Fix 1 — Voice input: minimizable, bottom-right (`AlwaysOnVoiceListener.tsx`)

- The panel moved from `fixed bottom-4 left-4` to the **right side**:
  `fixed bottom-24 right-4`, rendered only when expanded, anchored above
  the floating mic button.
- New `isMinimized` state, persisted in localStorage key
  **`pulsar_voice_minimized`**. Default on first load is **minimized**
  (`true` when the key is absent) so the panel never covers content on
  arrival.
- Minimized state = a single round floating mic button (56px, bottom-right,
  z-40) whose icon/color mirror the listener state: listening → emerald
  gradient + ping; Need-Based idle → teal Mic; Always-On → amber spinning
  Activity; Off → MicOff. Clicking it expands the panel; clicking it again
  (it then shows a Minimize2 icon) collapses back.
- The expanded panel gained an explicit **minimize button** (Minimize2) in
  its top-right action row, next to the existing feedback / help /
  drawer chevron controls. All existing functionality is untouched: mode
  switcher, start/stop listening, quick-action Speak/Stop, keyword chips,
  the inner expand drawer, command history, warnings, and the z-50 help
  modal (still rendered outside the panel, so it survives minimizing).
- Component props/API unchanged; App.tsx wiring untouched.

## Fix 2 — Pulsar brand loads the Dashboard (`Header.tsx` + sidebar follow-up)

- `Header.tsx`: the existing left brand (PulsarGalaxy icon box + "Pulsar"
  word) is now a button — both the icon box and the wordmark call
  `onSelectTab?.('command_center')`, matching how Header already passes
  module ids to `onSelectTab` (e.g. `'google_forms'`). Title/aria-label:
  "Pulsar — go to Dashboard", hover scale on the icon, hover underline on
  the wordmark. The "Growth OS" suffix now hides below the `sm` breakpoint
  to save title-bar space; the niche row below is untouched.
- **Finding that required a follow-up:** `Header` is imported in
  `src/App.tsx` but is **never rendered** by the current app shell (the
  shell uses the sidebar + NavigationDock), so Vite tree-shakes it out of
  the production bundle entirely — verified: Header-only strings ("AI
  Suite", "Gemini Intelligence Suite") appear 0 times in both the local
  dist and the live bundle. The Header change is in place for whenever the
  component is mounted, but on its own it would not have changed the
  shipped app.
- Follow-up (same fix, second commit): the **sidebar's Pulsar brand** —
  the brand users actually see in the shipped navigation — is now a
  button (galaxy mark + "Pulsar" wordmark) calling the sidebar's existing
  `onSelectModule('command_center')`, i.e. it loads the Dashboard, and
  closes the mobile drawer when used there. Title: "Pulsar — go to
  Dashboard". Verified present in the live bundle after deploy.

## Fix 3 — Sidebar pin (`SpatialSidebar.tsx` + `App.tsx`)

- New App-level state `isSidebarPinned`, persisted in localStorage key
  **`pulsar_sidebar_pinned`**, read on load so pinning survives reloads
  and navigation.
- App computes `effectiveSidebarCollapsed = isSidebarPinned ? false :
  isSidebarCollapsed` and uses it for BOTH the sidebar's `isCollapsed`
  prop and the main content padding (`lg:pl-64` vs `lg:pl-20`), so while
  pinned no path can collapse the sidebar: the chevron is hidden, the
  App-level `onToggleCollapse` additionally early-returns while pinned,
  and the stored `pulsar_sidebar_collapsed` value is simply overridden
  (not erased — unpinning restores the previous collapse preference).
  (Audit: the chevron handler is the only writer of the collapsed key;
  there are no resize/route-change collapse paths in App.tsx.)
- Sidebar header gains a **Pin / PinOff** button (lucide `Pin`/`PinOff`,
  confirmed present in the installed lucide-react) next to the collapse
  chevron, desktop only like the chevron. Pinned state has a clear active
  style (teal fill + ring/glow) and `aria-pressed`; tooltips are
  "Pin sidebar open" / "Unpin sidebar".
- Placement note: the pin button renders in the wide state (next to the
  chevron, as specced). In the collapsed w-20 rail there isn't room for
  both controls, so to pin, expand once and pin; while pinned the sidebar
  is always wide, so Unpin is always reachable.

---

## Tests

- `npx tsc --noEmit` — **clean** (run after each commit's changes).
- `npx vite build` — **OK**; local bundle grep confirmed the new markers
  (`pulsar_sidebar_pinned`, `pulsar_voice_minimized`, "go to Dashboard"
  after the follow-up).
- `npm test` — **85/85** (unchanged baseline; client-only changes).
- `python3 tests-phase1-3.py` — **42/42** (spot check, no server impact).
- Test residue (`server-data`) cleaned.

## Shipping

- Pre-push head verified: GitHub blob SHA of `src/components/
  SpatialSidebar.tsx` matched pre-change staging exactly (head still
  `32f2ac862ca081fe7a1f8e0e285deaa690b1ae31`).
- Push 1: 4 paths → commit `0b242a218c7f1d1b283bf6813a50cd69e71f3d9f`;
  read-back of `src/App.tsx` blob-matched staging.
- Push 2: 1 path → commit `9c49211d12cc4a6fb691da5d46710826912e7207`;
  read-back of `SpatialSidebar.tsx` blob-matched staging
  (`980c016ae341ee7b471db7be07bac0793f6334a2`).
- Sync record `pulsar-2.0.muse-github-snapshot-sync.json` now has 5
  entries.
- **Live verification** (production bundle `index-C-ZnlNxT.js` at
  pulsar-20.vercel.app): `pulsar_sidebar_pinned` ×2,
  `pulsar_voice_minimized` ×1, "Pin sidebar" ×1, "go to Dashboard" ×1,
  "Minimize voice assistant" ×1 — all three fixes are live.

## Deviations

1. Fix 2 needed the sidebar follow-up described above because `Header`
   is not mounted in the app shell (pre-existing condition, not changed
   by this work). If Header is ever mounted, its brand button is already
   wired.
2. The pin button is wide-state-only (see Fix 3 placement note).
3. One push attempt was interrupted by a service restart; read-back
   confirmed it had not landed before it was safely re-run — no duplicate
   or partial state resulted.
