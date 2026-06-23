import { DAYS_PER_WEEK } from "@/lib/program-constants";

/** Monday of the week containing `date` (local time). */
export function mondayOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

/** ISO date string YYYY-MM-DD in local time. */
export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Program week 1 Monday anchor — defaults to this week's Monday. */
export function resolveProgramStartMonday(startDate?: string | null): Date {
  if (startDate) {
    const parsed = parseIsoDate(startDate);
    if (!Number.isNaN(parsed.getTime())) return mondayOfWeek(parsed);
  }
  return mondayOfWeek(new Date());
}

/** Calendar date for program week/day (1-indexed, Mon=1 … Sun=7). */
export function calendarDateForProgramDay(
  startMonday: Date,
  weekNumber: number,
  dayNumber: number,
): string {
  const date = new Date(startMonday);
  date.setDate(date.getDate() + (weekNumber - 1) * DAYS_PER_WEEK + (dayNumber - 1));
  return toIsoDate(date);
}

export function formatShortDate(iso: string): string {
  const d = parseIsoDate(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatMonthYear(iso: string): string {
  const d = parseIsoDate(iso);
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

/** All calendar days in a month (for bulk-assign checkboxes). */
export function daysInMonth(year: number, month: number): Array<{ iso: string; day: number; weekday: number }> {
  const last = new Date(year, month + 1, 0).getDate();
  const out: Array<{ iso: string; day: number; weekday: number }> = [];
  for (let day = 1; day <= last; day++) {
    const d = new Date(year, month, day);
    out.push({ iso: toIsoDate(d), day, weekday: d.getDay() });
  }
  return out;
}

/** Map a real calendar ISO date → program week/day (1-indexed) from anchor Monday. */
export function programDayIndexFromDate(
  startMonday: Date,
  iso: string,
): { weekNumber: number; dayNumber: number } | null {
  const target = parseIsoDate(iso);
  const start = new Date(startMonday.getFullYear(), startMonday.getMonth(), startMonday.getDate());
  const diffMs = target.getTime() - start.getTime();
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays < 0) return null;
  const weekNumber = Math.floor(diffDays / DAYS_PER_WEEK) + 1;
  const dayNumber = (diffDays % DAYS_PER_WEEK) + 1;
  return { weekNumber, dayNumber };
}

export const DEFAULT_DAY_OPTIONS = ["Gym", "Home"] as const;

export type DayOptionLike = { workoutId: string; label: string };

function isGymLabel(label: string): boolean {
  return /^gym$/i.test(label.trim());
}

function isHomeLabel(label: string): boolean {
  return /^home$/i.test(label.trim());
}

function pickPreferredOption(
  current: DayOptionLike | null,
  next: DayOptionLike,
): DayOptionLike {
  if (!current) return next;
  if (next.workoutId && !current.workoutId) return next;
  if (current.workoutId && !next.workoutId) return current;
  return next;
}

/** Collapse duplicate Gym/Home pills from legacy seed data — keep one of each + custom settings. */
export function normalizeDayOptions(options: DayOptionLike[]): DayOptionLike[] {
  if (options.length === 0) return options;

  let gym: DayOptionLike | null = null;
  let home: DayOptionLike | null = null;
  const customs: DayOptionLike[] = [];

  for (const opt of options) {
    if (isGymLabel(opt.label)) {
      gym = pickPreferredOption(gym, opt);
    } else if (isHomeLabel(opt.label)) {
      home = pickPreferredOption(home, opt);
    } else {
      customs.push(opt);
    }
  }

  const result: DayOptionLike[] = [];
  if (gym) result.push({ ...gym, label: "Gym" });
  if (home) result.push({ ...home, label: "Home" });
  result.push(...customs);
  return result;
}

export const DAY_SLOT_COUNT = 9;

export const WARMUP_EXERCISE_NAMES = [
  "Upper body warm up",
  "Shoulder mobility warm",
] as const;