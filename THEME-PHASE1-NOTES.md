# Pulsar Theme — Phase 1: App Shell + Dashboard (Phoenix line)

**Status: built + verified locally, STAGED ONLY — NOT pushed.** Founder rule
(see-first): approval comes from the standalone preview
`~/workspace/your_files/Pulsar-Themed-Dashboard-Preview.html` before any push.
Base head: `f7685572` (gateway redesign). No server/API changes. No feature
removed; every handler, prop, and behavior is preserved.

The theme is the founder-approved "first build" ("Field & Sage"): cream/sage
page gradient `#F3F5EC → #E9EDE0`, deep forest green `#0B5D3B`, white cards at
24px radius, pill segmented controls, tinted icon chips, delta pills, red
count badges. Project font stack kept (Outfit display + Plus Jakarta Sans).

## What was built

### Token layer — `src/styles/theme-vessa.css` (new, imported by index.css)
- `.pv-shell` design tokens for light + dark (`.dark .pv-shell`,
  `[data-theme="dark"] .pv-shell`): page gradient, card/soft surfaces, border,
  ink/muted, green `#0B5D3B`, accent `#1DA068`, bright `#25B878`, mint tints,
  amber/red/sky/violet tints, pill track + active colors, shadows.
- Component classes: `.pv-card` / `.pv-panel` (24px radius), `.pv-seg` (small
  pill segmented, white active pill), `.pv-tabs` (large pill tabs, dark active
  pill in light mode / light pill in dark mode), `.pv-chip` + tint modifiers,
  `.pv-delta` (up/down/flat/warn), `.pv-count` (red pill badge, `.on-rail`
  variant), `.pv-rail` + `.pv-nav-btn` (floating rail + nav states),
  `.pv-group-label`, `.pv-kpi-grid` / `.pv-kpi` / `.pv-kpi-detail` (expand
  animation), `.pv-statbox` (min/avg/max), `.pv-track` (progress bars).
  `prefers-reduced-motion` disables the transitions.
- Global page tokens retinted: `--app-bg` light `#F3F7FA → #EDF0E1`, dark
  `#0B1220 → #0A100C`; quantum-bg radial tints shifted blue → green;
  `ThemeContext` body + meta theme-color updated to the same two hexes
  (the theme toggle itself is untouched and keeps working).

### App shell
- `src/App.tsx` — root div carries `pv-shell`; content padding adjusted for
  the floating rail (`lg:pl-20/64 → lg:pl-[6.5rem]/[17.5rem]`); role banner
  retinted (sky/amber pv tints, white chips, violet niche pill → pv violet
  tint, role pill → pv card pill). No logic changes.
- `src/components/SpatialSidebar.tsx` — floating rail on desktop
  (`lg:top-3/bottom-3/left-3`, 28px radius, pv card surface/border/shadow);
  nav buttons use `.pv-nav-btn` with **filled-green active state** (was violet
  glass); counts now render as **red pill badges** in expanded mode and as
  corner badges on the icon in collapsed mode (previously hidden when
  collapsed); group labels, pin button (mint when pinned), collapse button,
  brand header, and bottom "Autonomous Hub" badge retinted. Pin/collapse,
  brand-click → Dashboard, locked-not-hidden (§3e), master-admin item, and
  mobile drawer behavior all unchanged.
- `src/components/SpatialCommandBar.tsx` — header surface → pv card tones;
  search affordance → rounded-full pill with ⌘K kbd chip; niche switcher →
  mint pill; fleet indicator → mint pill with green pulse; PST clock → soft
  pill; bell → round button with red count badge; **Quick Action → green
  gradient pill** (was violet); theme toggle → round pv button; user chip →
  pill with tinted role avatar; dropdown panels' dark bg aligned to the new
  ink (`#121B14`). All menus, handlers, and the PST clock unchanged.
- `src/components/NavigationDock.tsx` — container → 24px pv card surface;
  active tab teal `#0D9488` → pv green with green shadow; accent icons teal →
  pv accent; mobile bottom bar + mobile menu retinted; task badge → pv red.
  Scroll/carousel/drawer logic untouched.

