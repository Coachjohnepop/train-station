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
  return dayVisibilityTierByOffset(offset);
}

/** Visibility from enrollment-day offset (0 = member program today). */
export function dayVisibilityTierByOffset(offset: number): DayVisibilityTier {
  if (offset <= 0) return offset === 0 ? "full" : "names";
  if (offset <= 2) return "names";
  return "label";
}

/** Short member-facing title (e.g. "Leg day", "Fasted cardio") from a workout name. */
export function themeLabelForDay(workoutName: string | null, dayLabel: string): string {
  const name = (workoutName || "").trim();
  if (!name) return dayLabel || "Training day";

  const lower = name.toLowerCase();

  if (/fasted\s*cardio/i.test(lower)) return "Fasted cardio";
  if (/active\s*recovery|rest\s*day/i.test(lower)) return "Active recovery";
  if (/lower\s*body|\bleg\b/i.test(lower)) return "Leg day";
  if (/upper\s*body/i.test(lower)) return "Arm day";
  if (/\bback\b/i.test(lower) && /\bbicep/i.test(lower)) return "Back & biceps";
  if (/\bshoulder\b/i.test(lower) && /\btricep/i.test(lower)) return "Shoulders & triceps";
  if (/\bchest\b/i.test(lower)) return "Chest day";
  if (/\bshoulder\b/i.test(lower)) return "Shoulder day";
  if (/\bcardio\b/i.test(lower)) return "Cardio";
  if (/stretch|mobility/i.test(lower)) return "Mobility";
  if (/full\s*body/i.test(lower)) return "Full body";

  const stripped = name
    .replace(/^day\s*\d+\s*/i, "")
    .replace(/\s*workout\s*/i, " ")
    .replace(/\s*\((gym|home)\)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();

  if (stripped.length > 0 && stripped.length <= 36) {
    return stripped.charAt(0).toUpperCase() + stripped.slice(1);
  }

  return dayLabel || "Training day";
}

/** Headline for schedule cards — short theme on future days, full name otherwise. */
export function scheduleDayHeadline(
  workoutName: string | null,
  dayLabel: string,
  opts?: { phase?: "past" | "today" | "future"; visibilityTier?: DayVisibilityTier },
): string {
  if (opts?.phase === "future" && opts.visibilityTier === "label") {
    return themeLabelForDay(workoutName, dayLabel);
  }
  return workoutName || dayLabel || "No session scheduled";
}

export function addDaysIso(iso: string, days: number): string {
  const d = parseIsoDate(iso);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}