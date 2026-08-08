/**
 * Free Explorer point table (coach settings edit these).
 * Free awards snap to FREE_POINT_STEP (10). Coach Class+ multiplies by PAID_POINTS_MULTIPLIER (~8×).
 * Totals always roll over — only the per-event award size differs by ticket.
 */
export const FREE_POINT_STEP = 10;
/** Coach Class, Business, and 1st Class earn this many times Free Explorer for the same action. */
export const PAID_POINTS_MULTIPLIER = 8;

export const DEFAULT_GAMIFICATION_POINTS = {
  warmup_before_live: 10,
  intake_scheduled: 10,
  workout_logged: 10,
  intake_complete: 10,
  onboarding_complete: 10,
} as const;

type GamificationPointsMapLike = {
  warmup_before_live: number;
  intake_scheduled: number;
  workout_logged: number;
  intake_complete: number;
  onboarding_complete: number;
};

/** Pre–free-step defaults (used once to migrate stored coach settings). */
const LEGACY_GAMIFICATION_POINTS: GamificationPointsMapLike = {
  warmup_before_live: 50,
  intake_scheduled: 100,
  workout_logged: 25,
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

/**
 * Points actually awarded for a membership plan.
 * Free / explorer → free-scale (normally 10s; late/partial may be smaller).
 * Coach+ → free-scale × 8. Totals always accumulate (roll over).
 */
export function awardPointsForPlan(
  freeScalePoints: number,
  plan: string | null | undefined,
): number {
  const free = Math.max(0, Math.round(freeScalePoints));
  if (free <= 0) return 0;
  if (!isPaidScoringPlan(plan)) return free;
  return free * PAID_POINTS_MULTIPLIER;
}

export function isPaidScoringPlan(plan: string | null | undefined): boolean {
  const p = (plan || "explorer").toLowerCase();
  return (
    p === "member" ||
    p === "coach_class" ||
    p === "business" ||
    p === "business_class" ||
    p === "pro" ||
    p === "first_class"
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
  milestones: ScoreMilestone[];
  workoutLogs: {
    count: number;
    earnedPoints: number;
    nextPoints: number;
  };
};