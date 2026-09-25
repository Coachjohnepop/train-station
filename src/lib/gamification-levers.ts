/**
 * Gamification economy levers — defaults + normalize for Admin console / config row.
 */

import { normalizeSignupPlan } from "@/lib/signup-plans";

export type GamificationDivision = "explorer" | "member" | "business" | "pro";

export type GamificationLevers = {
  freeContentPercent: number;
  coachContentPercent: number;
  topPercentile: number;
  freeWeekDays: number;
  claimWindowHours: number;
  seasonDays: number;
  crossDivisionPeek: boolean;
  prizeBandEnabled: boolean;
  minActiveDaysForPercentile: number;
  minSeasonPointsForPercentile: number;
  minDivisionSizeForTopCut: number;
  dailyPointCap: number;
  cooldownDaysPerEdge: number;
  anonymizeRivals: boolean;
  featureEnabled: boolean;
  /**
   * When true, Free Explorer must save a card (Stripe Setup — $0) before onboard/Today.
   * Default off. ACH not used. Does not charge until they upgrade.
   */
  freeRequiresPaymentMethod: boolean;
  /** Points before this instant do not count. Null means no reset. */
  scoresResetAt: string | null;
};

export const DEFAULT_GAMIFICATION_LEVERS: GamificationLevers = {
  freeContentPercent: 10,
  coachContentPercent: 90,
  topPercentile: 25,
  freeWeekDays: 7,
  claimWindowHours: 72,
  seasonDays: 28,
  crossDivisionPeek: true,
  prizeBandEnabled: true,
  /** Early launch: 2 days is enough to prove activity without killing free-week loop. */
  minActiveDaysForPercentile: 2,
  minSeasonPointsForPercentile: 50,
  minDivisionSizeForTopCut: 8,
  dailyPointCap: 150,
  cooldownDaysPerEdge: 90,
  anonymizeRivals: false,
  featureEnabled: true,
  freeRequiresPaymentMethod: false,
  scoresResetAt: null,
};

function clampInt(raw: unknown, min: number, max: number, fallback: number): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function normalizeGamificationLevers(raw: unknown): GamificationLevers {
  const d = DEFAULT_GAMIFICATION_LEVERS;
  if (!raw || typeof raw !== "object") return { ...d };
  const o = raw as Record<string, unknown>;
  return {
    freeContentPercent: clampInt(o.freeContentPercent, 0, 100, d.freeContentPercent),
    coachContentPercent: clampInt(o.coachContentPercent, 0, 100, d.coachContentPercent),
    topPercentile: clampInt(o.topPercentile, 1, 100, d.topPercentile),
    freeWeekDays: clampInt(o.freeWeekDays, 1, 30, d.freeWeekDays),
    claimWindowHours: clampInt(o.claimWindowHours, 1, 720, d.claimWindowHours),
    seasonDays: clampInt(o.seasonDays, 7, 90, d.seasonDays),
    crossDivisionPeek: o.crossDivisionPeek === false ? false : true,
    prizeBandEnabled: o.prizeBandEnabled === false ? false : true,
    minActiveDaysForPercentile: clampInt(
      o.minActiveDaysForPercentile,
      0,
      28,
      d.minActiveDaysForPercentile,
    ),
    minSeasonPointsForPercentile: clampInt(
      o.minSeasonPointsForPercentile,
      0,
      100_000,
      d.minSeasonPointsForPercentile,
    ),
    minDivisionSizeForTopCut: clampInt(o.minDivisionSizeForTopCut, 1, 100, d.minDivisionSizeForTopCut),
    dailyPointCap: clampInt(o.dailyPointCap, 0, 10_000, d.dailyPointCap),
    cooldownDaysPerEdge: clampInt(o.cooldownDaysPerEdge, 0, 365, d.cooldownDaysPerEdge),
    anonymizeRivals: o.anonymizeRivals === true,
    featureEnabled: o.featureEnabled === false ? false : true,
    freeRequiresPaymentMethod: o.freeRequiresPaymentMethod === true,
    scoresResetAt: scoreResetInstant(o.scoresResetAt),
  };
}

function scoreResetInstant(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const t = Date.parse(raw);
  if (!Number.isFinite(t)) return null;
  return new Date(t).toISOString();
}

/** Ledger rows strictly before the reset do not count toward anyone's score. */
export function countsTowardScore(at: string | Date, resetAt: string | null | undefined): boolean {
  if (!resetAt) return true;
  const eventAt = new Date(at).getTime();
  const reset = Date.parse(resetAt);
  if (!Number.isFinite(eventAt) || !Number.isFinite(reset)) return true;
  return eventAt >= reset;
}

/** Map membership plan → scoreboard division. */
export function divisionForPlan(plan: string | null | undefined): GamificationDivision {
  const p = normalizeSignupPlan(plan);
  if (p === "member") return "member";
  if (p === "business") return "business";
  if (p === "pro") return "pro";
  return "explorer";
}

export function divisionLabel(div: GamificationDivision): string {
  switch (div) {
    case "member":
      return "Coach Class";
    case "business":
      return "Business Class";
    case "pro":
      return "1st Class";
    default:
      return "Free";
  }
}

/** Next paid tier for free-week upgrade edge. */
export function nextPlanUp(plan: string): string | null {
  const d = divisionForPlan(plan);
  if (d === "explorer") return "member";
  if (d === "member") return "business";
  if (d === "business") return "pro";
  return null;
}

export const UPGRADE_EDGES: Array<{ from: string; to: string }> = [
  { from: "explorer", to: "member" },
  { from: "member", to: "business" },
  { from: "business", to: "pro" },
];
