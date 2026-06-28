import { parseIsoDate, toIsoDate } from "@/lib/program-calendar";

export type DayVisibilityTier = "full" | "names" | "label";

/** Days from today: negative = past, 0 = today, positive = future. */
export function daysFromToday(iso: string, todayIso: string): number {
  const target = parseIsoDate(iso);
  const today = parseIsoDate(todayIso);
  return Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * Member schedule visibility:
 * - Today: full sets (when workout unlocked)
 * - +1 / +2 days: exercise names only
 * - +3 and beyond: theme label only (e.g. "Leg day")
 */
export function dayVisibilityTier(iso: string, todayIso: string): DayVisibilityTier {
  const offset = daysFromToday(iso, todayIso);
  if (offset <= 0) return offset === 0 ? "full" : "names";
  if (offset <= 2) return "names";
  return "label";
}

/** Short theme for far-future days — prefers workout name, else day label. */
export function themeLabelForDay(workoutName: string | null, dayLabel: string): string {
  const name = (workoutName || "").trim();
  if (name) {
    const lower = name.toLowerCase();
    if (
      /leg|shoulder|arm|back|chest|upper|lower|core|cardio|push|pull|full body|mobility|stretch/i.test(
        lower,
      )
    ) {
      return name;
    }
  }
  return dayLabel || "Training day";
}

export function addDaysIso(iso: string, days: number): string {
  const d = parseIsoDate(iso);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}