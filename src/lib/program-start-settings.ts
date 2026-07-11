import { PROGRAM_CYCLE_DAYS } from "@/lib/program-constants";

export const DEFAULT_PROGRAM_START_MAX_OFFSET_DAYS = 6;
export const DEFAULT_PROGRAM_START_RECOMMEND_WEEKDAY = 1;
export const DEFAULT_PROGRAM_BLOCK_DAYS = PROGRAM_CYCLE_DAYS;

export const PROGRAM_START_WEEKDAYS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
] as const;

export type ProgramStartSettings = {
  maxOffsetDays: number;
  /** null = default to today (no weekday nudge). */
  recommendWeekday: number | null;
  blockDays: number;
};

export function normalizeProgramStartMaxOffsetDays(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_PROGRAM_START_MAX_OFFSET_DAYS;
  return Math.max(0, Math.min(14, Math.floor(n)));
}

export function normalizeProgramStartRecommendWeekday(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_PROGRAM_START_RECOMMEND_WEEKDAY;
  const v = Math.floor(n);
  if (v < 0 || v > 6) return DEFAULT_PROGRAM_START_RECOMMEND_WEEKDAY;
  return v;
}

export function normalizeProgramBlockDays(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_PROGRAM_BLOCK_DAYS;
  return Math.max(7, Math.min(56, Math.floor(n)));
}

export function normalizeProgramStartSettings(
  raw?: Partial<ProgramStartSettings> | null,
): ProgramStartSettings {
  return {
    maxOffsetDays: normalizeProgramStartMaxOffsetDays(raw?.maxOffsetDays),
    recommendWeekday: normalizeProgramStartRecommendWeekday(raw?.recommendWeekday),
    blockDays: normalizeProgramBlockDays(raw?.blockDays),
  };
}

export function programStartSettingsFromCoach(
  coach: {
    programStartMaxOffsetDays?: number;
    programStartRecommendWeekday?: number | null;
    programBlockDays?: number;
  } | null | undefined,
): ProgramStartSettings {
  if (!coach) return normalizeProgramStartSettings(null);
  return normalizeProgramStartSettings({
    maxOffsetDays: coach.programStartMaxOffsetDays,
    recommendWeekday: coach.programStartRecommendWeekday,
    blockDays: coach.programBlockDays,
  });
}

export function weekdayLabel(value: number): string {
  return PROGRAM_START_WEEKDAYS.find((d) => d.value === value)?.label ?? "Weekday";
}