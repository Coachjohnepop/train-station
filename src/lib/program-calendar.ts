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

export function formatLongDate(iso: string): string {
  const d = parseIsoDate(iso);
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
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

export type ProgramDayCoordinate = {
  weekNumber: number;
  dayNumber: number;
};

/** Next or previous program day within [1..durationWeeks] × [1..7]. Returns null at boundaries. */
export function adjacentProgramDay(
  weekNumber: number,
  dayNumber: number,
  delta: -1 | 1,
  durationWeeks: number,
): ProgramDayCoordinate | null {
  if (durationWeeks < 1) return null;
  let w = weekNumber;
  let d = dayNumber + delta;
  if (d < 1) {
    w -= 1;
    d = DAYS_PER_WEEK;
  } else if (d > DAYS_PER_WEEK) {
    w += 1;
    d = 1;
  }
  if (w < 1 || w > durationWeeks) return null;
  return { weekNumber: w, dayNumber: d };
}

/** Local calendar date YYYY-MM-DD (not UTC). */
export function localTodayIso(reference = new Date()): string {
  return toIsoDate(reference);
}

/** Today's week/day on the program calendar (local date), or null if before anchor. */
export function todayProgramDayIndex(startDate?: string | null, reference = new Date()): {
  weekNumber: number;
  dayNumber: number;
  iso: string;
} | null {
  const iso = localTodayIso(reference);
  const idx = programDayIndexFromDate(resolveProgramStartMonday(startDate), iso);
  if (!idx) return null;
  return { ...idx, iso };
}

type ProgramDayLike = {
  id: string;
  dayNumber: number;
  calendarDate?: string | null;
  workoutId?: string | null;
  options?: Array<{ workoutId: string; label?: string }>;
  smsOverrideActive?: boolean;
  smsOverrideLabel?: string | null;
};

type ProgramWeekLike = {
  weekNumber: number;
  days: ProgramDayLike[];
};

type ProgramCalendarLike = {
  startDate?: string | null;
  weeks: ProgramWeekLike[];
};

/** Week numbers for a rolling member window centered on the calendar week (default: past + now + ahead). */
export function rollingProgramWeekNumbers(
  centerWeek: number,
  availableWeeks: number[],
  windowSize = 3,
): number[] {
  if (availableWeeks.length === 0) return [];
  const sorted = [...new Set(availableWeeks)].sort((a, b) => a - b);
  const minWeek = sorted[0];
  const maxWeek = sorted[sorted.length - 1];
  const half = Math.floor(windowSize / 2);
  let start = centerWeek - half;
  let end = centerWeek + (windowSize - half - 1);
  if (start < minWeek) {
    end += minWeek - start;
    start = minWeek;
  }
  if (end > maxWeek) {
    start -= end - maxWeek;
    end = maxWeek;
  }
  start = Math.max(minWeek, start);
  end = Math.min(maxWeek, end);
  const picked: number[] = [];
  for (let w = start; w <= end && picked.length < windowSize; w++) {
    if (sorted.includes(w)) picked.push(w);
  }
  while (picked.length < windowSize && picked[0] > minWeek) {
    const prev = picked[0] - 1;
    if (sorted.includes(prev)) picked.unshift(prev);
    else break;
  }
  while (picked.length < windowSize && picked[picked.length - 1] < maxWeek) {
    const next = picked[picked.length - 1] + 1;
    if (sorted.includes(next)) picked.push(next);
    else break;
  }
  return picked;
}

export function rollingWeekSectionLabel(weekNumber: number, centerWeek: number): string {
  if (weekNumber < centerWeek) return "What you did";
  if (weekNumber > centerWeek) return "What's ahead";
  return "Where you are";
}

export type RollingCalendarDayPhase = "past" | "today" | "future";

export type RollingCalendarDay<T = ProgramDayLike> = {
  iso: string;
  weekNumber: number;
  dayNumber: number;
  day: T;
  phase: RollingCalendarDayPhase;
};

/** Calendar days in a rolling member window (default 10: 3 back, today, 6 ahead). */
export function rollingProgramCalendarDays(
  program: ProgramCalendarLike,
  centerIso: string,
  windowDays = 10,
  daysBefore = 3,
): RollingCalendarDay[] {
  const center = parseIsoDate(centerIso);
  const daysAfter = Math.max(0, windowDays - 1 - daysBefore);
  const out: RollingCalendarDay[] = [];

  for (let offset = -daysBefore; offset <= daysAfter; offset++) {
    const d = new Date(center.getFullYear(), center.getMonth(), center.getDate());
    d.setDate(d.getDate() + offset);
    const iso = toIsoDate(d);
    const match = findProgramDayForCalendarDate(program, iso);
    if (!match) continue;
    const phase: RollingCalendarDayPhase =
      offset < 0 ? "past" : offset === 0 ? "today" : "future";
    out.push({
      iso,
      weekNumber: match.weekNumber,
      dayNumber: match.dayNumber,
      day: match.day,
      phase,
    });
  }

  return out;
}

export function rollingDaySectionLabel(phase: RollingCalendarDayPhase): string {
  if (phase === "past") return "What you did";
  if (phase === "future") return "What's ahead";
  return "Where you are";
}

/** Find the program day that matches a calendar ISO date (stored calendarDate first, then anchor math). */
export function findProgramDayForCalendarDate(
  program: ProgramCalendarLike,
  isoDate: string,
): { weekNumber: number; dayNumber: number; day: ProgramDayLike } | null {
  for (const week of program.weeks) {
    for (const day of week.days) {
      if (day.calendarDate === isoDate) {
        return { weekNumber: week.weekNumber, dayNumber: day.dayNumber, day };
      }
    }
  }
  const idx = programDayIndexFromDate(resolveProgramStartMonday(program.startDate), isoDate);
  if (!idx) return null;
  const week = program.weeks.find((w) => w.weekNumber === idx.weekNumber);
  const day = week?.days.find((d) => d.dayNumber === idx.dayNumber);
  if (!week || !day) return null;
  return { weekNumber: week.weekNumber, dayNumber: day.dayNumber, day };
}

export const DEFAULT_DAY_OPTIONS = ["Gym", "Home"] as const;

export const DAY_OFF_LABEL = "Day Off";
export const FASTED_CARDIO_LABEL = "Fasted cardio";
export const DEFAULT_FASTED_CARDIO_MINUTES = 30;

export type DayOptionLike = { workoutId: string; label: string };

export function isGymLabel(label: string): boolean {
  return /^gym$/i.test(label.trim());
}

export function isHomeLabel(label: string): boolean {
  return /^home$/i.test(label.trim());
}

export function trainingLocationFromLabel(
  label: string,
): "gym" | "home" | null {
  if (isGymLabel(label)) return "gym";
  if (isHomeLabel(label)) return "home";
  return null;
}

export function formatTrainingLocationLabel(
  location: string | null | undefined,
): string | null {
  if (!location) return null;
  const normalized = location.trim().toLowerCase();
  if (normalized === "gym") return "Gym";
  if (normalized === "home") return "Home";
  return null;
}

export function isDayOffLabel(label: string): boolean {
  return /^day\s*off$/i.test(label.trim());
}

export function isFastedCardioLabel(label: string): boolean {
  return /^fasted\s*cardio$/i.test(label.trim());
}

export function isWorkoutDayLabel(label: string): boolean {
  return isGymLabel(label) || isHomeLabel(label) || /^setting\s+\d+$/i.test(label.trim());
}

export function fastedCardioReps(minutes: number): string {
  return `${minutes} min`;
}

export function parseFastedCardioMinutes(reps: string | null | undefined): number {
  if (!reps) return DEFAULT_FASTED_CARDIO_MINUTES;
  const m = reps.match(/(\d+)\s*min/i);
  return m ? Math.max(5, parseInt(m[1], 10)) : DEFAULT_FASTED_CARDIO_MINUTES;
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
/** Day IDs (excluding `exceptDayId`) that reference this workout via legacy field or options. */
export function programDaysUsingWorkout(
  program: {
    weeks: Array<{
      days: Array<{
        id: string;
        workoutId?: string | null;
        options?: DayOptionLike[];
      }>;
    }>;
  },
  workoutId: string,
  exceptDayId?: string,
): string[] {
  if (!workoutId?.trim()) return [];
  const hits: string[] = [];
  for (const week of program.weeks) {
    for (const day of week.days) {
      if (exceptDayId && day.id === exceptDayId) continue;
      if (day.workoutId === workoutId) {
        hits.push(day.id);
        continue;
      }
      if ((day.options || []).some((o) => o.workoutId === workoutId)) {
        hits.push(day.id);
      }
    }
  }
  return hits;
}

export function isWorkoutSharedAcrossProgramDays(
  program: Parameters<typeof programDaysUsingWorkout>[0],
  workoutId: string,
  exceptDayId: string,
): boolean {
  return programDaysUsingWorkout(program, workoutId, exceptDayId).length > 0;
}

export function normalizeDayOptions(options: DayOptionLike[]): DayOptionLike[] {
  if (options.length === 0) return options;

  let gym: DayOptionLike | null = null;
  let home: DayOptionLike | null = null;
  let dayOff: DayOptionLike | null = null;
  let fastedCardio: DayOptionLike | null = null;
  const customs: DayOptionLike[] = [];

  for (const opt of options) {
    if (isGymLabel(opt.label)) {
      gym = pickPreferredOption(gym, opt);
    } else if (isHomeLabel(opt.label)) {
      home = pickPreferredOption(home, opt);
    } else if (isDayOffLabel(opt.label)) {
      dayOff = pickPreferredOption(dayOff, opt);
    } else if (isFastedCardioLabel(opt.label)) {
      fastedCardio = pickPreferredOption(fastedCardio, opt);
    } else {
      customs.push(opt);
    }
  }

  if (dayOff) return [{ ...dayOff, label: DAY_OFF_LABEL }];
  if (fastedCardio && !gym && !home) {
    return [{ ...fastedCardio, label: FASTED_CARDIO_LABEL }];
  }

  const result: DayOptionLike[] = [];
  if (gym) result.push({ ...gym, label: "Gym" });
  if (home) result.push({ ...home, label: "Home" });
  if (fastedCardio) result.push({ ...fastedCardio, label: FASTED_CARDIO_LABEL });
  result.push(...customs);
  return result;
}

export const DAY_SLOT_COUNT = 9;

/** Two ~30-minute blocks when building a session (5 slots + 4 slots). */
export const DAY_TIME_BLOCK_MINUTES = 30;
export const DAY_TIME_BLOCK_COUNT = 2;

export const DEFAULT_COLUMN_SLOT_COUNTS: readonly number[] = [5, 4];

export function totalSlotsFromColumnCounts(counts: readonly number[]): number {
  return counts.reduce((sum, n) => sum + n, 0);
}

export function columnStartIndex(column: number, counts: readonly number[]): number {
  let start = 0;
  for (let c = 0; c < column; c++) start += counts[c] ?? 0;
  return start;
}

export function slotIndicesForTimeColumn(
  column: number,
  counts: readonly number[] = DEFAULT_COLUMN_SLOT_COUNTS,
): number[] {
  const start = columnStartIndex(column, counts);
  const len = counts[column] ?? 0;
  return Array.from({ length: len }, (_, i) => start + i);
}

/** Grow column counts so every exercise fits, keeping the 0–30 / 30–60 split. */
export function columnSlotCountsForExerciseCount(exerciseCount: number): number[] {
  const counts = [...DEFAULT_COLUMN_SLOT_COUNTS];
  let total = totalSlotsFromColumnCounts(counts);
  while (total < exerciseCount) {
    const growCol = counts[0] <= counts[1] ? 0 : 1;
    counts[growCol]++;
    total++;
  }
  return counts;
}

export function timeBlockLabel(column: number): string {
  const start = column * DAY_TIME_BLOCK_MINUTES;
  return `${start}–${start + DAY_TIME_BLOCK_MINUTES} min`;
}

export const WARMUP_EXERCISE_NAMES = [
  "Warm up well 5 min bike",
  "Upper body warm up",
  "Shoulder mobility warm",
  "Up with bands",
] as const;