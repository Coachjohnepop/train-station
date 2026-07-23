import "server-only";

import { getGamificationLevers } from "@/lib/gamification-config-store";
import { getEffectiveMembershipPlan } from "@/lib/gamification-promos";
import { divisionForPlan } from "@/lib/gamification-levers";
import type { MembershipPlan } from "@/lib/signup-plans";
import { signupPlanLabel } from "@/lib/signup-plans";

export type ContentAccessResult = {
  plan: MembershipPlan;
  locked: boolean;
  freeContentPercent: number;
  freeDaysInCycle: number;
  dayInCycle: number | null;
  cycleDays: number;
  reason: string | null;
  upgradePlan: MembershipPlan | null;
  upgradeLabel: string | null;
};

/**
 * Free explorers only unlock ~freeContentPercent of a 28-day cycle (default 10% ≈ days 1–3).
 * Coach+ unlocked for standard days; business exclusives later via day flags.
 */
export function freePoolDayInCycle(
  enrollmentDayLinear: number,
  freePercent: number,
  cycleDays = 28,
): { dayInCycle: number; freeDays: number; allowed: boolean } {
  const freeDays = Math.max(1, Math.ceil((cycleDays * Math.min(100, Math.max(0, freePercent))) / 100));
  const dayInCycle = ((Math.max(1, enrollmentDayLinear) - 1) % cycleDays) + 1;
  return { dayInCycle, freeDays, allowed: dayInCycle <= freeDays };
}

export async function resolveContentAccess(input: {
  userId: string;
  profilePlan?: string | null;
  /** Linear enrollment day (1…N) when known */
  enrollmentDay?: number | null;
  /** Staff preview / coach viewing as instructor */
  bypass?: boolean;
}): Promise<ContentAccessResult> {
  const levers = await getGamificationLevers();
  const plan = await getEffectiveMembershipPlan(input.userId, input.profilePlan);
  const cycleDays = 28;
  const freeDaysInCycle = Math.max(
    1,
    Math.ceil((cycleDays * levers.freeContentPercent) / 100),
  );

  if (input.bypass || !levers.featureEnabled) {
    return {
      plan,
      locked: false,
      freeContentPercent: levers.freeContentPercent,
      freeDaysInCycle,
      dayInCycle: null,
      cycleDays,
      reason: null,
      upgradePlan: null,
      upgradeLabel: null,
    };
  }

  const div = divisionForPlan(plan);
  if (div !== "explorer") {
    return {
      plan,
      locked: false,
      freeContentPercent: levers.freeContentPercent,
      freeDaysInCycle,
      dayInCycle: null,
      cycleDays,
      reason: null,
      upgradePlan: null,
      upgradeLabel: null,
    };
  }

  const day = input.enrollmentDay;
  if (day == null || !Number.isFinite(day) || day < 1) {
    // Unknown day — allow warm-ups / empty; lock full player only when we know day is out of pool
    return {
      plan,
      locked: false,
      freeContentPercent: levers.freeContentPercent,
      freeDaysInCycle,
      dayInCycle: null,
      cycleDays,
      reason: null,
      upgradePlan: "member",
      upgradeLabel: signupPlanLabel("member"),
    };
  }

  const pool = freePoolDayInCycle(day, levers.freeContentPercent, cycleDays);
  if (pool.allowed) {
    return {
      plan,
      locked: false,
      freeContentPercent: levers.freeContentPercent,
      freeDaysInCycle: pool.freeDays,
      dayInCycle: pool.dayInCycle,
      cycleDays,
      reason: null,
      upgradePlan: "member",
      upgradeLabel: signupPlanLabel("member"),
    };
  }

  return {
    plan,
    locked: true,
    freeContentPercent: levers.freeContentPercent,
    freeDaysInCycle: pool.freeDays,
    dayInCycle: pool.dayInCycle,
    cycleDays,
    reason: `Free ticket includes ~${levers.freeContentPercent}% of the cycle (days 1–${pool.freeDays}). Day ${pool.dayInCycle} is Coach Class territory.`,
    upgradePlan: "member",
    upgradeLabel: signupPlanLabel("member"),
  };
}
