# Pulsar Calendar — Vencimientos-style month view

## What it is
A dedicated **Calendar** destination in the sidebar rail (Workspace group,
icon + label expanded, icon collapsed; pin/collapse behavior unchanged),
themed in Pulsar's Vessa theme (cream/sage canvas, white 24px cards,
forest-green accents, `--pv-*` tokens only, so dark mode follows the
existing `.dark` switch).

Layout mirrors the Moxen "Vencimientos" component: a month-grid calendar
with color-coded dots on dates that have items, plus a totals card with
month and year totals. A day-detail panel lists the selected day's items;
a totals card sits beside the grid on wide screens.

## Behavior
- Month prev/next + Today button; Sunday-start grid; leading/trailing
  days are clickable and switch to their month.
- Clicking a day lists that day's real items. Clicking a call opens Call
  Studio with the matched lead; clicking a task opens Follow-ups & Tasks.
  No synthetic lead is ever constructed (unlike the reminders dial path).
- Days with no items show an honest empty state; nothing is guessed onto
  a day.

## Data sources — real data only (the honest rule)
A task appears on the grid ONLY if it has a real, parseable date:
- `scheduledDateTime` (ISO) when present, else
- `due` parsed with `Date.parse`.
Relative labels ('Tomorrow 9:30 AM PST', 'Friday, 2:30 PM PST',
'Scheduled via Google Tasks', 'Today', …) do NOT parse and are never
placed on a guessed day. They are counted in the footer line
("N tasks without a set date aren't on the grid") with a link to
Follow-ups & Tasks.

Categories:
- **Call scheduled** (green dot) — tasks with `isScheduledCall`.
- **Task due** (sky dot) — all other tasks with a parseable date.

Totals are COUNTS ONLY (dated items in the shown month/year, split by
category). The app computes no dated dollar/pipeline figures for these
items, so none are shown or invented.

Deliberately NOT shown: campaign dates. Campaigns have no dates in
shared App state — the campaign workspace keeps only display strings
('Tomorrow 09:00 PST', 'Mon-Fri 08:30 - 16:30 PST'). Until campaigns get
real date fields in shared state, no campaign dots are fabricated.

## Files
- `src/components/CalendarView.tsx` (new)
- `src/types.ts` (`'calendar'` added to `PulsarSpatialModule`)
- `src/components/SpatialSidebar.tsx` (Calendar entry, Workspace group)
- `src/App.tsx` (import + `activeModule === 'calendar'` render)

## Verification
- `npx tsc --noEmit`: clean
- `npm run build`: OK (bundle carries calendar markers)
- `npm test`: 88/88
- `tests-access-gateway.py`: 13/13
- `tests-phase1-3.py`: 42/42

## Notes
- No auth/permission changes; no owner-email hardcoding; server-offline
  honesty states untouched; dark mode works via `--pv-*` tokens.
- Revert base: `9605c03` (restore the 5 pushed paths as a normal commit,
  no force-push).
