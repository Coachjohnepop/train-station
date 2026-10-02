/**
 * Free Explorer point table (coach settings edit these).
 * Free awards snap to FREE_POINT_STEP (10). Coach Class, Business, and 1st Class
 * share one paid table — 3 workouts/week × 4 weeks × (set + log) = 2,000.
 */
export const FREE_POINT_STEP = 10;
/** 3 workouts a week on a 28-day cycle. */
export const CYCLE_WORKOUT_COUNT = 12;
/** Habit actions that make one workout toward the cycle: first set + log. */
export const CYCLE_ACTIONS_PER_WORKOUT = 2;
/** Paid 28-day cycle goal (Coach = Business = 1st Class). */
export const PAID_CYCLE_GOAL_POINTS = 2000;
/** Free Explorer 28-day cycle goal: 12 × (set 10 + log 10). */
export const FREE_CYCLE_GOAL_POINTS =
  CYCLE_WORKOUT_COUNT * CYCLE_ACTIONS_PER_WORKOUT * FREE_POINT_STEP;
/**
 * Paid award / free-scale. 2000 / (12 × 2 × 10) = 8⅓, then each award rounds
 * up to the nearest 10: a 10-pt action is 90, and 12 complete workouts are
 * 2,160 — over the 2,000 cycle goal.
 */
export const PAID_POINTS_MULTIPLIER =
  PAID_CYCLE_GOAL_POINTS /
  (CYCLE_WORKOUT_COUNT * CYCLE_ACTIONS_PER_WORKOUT * FREE_POINT_STEP);

/**
 * Free-scale awards. set + log stay at 10 so 12 workouts clear the cycle.
 * Extras are 2× or 3× that unit so stretching, first workout, booking, and
 * measurements push a member over the goal.
 */
export const DEFAULT_GAMIFICATION_POINTS = {
  warmup_before_live: 20,
  first_workout: 30,
  intake_scheduled: 30,
  measurements_logged: 20,
  food_track_day: 20,
  workout_logged: 10,
  set_logged: 10,
  intake_complete: 20,
  onboarding_complete: 20,
} as const;

type GamificationPointsMapLike = {
  warmup_before_live: number;
  first_workout: number;
  intake_scheduled: number;
  measurements_logged: number;
  food_track_day: number;
  workout_logged: number;
  set_logged: number;
  intake_complete: number;
  onboarding_complete: number;
};

/** Habit actions that make the 2,000-point cycle. Everything else is extra. */
export const CYCLE_POINT_TYPES = ["set_logged", "workout_logged"] as const;

/** Pre–free-step defaults (used once to migrate stored coach settings). */
const LEGACY_GAMIFICATION_POINTS: Partial<GamificationPointsMapLike> = {
  warmup_before_live: 50,
  intake_scheduled: 100,
  workout_logged: 25,
  set_logged: 10,
  intake_complete: 75,
  onboarding_complete: 25,
};

/** All-10 table from the 2,000-cycle flatten — extras were accidentally equal to a set. */
const FLATTENED_TEN_KEYS = [
  "warmup_before_live",
  "intake_scheduled",
  "workout_logged",
  "set_logged",
  "intake_complete",
  "onboarding_complete",
] as const;

/** @deprecated Use configured points from coach settings; defaults remain for fallbacks. */
export const GAMIFICATION_POINTS = DEFAULT_GAMIFICATION_POINTS;

export type GamificationEventType = keyof typeof DEFAULT_GAMIFICATION_POINTS;

export type GamificationPointsMap = Record<GamificationEventType, number>;

export const GAMIFICATION_EVENT_TYPES = Object.keys(
  DEFAULT_GAMIFICATION_POINTS,
) as GamificationEventType[];

/** Snap a free-scale config value to steps of 10 (0 stays 0; positive min 10). */
export function snapFreePoints(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.max(FREE_POINT_STEP, Math.round(raw / FREE_POINT_STEP) * FREE_POINT_STEP);
}

/** Round a positive award up to the next 10 (80 stays 80; 83 → 90). */
export function roundPointsUpToTen(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.ceil(raw / FREE_POINT_STEP) * FREE_POINT_STEP;
}

/** Paid points for a Free Explorer-scale amount. Same for Coach, Business, and 1st Class. */
export function paidAwardFromFreeScale(freeScalePoints: number): number {
  const free = Math.max(0, Math.round(freeScalePoints));
  if (free <= 0) return 0;
  return roundPointsUpToTen(Math.round(free * PAID_POINTS_MULTIPLIER));
}