### Dashboard (command_center)
- `src/components/DashboardProgress.tsx` — presentation rebuilt, **data layer
  byte-preserved** (snapshot sync payload, fetch effect, range state):
  - Header: themed title + subtitle; range switch is now `.pv-seg`
    (7d/30d/90d, still wired to `getDashboardStats`).
  - **KPI cards (all 9)** in theme style: label, tinted icon chip, 34px
    **count-up** value (rAF hook, reduced-motion aware), delta pill
    (direction-aware; Tasks Overdue inverts — a drop is green), "+N in
    range" caption, and a **sparkline drawn from the KPI's real series**.
  - **Expand-in-place (new interaction, from the founder's "instrumental"
    reference):** clicking a card (or Enter/Space) grows it to full row
    width — flex-basis animates with a spring cubic-bezier (~0.55s) while the
    detail region expands (max-height/opacity), siblings reflow beneath.
    The detail panel shows: the metric's **real chart** (recharts Area/Bar)
    built from the series the stats API already returns for that metric
    (leads → leadsOverTime/funnel, outreach → campaignPerformance, calls →
    callActivity.perDay, tasks → followUpHealth.completedSeries), an
    in-panel **7d/30d/90d switch bound to the same range state** (real
    refetch), **Min / Avg / Max / Total** computed from that series, a close
    (×) button, and the honest Call Studio caption + outcome chips on the
    call KPIs. Task KPIs show the live follow-up-health line.
  - **Thresholds (only where natural):** Tasks Overdue ≥1 → amber border +
    amber value, ≥5 → red border/glow + red value; Tasks Due Today ≥1 →
    amber. No metrics invented — the API has no bounce/failure fields.
  - Chart panels (funnel, leads over time, campaign performance, call
    activity + outcomes pie, follow-up health) → `.pv-panel` with the theme
    palette (greens + amber; outcome colors answered #1DA068 / voicemail
    #DE9A2E / no-answer grey / callback #2E7FA8). The simulated-data caption
    is preserved verbatim. Empty states remain honest zeros.
- `src/components/Dashboard.tsx` — filter/context bar → pv panel; niche
  button → mint pill; **filter tabs → `.pv-seg`**; Prospect Radar → green
  pill, Dialer Studio → pv pill, Field Maps → sky-tint pill. The 5-card
  local KPI strip → pv cards with tinted icon chips and **count-up numbers**
  (Discovered / Qualified / Calls Placed / Warm Transfers; Pipeline Value is
  a string and stays static; this strip has no time series, so no sparklines
  were fabricated for it). Priority Outreach queue, funnel (bars now use
  `.pv-track` with sky/green/violet stage fills), Live Warm Transfers,
  Action Items, and Autonomous Fleet panels → pv panels/rows. All content,
  filters, and handlers unchanged. (`useCountUp` is exported from
  DashboardProgress and reused here.)
- `src/components/LiquidGlassDashboard.tsx` — chrome only: the view switcher
  is now `.pv-tabs` pill tabs (Overview/Pipeline/Outreach/Report/Compliance)
  and "Switch to Classic Dashboard" is a pv pill button. Its internal
  `lg-glass` panels are NOT rethemed this phase (see limitations).

## Verification (2026-10-24)
- `npm test` — **88/88 pass** (baseline preserved).
- `npx tsc --noEmit` — clean.
- `npm run build` — OK; built CSS contains the pv classes.
- `python3 tests-phase1-3.py` — **42/42 pass**, incl. dashboard snapshot sync,
  stats shape for 7d/30d/90d, invalid range → 400, workspace isolation,
  honest zero state. (Battery convention: `server-data/` was reset before
  the run; it is a local dev store and repopulates from app records.)

## Staged files (dev copy → ~/workspace/projects/pulsar-2.0/, NOT pushed)
- `src/styles/theme-vessa.css` (new)
- `src/index.css`, `src/context/ThemeContext.tsx`, `src/App.tsx`
- `src/components/SpatialSidebar.tsx`, `src/components/SpatialCommandBar.tsx`,
  `src/components/NavigationDock.tsx`, `src/components/DashboardProgress.tsx`,
  `src/components/Dashboard.tsx`, `src/components/LiquidGlassDashboard.tsx`
- `THEME-PHASE1-NOTES.md` (this file)
No sync-record entry was appended (that happens only after a confirmed push).

## Limitations / not cleanly themeable this phase
1. **LiquidGlassDashboard interior** (the default command_center view): its
   panels use the self-contained `--lg-*` glass system shared with AuthGate
   and Header. Retinting those tokens globally would silently retheme the
   auth gate too, and rewriting its ~1,170 lines was out of scope — so only
   its switcher chrome is themed. Its default-view status is unchanged
   (founder decision pending: flip default to the themed Classic dashboard,
   or do a dedicated LG interior pass in Phase 2).
2. **ZoeyPulsarCore / FuturisticOrbWorld / AlwaysOnVoiceListener**: ambient
   3D/voice layers left functionally and visually as-is (the voice panel was
   already bottom-right + minimized by default; restyling its canvas UI is
   not a class swap).
3. **Other modules' interiors** (Admin Command Center, Pipeline Ops,
   sequences, Call Studio, etc.) render inside the themed shell but keep
   their own interior styling — per the phase scope (shared chrome only).
4. The classic Dashboard's 5-card local strip has no per-metric time series
   in the app, so it got count-ups but no sparklines (nothing fabricated).
