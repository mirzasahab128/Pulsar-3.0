import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, PhoneCall, CheckSquare, CalendarDays } from 'lucide-react';
import type { ActionItem } from '../types';

/**
 * CalendarView — Vencimientos-style month calendar for Pulsar.
 *
 * HONEST DATA RULE (do not weaken): only tasks with a real, parseable date
 * appear on the grid. A task's date is its ISO `scheduledDateTime` when
 * present, otherwise its `due` string parsed with Date.parse. Relative
 * labels ('Tomorrow 9:30 AM PST', 'Friday, 2:30 PM PST', 'Scheduled via
 * Google Tasks', 'Today', …) do NOT parse to a date and are never placed
 * on a guessed day — they are counted in the "no set date" footer line.
 * Campaigns have no dates in shared App state (the campaign workspace
 * keeps only display strings like 'Tomorrow 09:00 PST'), so no campaign
 * dots are shown; totals are COUNTS ONLY — the app computes no dated
 * dollar/pipeline figures for these items, so none are invented.
 *
 * Categories: scheduled call (isScheduledCall) vs task due (everything
 * else with a parseable date). Clicking an item navigates to the existing
 * surface for it: a matched lead's call studio for calls, otherwise
 * Follow-ups & Tasks. No synthetic leads are created here.
 */

type Category = 'call' | 'task';

