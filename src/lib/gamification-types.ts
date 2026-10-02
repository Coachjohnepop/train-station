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

export const DEFAULT_GAMIFICATION_POINTS = {
  warmup_before_live: 10,
  intake_scheduled: 10,
  workout_logged: 10,
  set_logged: 10,
  intake_complete: 10,
  onboarding_complete: 10,
} as const;

type GamificationPointsMapLike = {
  warmup_before_live: number;
  intake_scheduled: number;
  workout_logged: number;
  set_logged: number;
  intake_complete: number;
  onboarding_complete: number;
};

/** Pre–free-step defaults (used once to migrate stored coach settings). */
const LEGACY_GAMIFICATION_POINTS: GamificationPointsMapLike = {
  warmup_before_live: 50,
  intake_scheduled: 100,
  workout_logged: 25,
  set_logged: 10,
  intake_complete: 75,
  onboarding_complete: 25,
};

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
  return roundPointsUpToTen(free * PAID_POINTS_MULTIPLIER);
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

export function normalizeGamificationPoints(raw: unknown): GamificationPointsMap {
  const out: GamificationPointsMap = { ...DEFAULT_GAMIFICATION_POINTS };
  if (!raw || typeof raw !== "object") return out;
  for (const key of GAMIFICATION_EVENT_TYPES) {
    const value = (raw as Record<string, unknown>)[key];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      // One-shot migrate: old coach-wide table → free-step defaults
      if (value === LEGACY_GAMIFICATION_POINTS[key]) {
        out[key] = DEFAULT_GAMIFICATION_POINTS[key];
      } else {
        out[key] = snapFreePoints(Math.min(10_000, value));
      }
    }
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
  warmup_before_live: "Warm-ups before live",
  intake_scheduled: "Booked intro call",
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