/**
 * Points actually awarded for a membership plan.
 * Free / explorer → free-scale (normally 10s; late/partial may be smaller).
 * Coach Class, Business Class, and 1st Class share the paid table (round up to 10s).
 */
export function awardPointsForPlan(
  freeScalePoints: number,
  plan: string | null | undefined,
): number {
  const free = Math.max(0, Math.round(freeScalePoints));
  if (free <= 0) return 0;
  if (!isPaidScoringPlan(plan)) return free;
  return paidAwardFromFreeScale(free);
}

export function cycleGoalForPlan(plan: string | null | undefined): number {
  return isPaidScoringPlan(plan) ? PAID_CYCLE_GOAL_POINTS : FREE_CYCLE_GOAL_POINTS;
}

export function isPaidScoringPlan(plan: string | null | undefined): boolean {
  const p = (plan || "explorer").toLowerCase().replace(/[\s-]+/g, "_");
  return (
    p === "member" ||
    p === "coach" ||
    p === "coach_class" ||
    p === "business" ||
    p === "business_class" ||
    p === "pro" ||
    p === "first_class" ||
    p === "1st_class" ||
    p === "firstclass"
  );
}

function storedLooksLikeFlattenedTen(raw: Record<string, unknown>): boolean {
  let saw = 0;
  for (const key of FLATTENED_TEN_KEYS) {
    const value = raw[key];
    if (typeof value !== "number") continue;
    saw += 1;
    if (value !== FREE_POINT_STEP) return false;
  }
  return saw >= 4;
}

export function normalizeGamificationPoints(raw: unknown): GamificationPointsMap {
  const out: GamificationPointsMap = { ...DEFAULT_GAMIFICATION_POINTS };
  if (!raw || typeof raw !== "object") return out;
  const rec = raw as Record<string, unknown>;
  const flattened = storedLooksLikeFlattenedTen(rec);
  for (const key of GAMIFICATION_EVENT_TYPES) {
    const value = rec[key];
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) continue;
    if (LEGACY_GAMIFICATION_POINTS[key] != null && value === LEGACY_GAMIFICATION_POINTS[key]) {
      out[key] = DEFAULT_GAMIFICATION_POINTS[key];
      continue;
    }
    if (flattened && key !== "set_logged" && key !== "workout_logged") {
      continue;
    }
    out[key] = snapFreePoints(Math.min(10_000, value));
  }
  return out;
}

export type GamificationEvent = {
  /** Dedupe key — same id cannot award twice */
  id: string;
  type: GamificationEventType;
  points: number;
  label: string;
  at: string;
  programSlug?: string | null;
};

export type UserGamification = {
  userId: string;
  totalPoints: number;
  events: GamificationEvent[];
  updatedAt: string;
};

export type LeaderboardScope = "program" | "site";

export type LeaderboardRow = {
  rank: number;
  userId: string;
  displayName: string;
  points: number;
  bestMove: string | null;
  isSelf: boolean;
};

export type LeaderboardPayload = {
  scope: LeaderboardScope;
  programSlug: string | null;
  programName: string | null;
  viewer: LeaderboardRow;
  rows: LeaderboardRow[];
  updatedAt: string;
};

export const GAMIFICATION_EVENT_LABELS: Record<GamificationEventType, string> = {
  warmup_before_live: "Warm-up before live",
  first_workout: "First workout",
  intake_scheduled: "Booked intro call",
  measurements_logged: "Logged measurements",
  food_track_day: "Food track day",
  workout_logged: "Workout logged",
  set_logged: "Logged a set",
  intake_complete: "Intake complete",
  onboarding_complete: "Finished setup",
};

export type ScoreMilestoneStatus = "complete" | "incomplete";

export type ScoreMilestone = {
  id: string;
  type: GamificationEventType;
  label: string;
  points: number;
  status: ScoreMilestoneStatus;
  earnedPoints: number;
  completedAt: string | null;
  repeatable?: boolean;
  earnHint?: string;
  href?: string;
};

export type MemberScoreProgress = {
  earnedPoints: number;
  availablePoints: number;
  maxRampPoints: number;
  /** 28-day cycle target (2,000 paid / 240 Free). */
  cycleGoal: number;
  seasonDays: number;
  seasonEndsAt: string | null;
  milestones: ScoreMilestone[];
  workoutLogs: {
    count: number;
    earnedPoints: number;
    nextPoints: number;
  };
};