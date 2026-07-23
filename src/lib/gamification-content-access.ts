import "server-only";

import { getGamificationLevers } from "@/lib/gamification-config-store";
import { getEffectiveMembershipPlan } from "@/lib/gamification-promos";
import { divisionForPlan } from "@/lib/gamification-levers";
import type { MembershipPlan } from "@/lib/signup-plans";
import { isMembershipPlan, membershipPlanRank, signupPlanLabel } from "@/lib/signup-plans";

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
  /** Coach pinned this day as free sample */
  freePoolPinned: boolean;
  mode: "percent" | "curated" | "open" | "bypassed";
};

/**
 * Free explorers only unlock ~freeContentPercent of a 28-day cycle (default 10% ≈ days 1–3),
 * unless coach pins freePool days (curated mode).
 */
export function freePoolDayInCycle(
  enrollmentDayLinear: number,
  freePercent: number,
  cycleDays = 28,
): { dayInCycle: number; freeDays: number; allowed: boolean } {
  const freeDays = Math.max(
    1,
    Math.ceil((cycleDays * Math.min(100, Math.max(0, freePercent))) / 100),
  );
  const dayInCycle = ((Math.max(1, enrollmentDayLinear) - 1) % cycleDays) + 1;
  return { dayInCycle, freeDays, allowed: dayInCycle <= freeDays };
}

function planMeetsMin(plan: MembershipPlan, min: string | null | undefined): boolean {
  if (!min || !isMembershipPlan(min as MembershipPlan)) return true;
  const need = membershipPlanRank(min as MembershipPlan);
  const have = membershipPlanRank(plan);
  if (need == null || have == null) return true;
  return have >= need;
}

export async function resolveContentAccess(input: {
  userId: string;
  profilePlan?: string | null;
  /** Linear enrollment day (1…N) when known */
  enrollmentDay?: number | null;
  /** Staff preview / coach viewing as instructor */
  bypass?: boolean;
  /**
   * When coach has pinned freePool on program days:
   * - freePoolPinned true → free explorers allowed
   * - curatedMode true + freePoolPinned false → locked for free
   * - curatedMode false → fall back to percent-of-cycle
   */
  freePoolPinned?: boolean | null;
  curatedMode?: boolean | null;
  /** Optional floor: member | business | pro */
  contentTierMin?: string | null;
}): Promise<ContentAccessResult> {
  const levers = await getGamificationLevers();
  const plan = await getEffectiveMembershipPlan(input.userId, input.profilePlan);
  const cycleDays = 28;
  const freeDaysInCycle = Math.max(
    1,
    Math.ceil((cycleDays * levers.freeContentPercent) / 100),
  );
  const base = {
    plan,
    freeContentPercent: levers.freeContentPercent,
    freeDaysInCycle,
    cycleDays,
    upgradePlan: "member" as MembershipPlan,
    upgradeLabel: signupPlanLabel("member"),
    freePoolPinned: Boolean(input.freePoolPinned),
  };

  if (input.bypass || !levers.featureEnabled) {
    return {
      ...base,
      locked: false,
      dayInCycle: null,
      reason: null,
      upgradePlan: null,
      upgradeLabel: null,
      mode: "bypassed",
    };
  }

  // contentTierMin applies to everyone (paid floors)
  if (input.contentTierMin && !planMeetsMin(plan, input.contentTierMin)) {
    const need = isMembershipPlan(input.contentTierMin as MembershipPlan)
      ? (input.contentTierMin as MembershipPlan)
      : "member";
    return {
      ...base,
      locked: true,
      dayInCycle: null,
      reason: `This day requires ${signupPlanLabel(need)} or higher.`,
      upgradePlan: need,
      upgradeLabel: signupPlanLabel(need),
      mode: "open",
    };
  }

  const div = divisionForPlan(plan);
  if (div !== "explorer") {
    return {
      ...base,
      locked: false,
      dayInCycle: null,
      reason: null,
      upgradePlan: null,
      upgradeLabel: null,
      mode: "open",
    };
  }

  // Free explorer path
  if (input.curatedMode) {
    if (input.freePoolPinned) {
      return {
        ...base,
        locked: false,
        dayInCycle: null,
        reason: null,
        mode: "curated",
      };
    }
    return {
      ...base,
      locked: true,
      dayInCycle: null,
      reason:
        "This day isn’t in the free sample set. Coach pinned specific free days — grab those on the day wheel, or upgrade for the full cycle.",
      mode: "curated",
    };
  }

  const day = input.enrollmentDay;
  if (day == null || !Number.isFinite(day) || day < 1) {
    return {
      ...base,
      locked: false,
      dayInCycle: null,
      reason: null,
      mode: "percent",
    };
  }

  const pool = freePoolDayInCycle(day, levers.freeContentPercent, cycleDays);
  if (pool.allowed) {
    return {
      ...base,
      locked: false,
      freeDaysInCycle: pool.freeDays,
      dayInCycle: pool.dayInCycle,
      reason: null,
      mode: "percent",
    };
  }

  return {
    ...base,
    locked: true,
    freeDaysInCycle: pool.freeDays,
    dayInCycle: pool.dayInCycle,
    reason: `Free ticket includes ~${levers.freeContentPercent}% of the cycle (days 1–${pool.freeDays}). Day ${pool.dayInCycle} is Coach Class territory.`,
    mode: "percent",
  };
}

/**
 * Server-side gate for workout log (and similar write paths).
 * Mirrors member Today free-pool / content-tier rules so explorers cannot bypass the UI lock.
 */
export async function assertMemberCanLogWorkout(input: {
  userId: string;
  programSlug?: string | null;
  /** Staff logging for a member */
  staffBypass?: boolean;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (input.staffBypass) return { ok: true };

  const slug = (input.programSlug || "adult").trim() || "adult";
  let enrollmentDay: number | null = null;
  let freePoolPinned: boolean | undefined;
  let curatedMode: boolean | undefined;
  let contentTierMin: string | null | undefined;
  let profilePlan: string | null | undefined;

  try {
    const { getMemberProfile } = await import("@/lib/member-profiles-store");
    const profile = await getMemberProfile(input.userId);
    profilePlan = profile?.plan ?? null;
  } catch {
    /* continue with defaults */
  }

  try {
    const { getEnrollmentsMapForUser } = await import("@/lib/enrollment-db");
    const { linearEnrollmentDay } = await import("@/lib/member-enrollment-day");
    const enrollments = await getEnrollmentsMapForUser(input.userId);
    const pos = enrollments[slug];
    if (pos) {
      enrollmentDay = linearEnrollmentDay(pos.currentWeek || 1, pos.currentDay || 1);
      try {
        const { getDayFreePoolFlags } = await import("@/lib/gamification-free-pool");
        const flags = await getDayFreePoolFlags(
          slug,
          pos.currentWeek || 1,
          pos.currentDay || 1,
        );
        freePoolPinned = flags.freePoolPinned;
        curatedMode = flags.curatedMode;
        contentTierMin = flags.contentTierMin;
      } catch {
        /* percent mode only */
      }
    }
  } catch {
    /* no enrollment → resolveContentAccess stays open for explorers without day */
  }

  const access = await resolveContentAccess({
    userId: input.userId,
    profilePlan,
    enrollmentDay: enrollmentDay ?? undefined,
    freePoolPinned,
    curatedMode,
    contentTierMin,
  });

  if (access.locked) {
    return {
      ok: false,
      reason: access.reason || "This workout is locked for free-ticket members. Upgrade to unlock.",
    };
  }
  return { ok: true };
}
