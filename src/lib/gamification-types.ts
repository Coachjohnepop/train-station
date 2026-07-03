export const DEFAULT_GAMIFICATION_POINTS = {
  warmup_before_live: 50,
  intake_scheduled: 100,
  workout_logged: 25,
  intake_complete: 75,
  onboarding_complete: 25,
} as const;

/** @deprecated Use configured points from coach settings; defaults remain for fallbacks. */
export const GAMIFICATION_POINTS = DEFAULT_GAMIFICATION_POINTS;

export type GamificationEventType = keyof typeof DEFAULT_GAMIFICATION_POINTS;

export type GamificationPointsMap = Record<GamificationEventType, number>;

export const GAMIFICATION_EVENT_TYPES = Object.keys(
  DEFAULT_GAMIFICATION_POINTS,
) as GamificationEventType[];

export function normalizeGamificationPoints(raw: unknown): GamificationPointsMap {
  const out: GamificationPointsMap = { ...DEFAULT_GAMIFICATION_POINTS };
  if (!raw || typeof raw !== "object") return out;
  for (const key of GAMIFICATION_EVENT_TYPES) {
    const value = (raw as Record<string, unknown>)[key];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      out[key] = Math.min(10_000, Math.round(value));
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