interface DatedItem {
  task: ActionItem;
  category: Category;
  date: Date;
  dayKey: string;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function dayKeyOf(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseTaskDate(task: ActionItem): Date | null {
  const raw = task.scheduledDateTime || task.due;
  if (!raw) return null;
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) return null;
  return new Date(ms);
}

function timeLabel(task: ActionItem, date: Date): string {
  if (task.scheduledDateTime) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return task.due;
}

const CATEGORY_META: Record<Category, { label: string; dot: string; chip: string }> = {
  call: {
    label: 'Call scheduled',
    dot: 'bg-[var(--pv-green)]',
    chip: 'bg-[var(--pv-mint)] text-[var(--pv-green)]',
  },
  task: {
    label: 'Task due',
    dot: 'bg-[var(--pv-sky)]',
    chip: 'bg-[var(--pv-card-soft)] text-[var(--pv-ink)]',
  },
};

interface CalendarViewProps {
  tasks: ActionItem[];
  onOpenReminders: () => void;
  onOpenCallForTask: (task: ActionItem) => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const CalendarView: React.FC<CalendarViewProps> = ({
  tasks,
  onOpenReminders,
  onOpenCallForTask,
}) => {
  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [selectedDay, setSelectedDay] = useState<string>(dayKeyOf(now));

  const { byDay, undatedCount } = useMemo(() => {
    const map = new Map<string, DatedItem[]>();
    let undated = 0;
    for (const task of tasks) {
      const date = parseTaskDate(task);
      if (!date) {
        undated += 1;
        continue;
      }
      const item: DatedItem = {
        task,
        category: task.isScheduledCall ? 'call' : 'task',
        date,
        dayKey: dayKeyOf(date),
      };
      const list = map.get(item.dayKey) ?? [];
      list.push(item);
      map.set(item.dayKey, list);
    }
    return { byDay: map, undatedCount: undated };
  }, [tasks]);

  const monthName = new Date(cursor.year, cursor.month, 1).toLocaleDateString([], {
    month: 'long',
    year: 'numeric',
  });

  const countIn = (year: number, month?: number): { tasks: number; calls: number; total: number } => {
    let t = 0;
    let c = 0;
    byDay.forEach((items, key) => {
      const [y, m] = key.split('-').map(Number);
      if (y !== year) return;
      if (month !== undefined && m !== month + 1) return;
      for (const item of items) {
        if (item.category === 'call') c += 1;
        else t += 1;
      }
    });
    return { tasks: t, calls: c, total: t + c };
  };

  const monthTotals = countIn(cursor.year, cursor.month);
  const yearTotals = countIn(cursor.year);

  const shiftMonth = (delta: number) => {
    setCursor((prev) => {
      const d = new Date(prev.year, prev.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const goToday = () => {
    const d = new Date();
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
    setSelectedDay(dayKeyOf(d));
  };

  // Month grid (Sunday-start), including leading/trailing days.
  const cells = useMemo(() => {
    const first = new Date(cursor.year, cursor.month, 1);
    const startOffset = first.getDay();
    const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
    const daysInPrev = new Date(cursor.year, cursor.month, 0).getDate();
    const total = Math.ceil((startOffset + daysInMonth) / 7) * 7;
    const out: { date: Date; inMonth: boolean }[] = [];
    for (let i = 0; i < total; i++) {
      const dayNum = i - startOffset + 1;
      if (dayNum < 1) {
        out.push({ date: new Date(cursor.year, cursor.month - 1, daysInPrev + dayNum), inMonth: false });
      } else if (dayNum > daysInMonth) {
        out.push({ date: new Date(cursor.year, cursor.month + 1, dayNum - daysInMonth), inMonth: false });
      } else {
        out.push({ date: new Date(cursor.year, cursor.month, dayNum), inMonth: true });
      }
    }
    return out;
  }, [cursor]);

  const todayKey = dayKeyOf(new Date());
  const selectedItems = byDay.get(selectedDay) ?? [];
  const selectedDate = useMemo(() => {
    const [y, m, d] = selectedDay.split('-').map(Number);
    return new Date(y, m - 1, d);
  }, [selectedDay]);

  const pickDay = (date: Date, inMonth: boolean) => {
    if (!inMonth) {
      setCursor({ year: date.getFullYear(), month: date.getMonth() });
    }
    setSelectedDay(dayKeyOf(date));
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-[var(--pv-card)] border border-[var(--pv-border)] rounded-[24px] px-5 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-[12px] bg-[var(--pv-green)] text-white flex items-center justify-center shrink-0">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold text-[var(--pv-ink)] leading-tight truncate">Calendar</h2>
            <p className="text-xs text-[var(--pv-muted)] truncate">
              Tasks due and calls scheduled — real dates only, no guessed days.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="w-9 h-9 rounded-full border border-[var(--pv-border)] bg-[var(--pv-card-soft)] text-[var(--pv-ink)] flex items-center justify-center hover:bg-[var(--pv-mint)] transition cursor-pointer"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-extrabold text-[var(--pv-ink)] min-w-[150px] text-center">{monthName}</span>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            className="w-9 h-9 rounded-full border border-[var(--pv-border)] bg-[var(--pv-card-soft)] text-[var(--pv-ink)] flex items-center justify-center hover:bg-[var(--pv-mint)] transition cursor-pointer"
            aria-label="Next month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={goToday}
            className="px-4 h-9 rounded-full bg-[var(--pv-green)] text-white text-xs font-extrabold hover:opacity-90 transition cursor-pointer"
          >
            Today
          </button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px] items-start">
        {/* Month grid */}
        <div className="bg-[var(--pv-card)] border border-[var(--pv-border)] rounded-[24px] p-4 sm:p-5">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-center text-[11px] font-extrabold uppercase tracking-wide text-[var(--pv-muted)] py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map(({ date, inMonth }) => {
              const key = dayKeyOf(date);
              const items = byDay.get(key) ?? [];
              const hasCall = items.some((i) => i.category === 'call');
              const hasTask = items.some((i) => i.category === 'task');
              const isToday = key === todayKey;
              const isSelected = key === selectedDay;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => pickDay(date, inMonth)}
                  aria-label={`${date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}: ${items.length} item${items.length === 1 ? '' : 's'}`}
                  aria-pressed={isSelected}
                  className={`min-h-[64px] sm:min-h-[76px] rounded-[16px] border p-1.5 sm:p-2 flex flex-col items-start gap-1 text-left transition cursor-pointer ${
                    isSelected
                      ? 'bg-[var(--pv-green)] text-white border-[var(--pv-green)]'
                      : 'border-[var(--pv-border)] bg-[var(--pv-card-soft)] hover:border-[var(--pv-green)]'
                  }`}
                >
                  <span
                    className={`text-xs sm:text-sm font-extrabold leading-none ${
                      !inMonth
                        ? 'text-[var(--pv-muted)] opacity-60'
                        : isSelected
                          ? 'text-white'
                          : 'text-[var(--pv-ink)]'
                    } ${isToday && !isSelected ? 'w-6 h-6 rounded-full bg-[var(--pv-green)] text-white flex items-center justify-center' : ''}`}
                  >
                    {date.getDate()}
                  </span>
                  {items.length > 0 && (
                    <span className="flex items-center gap-1 mt-auto flex-wrap">
                      {hasCall && <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white' : CATEGORY_META.call.dot}`} />}
                      {hasTask && <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white opacity-80' : CATEGORY_META.task.dot}`} />}
                      {items.length > 2 && (
                        <span className={`text-[10px] font-bold ${isSelected ? 'text-white' : 'text-[var(--pv-muted)]'}`}>
                          +{items.length - 2}
                        </span>
                      )}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-[var(--pv-muted)]">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--pv-green)]" /> Call scheduled
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--pv-sky)]" /> Task due
            </span>
            <span className="ml-auto">
              {undatedCount > 0 && (
                <>
                  {undatedCount} task{undatedCount === 1 ? '' : 's'} without a set date aren&apos;t on the grid.{' '}
                  <button type="button" onClick={onOpenReminders} className="font-bold text-[var(--pv-green)] underline cursor-pointer">
                    Open Follow-ups &amp; Tasks
                  </button>
                </>
              )}
            </span>
          </div>
        </div>

        {/* Totals + day detail */}
        <div className="space-y-4">
          <div className="bg-[var(--pv-card)] border border-[var(--pv-border)] rounded-[24px] p-5">
            <h3 className="text-sm font-extrabold text-[var(--pv-ink)]">Totals</h3>
            <p className="text-[11px] text-[var(--pv-muted)] mt-0.5">Counts of dated items only — no dollar figures are computed for these dates.</p>
            <div className="grid grid-cols-3 gap-2 mt-4 text-center">
              <div className="rounded-[16px] bg-[var(--pv-card-soft)] border border-[var(--pv-border)] py-3">
                <div className="text-xl font-extrabold text-[var(--pv-ink)]">{monthTotals.calls}</div>
                <div className="text-[10px] font-bold text-[var(--pv-muted)] uppercase tracking-wide mt-0.5">Calls · month</div>
              </div>
              <div className="rounded-[16px] bg-[var(--pv-card-soft)] border border-[var(--pv-border)] py-3">
                <div className="text-xl font-extrabold text-[var(--pv-ink)]">{monthTotals.tasks}</div>
                <div className="text-[10px] font-bold text-[var(--pv-muted)] uppercase tracking-wide mt-0.5">Tasks · month</div>
              </div>
              <div className="rounded-[16px] bg-[var(--pv-green)] py-3">
                <div className="text-xl font-extrabold text-white">{monthTotals.total}</div>
                <div className="text-[10px] font-bold text-white/80 uppercase tracking-wide mt-0.5">Total · month</div>
              </div>
            </div>
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--pv-border)] text-xs">
              <span className="text-[var(--pv-muted)] font-semibold">{cursor.year} year totals</span>
              <span className="font-extrabold text-[var(--pv-ink)]">
                {yearTotals.calls} calls · {yearTotals.tasks} tasks · {yearTotals.total} total
              </span>
            </div>
          </div>

          <div className="bg-[var(--pv-card)] border border-[var(--pv-border)] rounded-[24px] p-5">
            <h3 className="text-sm font-extrabold text-[var(--pv-ink)]">
              {selectedDate.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </h3>
            {selectedItems.length === 0 ? (
              <p className="text-xs text-[var(--pv-muted)] mt-3 leading-relaxed">
                No tasks or calls on this date. Days with no items stay empty — nothing is guessed onto them.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {selectedItems.map(({ task, category }) => {
                  const meta = CATEGORY_META[category];
                  return (
                    <li key={task.id}>
                      <button
                        type="button"
                        onClick={() => (category === 'call' ? onOpenCallForTask(task) : onOpenReminders())}
                        className="w-full text-left rounded-[16px] border border-[var(--pv-border)] bg-[var(--pv-card-soft)] hover:border-[var(--pv-green)] transition p-3 cursor-pointer"
                      >
                        <span className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${meta.chip}`}>
                            {category === 'call' ? <PhoneCall className="w-3 h-3 inline mr-1" /> : <CheckSquare className="w-3 h-3 inline mr-1" />}
                            {meta.label}
                          </span>
                          {task.completed && (
                            <span className="text-[10px] font-bold text-[var(--pv-muted)]">Completed</span>
                          )}
                        </span>
                        <span className={`block text-[13px] font-bold text-[var(--pv-ink)] mt-1.5 leading-snug ${task.completed ? 'line-through opacity-60' : ''}`}>
                          {task.task}
                        </span>
                        <span className="block text-[11px] text-[var(--pv-muted)] mt-1">
                          {timeLabel(task, parseTaskDate(task) ?? new Date())}
                          {task.practiceName ? ` · ${task.practiceName}` : ''}
                          {task.doctorName ? ` · ${task.doctorName}` : ''}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarView;
