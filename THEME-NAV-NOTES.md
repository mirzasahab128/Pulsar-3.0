# Theme nav structure — Vessa reference, Pulsar's own features

Founder brief (2026-10-24): build the navigation structure from the Vessa
dashboard reference (clean screenshot `~/workspace/user/files/506807_60_ftxe.jpg`)
for Pulsar, with Pulsar's own labels/destinations only — plus two refinements:
the sidebar must be a distinct FLOATING BUBBLE with gaps on all sides, and
very large radii throughout.

## What was missing (audit)

Top bar (`SpatialCommandBar.tsx`) had: search with ⌘K, tenant pill, niche
chip, Agents Operational status, PST clock, bell with a numeric badge, Quick
Action dropdown, theme toggle, user chip (first name + role). Missing vs the
reference structure: brand in the bar, centered pill tabs, a dedicated
settings button, a direct primary "+ New" button, and a time-aware greeting
in the user chip.

Rail (`SpatialSidebar.tsx`) had: brand header with pin/collapse, nav groups
with counts/badges, admin entry with lock, account footer + sign-out. Missing
vs the reference: the segmented sun/moon toggle pill at the TOP of the rail,
separated by a divider from the nav icons — and it was an attached
full-height panel, not a floating bubble.

## What changed

### Top bar → its own floating bubble
- Header is now `sticky top-0` with `mx-3 mt-3 mb-3`, `rounded-[28px]`, a full
  border, and theme background — a bubble spanning the width with cream
  showing through the gaps. It keeps sticking on scroll.
- Brand moved INTO the bar (reference carries the brand there): PulsarGalaxy
  + "Pulsar / Growth OS", clicking loads the Dashboard, as the rail brand
  used to. The rail no longer carries a brand header.
- Centered pill tabs (`hidden xl:flex`, so the bar never crowds on smaller
  screens): **Dashboard → `command_center`, Leads → `leads`,
  Campaigns → `campaigns`, Pipeline → `pipeline`**. Active tab renders in the
  deep-green pill; any other module (via sidebar/dock) leaves all tabs
  unselected rather than faking an active state.
- Dedicated settings icon button → the same Settings modal the sidebar's
  Settings opens (`setIsSettingsOpen(true)` in App).
- Direct **"+ New"** primary button → the new-prospect entry
  (`onOpenNewLeadModal`, i.e. the leads module — same destination as Quick
  Action's "Add New Prospect"). The Quick Action dropdown stays for its
  other actions (voice call, Gemini Copilot, CSV export).
- User chip now reads "**Good morning/afternoon/evening, {first name}**"
  above the existing role line; the profile menu (sign out, account) is
  untouched.
- Kept, not replaced: search ⌘K, tenant pill, niche chip, Agents
  Operational, PST clock, bell, Quick Action, bar theme toggle, sign-out.

### Bell badge — real source, unchanged
`unreadTasksCount` = `tasks.filter(t => !t.completed).length` (App.tsx),
already numeric in the bar. No hardcoded number anywhere.

### Rail → floating bubble with the theme pill on top
- Aside is now `fixed top-3 bottom-3 left-3` on mobile and
  `lg:top-[100px] lg:bottom-3 lg:left-3` on desktop — 12px below the bar
  bubble (bar: 12 + 64 + 12 = 88px, + 12px gap) — with `rounded-[28px]`,
  so it floats clear of the top bar, the content, and the screen edges.
- Rail top is now the vertical sun/moon pill (Sun above Moon; the active one
  fills deep green, the inactive one is muted), followed by the divider (the
  block's bottom border) and the nav list's gap, then the nav icons with
  their small red count badges — exactly the reference order.
- The pill drives the EXISTING ThemeContext (`setTheme`, persisted
  `pulsar_theme`). No second theme system. The bar's theme toggle stays.
- Pin + collapse moved to a control row in the footer (stacked in the
  collapsed rail so both buttons fit); behavior unchanged: pin locks the
  rail wide (`pulsar_sidebar_pinned`), collapse is unavailable while pinned.
- Kept: collapse/expand, pin, count badges, admin entry with its
  lock/unavailable panel, account footer, sign-out, mobile drawer + backdrop.

### App shell restructure
- The sidebar offset (`lg:pl-[6.5rem]` / `lg:pl-[17.5rem]`) moved off the
  shell onto a content wrapper below the bar, so the bar spans the full
  width while content still clears the floating rail. No other layout,
  module, auth, or permission logic changed.

### Radii
Bar bubble 28px, rail bubble 28px, tab container + tabs + buttons fully
rounded pills, cards 24px (existing theme). Light mode: new elements use
only `--pv-*` theme tokens — no dark gradients added; dark mode untouched.

## Verification
- `npx tsc --noEmit`: clean.
- `npm run build`: OK (bundle `index-8LKbB9Fd.js`, carries "Good morning"
  and "Light mode" markers).
- `npm test`: 88/88.
- `tests-access-gateway.py`: 13/13.
- `tests-phase1-3.py`: 42/42.
- No auth/permission changes; no owner-email hardcoding (owner identity
  stays env-only); no fake counts/statuses; server-offline honesty states
  untouched.

## Revert
Restore the pre-push tree for `src/App.tsx`,
`src/components/SpatialCommandBar.tsx`,
`src/components/SpatialSidebar.tsx` (+ this notes file) as a normal commit
on top — no force-push. Pre-push head: `d56b4dd9`.
