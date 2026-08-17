export const ONBOARD_GENDERS = ["man", "woman"] as const;
export type OnboardGender = (typeof ONBOARD_GENDERS)[number];

export const WEIGHT_LOSS_TIMELINES = [
  "8 weeks",
  "12 weeks",
  "16 weeks",
  "6 months",
] as const;

export const PRIMARY_GOALS = [
  { id: "lose-fat", label: "Lose fat" },
  { id: "lose-fast", label: "Lose a lot of weight, fast" },
  { id: "tone", label: "Tone up" },
  { id: "gain-muscle", label: "Gain muscle" },
  { id: "get-stronger", label: "Get stronger" },
  { id: "consistency", label: "Build consistency" },
] as const;
export type PrimaryGoalId = (typeof PRIMARY_GOALS)[number]["id"];

export const WORKOUT_SCHEDULES = [
  { id: "starting", label: "Just starting" },
  { id: "1-2", label: "1–2 days a week" },
  { id: "3-4", label: "3–4 days a week" },
  { id: "5+", label: "5+ days a week" },
] as const;
export type WorkoutScheduleId = (typeof WORKOUT_SCHEDULES)[number]["id"];

export function normalizePrimaryGoal(raw: string | null | undefined): PrimaryGoalId | null {
  const v = (raw || "").trim();
  return PRIMARY_GOALS.some((g) => g.id === v) ? (v as PrimaryGoalId) : null;
}

export function primaryGoalLabel(raw: string | null | undefined): string | null {
  const id = normalizePrimaryGoal(raw);
  return PRIMARY_GOALS.find((g) => g.id === id)?.label ?? null;
}

export function isFatLossGoal(raw: string | null | undefined): boolean {
  const id = normalizePrimaryGoal(raw);
  return id === "lose-fat" || id === "lose-fast";
}

export function normalizeWorkoutSchedule(
  raw: string | null | undefined,
): WorkoutScheduleId | null {
  const v = (raw || "").trim();
  return WORKOUT_SCHEDULES.some((s) => s.id === v) ? (v as WorkoutScheduleId) : null;
}

export function workoutScheduleLabel(raw: string | null | undefined): string | null {
  const id = normalizeWorkoutSchedule(raw);
  return WORKOUT_SCHEDULES.find((s) => s.id === id)?.label ?? null;
}

export function normalizeOnboardGender(raw: string | null | undefined): OnboardGender | null {
  const v = (raw || "").trim().toLowerCase();
  if (v === "man" || v === "male" || v === "m") return "man";
  if (v === "woman" || v === "female" || v === "f") return "woman";
  return null;
}

export function onboardGenderLabel(gender: string | null | undefined): string | null {
  const n = normalizeOnboardGender(gender);
  if (n === "man") return "Man";
  if (n === "woman") return "Woman";
  return null;
}

export function isWomanOnboardPath(gender: string | null | undefined): boolean {
  return normalizeOnboardGender(gender) === "woman";
}
