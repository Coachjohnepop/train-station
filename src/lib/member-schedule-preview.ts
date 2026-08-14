/**
 * TEMPORARY per-member schedule preview.
 *
 * Ali (2026-08-14): 14 upcoming days so we can confirm Jeremy's Adult
 * calendar actually shows. SCALE BACK after that review — do not leave
 * this as the default member window.
 */
export const TEMP_SCHEDULE_PREVIEW_UNTIL = "2026-09-01";

export type SchedulePreviewOverride = {
  email: string;
  upcomingDays: number;
  daysBefore: number;
  /** names = exercise list; full = same as today (still no logging on future days). */
  futureVisibility: "names" | "full";
  visibleChips: number;
  note: string;
};

const OVERRIDES: SchedulePreviewOverride[] = [
  {
    email: "fletcherboys@att.net",
    upcomingDays: 14,
    daysBefore: 1,
    futureVisibility: "names",
    visibleChips: 7,
    note: "TEMP Ali content review — scale back after Jeremy calendar check",
  },
];

export function schedulePreviewForEmail(email?: string | null): SchedulePreviewOverride | null {
  if (!email) return null;
  const key = email.trim().toLowerCase();
  return OVERRIDES.find((row) => row.email === key) ?? null;
}

export function previewRollingDays(preview: SchedulePreviewOverride): number {
  return preview.daysBefore + 1 + preview.upcomingDays;
}
