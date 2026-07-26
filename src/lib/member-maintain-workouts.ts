import "server-only";

import { prisma } from "@/lib/prisma";
import { isDemoMode } from "@/lib/demo-enrollments";
import { localTodayIso } from "@/lib/program-calendar";
import {
  membershipPlanRank,
  normalizeSignupPlan,
  type MembershipPlan,
  type SignupPlan,
} from "@/lib/signup-plans";

/** Business Class and higher get included maintain quota (no earn path). */
export const MAINTAIN_MIN_PLAN: MembershipPlan = "business";

/** Coach Class can *see* the teaser (greyed) and earn limited uses. */
export const MAINTAIN_TEASER_MIN_PLAN: MembershipPlan = "member";

export const MAINTAIN_WORKOUT_SOURCE = "maintain";
export const MAINTAIN_DURATION_MIN = 45;

/** Coach Class earn path: log this many non-maintain workouts in the calendar month. */
export const MAINTAIN_EARN_SHOW_UPS = 2;
/**
 * Monthly Quick maintain uses for Business Class (included) and for Coach Class
 * after they complete the earn path. Same cap either way.
 */
export const MAINTAIN_EARNED_USES_PER_MONTH = 5;
/** Alias for copy / Business Class included allotment. */
export const MAINTAIN_BUSINESS_USES_PER_MONTH = MAINTAIN_EARNED_USES_PER_MONTH;

export type MaintainWorkoutCard = {
  id: string;
  name: string;
  muscleGroup: string;
  durationMin: number;
  exerciseCount: number;
  blurb: string;
};

/**
 * Access to start/log maintain sessions.
 * - full: Business Class (and higher) included — 5 uses / month
 * - earned: Coach Class met show-ups + on-demand, has uses left this month
 * - locked: greyscale teaser (upgrade or keep earning / used up)
 * Day complete (already logged a workout today) always blocks, with stamp UI.
 */
export type MaintainAccessMode = "full" | "earned" | "locked";

export type MaintainAccess = {
  allowed: boolean;
  mode: MaintainAccessMode;
  /** Already completed a workout today — maintain / on-demand closed. */
  dayComplete: boolean;
  /** Remaining starts this month (Business included or Coach earned). */
  usesRemaining: number | null;
  usesLimit: number | null;
  usesUsed: number;
  showUps: number;
  showUpsNeeded: number;
  showUpsMet: boolean;
  onDemandDone: boolean;
  onDemandParts: Array<{ id: string; label: string; done: boolean; href: string }>;
  earnReady: boolean;
  upgradeHref: string;
  monthKey: string;
  headline: string;
  detail: string;
};

function calendarMonthBounds(now = new Date()): {
  start: Date;
  end: Date;
  monthKey: string;
} {
  // Month keyed to app business calendar (APP_TIMEZONE), not Vercel UTC wall clock.
  const todayIso = localTodayIso(now);
  const [ys, ms] = todayIso.split("-");
  const y = Number(ys);
  const m = Number(ms);
  const monthKey = `${ys}-${ms}`;
  // Day bounds as civil midnight UTC-aligned to YYYY-MM (good enough for monthly quotas).
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 1, 0, 0, 0));
  return { start, end, monthKey };
}

/** Default library — generic muscle-group sessions, not program days. */
const DEFAULT_SPECS: Array<{
  key: string;
  name: string;
  muscleGroup: string;
  blurb: string;
  /** Prefer exercise names containing any of these (case-insensitive). */
  exerciseHints: string[];
}> = [
  {
    key: "upper-push",
    name: "Maintain · Upper Push",
    muscleGroup: "Chest · shoulders · triceps",
    blurb: "Press + arm work — clean ~45 min maintainer.",
    exerciseHints: [
      "Flat Bench",
      "Incline Dumbbell Chest Press",
      "Lateral Shoulder",
      "Frontal Shoulder",
      "Tricep Extension",
      "Chest Fly",
      "Plank",
    ],
  },
  {
    key: "upper-pull",
    name: "Maintain · Upper Pull",
    muscleGroup: "Back · biceps",
    blurb: "Rows + pulls + curls — posture and pull strength.",
    exerciseHints: [
      "Lat Pull",
      "Bent Over Row",
      "Seated Cable Back Row",
      "Face Pull",
      "Bicep Curl",
      "Hammer Curl",
      "Plank",
    ],
  },
  {
    key: "lower",
    name: "Maintain · Lower Body",
    muscleGroup: "Quads · glutes · hamstrings",
    blurb: "Squat / hinge / lunge pattern — legs without program day pressure.",
    exerciseHints: [
      "Barbell Back Squat",
      "Romanian Dead",
      "Leg Press",
      "Step Back Lunge",
      "Hip Thrust",
      "Calf Raise",
      "Air Squat",
    ],
  },
  {
    key: "full-body",
    name: "Maintain · Full Body",
    muscleGroup: "Full body",
    blurb: "One of each major pattern — when you just need to move today.",
    exerciseHints: [
      "Barbell Back Squat",
      "Flat Bench",
      "Bent Over Row",
      "Romanian Dead",
      "Lateral Shoulder",
      "Bicep Curl",
      "Plank",
    ],
  },
  {
    key: "core-engine",
    name: "Maintain · Core + Engine",
    muscleGroup: "Core · light conditioning",
    blurb: "Trunk strength and easy conditioning — recovery-friendly.",
    exerciseHints: [
      "Plank",
      "Abdominal",
      "Calf Raise",
      "Air Squat",
      "Band Lat",
      "Hip Abduction",
    ],
  },
];

/** True when plan is Business Class or higher (included monthly uses, no earn path). */
export function canAccessMaintainWorkouts(plan: SignupPlan | string | null | undefined): boolean {
  if (!plan) return false;
  const normalized = normalizeSignupPlan(String(plan));
  const rank = membershipPlanRank(normalized);
  const min = membershipPlanRank(MAINTAIN_MIN_PLAN);
  return rank !== null && min !== null && rank >= min;
}

/** Coach Class+ can see the maintain teaser (possibly greyed). */
export function canSeeMaintainTeaser(plan: SignupPlan | string | null | undefined): boolean {
  if (!plan) return false;
  const normalized = normalizeSignupPlan(String(plan));
  const rank = membershipPlanRank(normalized);
  const min = membershipPlanRank(MAINTAIN_TEASER_MIN_PLAN);
  return rank !== null && min !== null && rank >= min;
}

async function countShowUpWorkouts(
  userId: string,
  start: Date,
  end: Date,
): Promise<number> {
  if (isDemoMode()) return 0;
  return prisma.workoutLog.count({
    where: {
      userId,
      completed: true,
      performedAt: { gte: start, lt: end },
      workout: { source: { not: MAINTAIN_WORKOUT_SOURCE } },
    },
  });
}

/** True if member already completed any workout on the app calendar day. */
async function hasCompletedWorkoutToday(userId: string): Promise<boolean> {
  if (isDemoMode() || !userId) return false;
  const todayIso = localTodayIso();
  // Look back ~48h then filter by app-timezone civil day (handles Vercel UTC).
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const logs = await prisma.workoutLog.findMany({
    where: {
      userId,
      completed: true,
      performedAt: { gte: since },
    },
    select: { performedAt: true },
    take: 40,
    orderBy: { performedAt: "desc" },
  });
  return logs.some((l) => localTodayIso(l.performedAt) === todayIso);
}

function withDayCompleteGate(access: MaintainAccess, dayComplete: boolean): MaintainAccess {
  if (!dayComplete) return { ...access, dayComplete: false };
  return {
    ...access,
    dayComplete: true,
    allowed: false,
    headline: "Quick maintain · day complete",
    detail: "You already trained today — on-demand maintain opens again tomorrow.",
  };
}

async function countMaintainUses(
  userId: string,
  start: Date,
  end: Date,
): Promise<number> {
  if (isDemoMode()) return 0;
  return prisma.workoutLog.count({
    where: {
      userId,
      performedAt: { gte: start, lt: end },
      workout: { source: MAINTAIN_WORKOUT_SOURCE },
    },
  });
}

async function resolveOnDemandParts(
  userId: string,
  start: Date,
  end: Date,
): Promise<Array<{ id: string; label: string; done: boolean; href: string }>> {
  if (isDemoMode()) {
    return [
      {
        id: "nutrition",
        label: "On-demand nutrition",
        done: false,
        href: "/member/nutrition",
      },
    ];
  }

  const { getMemberContent } = await import("@/lib/member-content-store");
  const content = await getMemberContent();
  const parts: Array<{ id: string; label: string; done: boolean; href: string }> = [];

  const hasNutrition =
    Boolean(content.nutritionIntro?.trim()) || (content.nutritionTiers?.length ?? 0) > 0;
  const hasWeekly = Boolean(content.weeklyVideoUrl?.trim());
  const hasDinner = Boolean(content.dinnerVideoUrl?.trim());

  // Page views this month for on-demand surfaces
  const paths = await prisma.analyticsEvent.findMany({
    where: {
      userId,
      eventType: "page_view",
      occurredAt: { gte: start, lt: end },
      pagePath: { not: null },
    },
    select: { pagePath: true },
    take: 500,
  });
  const pathSet = new Set(
    paths.map((p) => (p.pagePath || "").split("?")[0]).filter(Boolean),
  );
  const visited = (prefix: string) =>
    [...pathSet].some((p) => p === prefix || p.startsWith(`${prefix}/`));

  if (hasNutrition) {
    parts.push({
      id: "nutrition",
      label: "Nutrition guidance (open this month)",
      done: visited("/member/nutrition"),
      href: "/member/nutrition",
    });
  }
  // Videos live on the Today strip — one “coach media” check covers weekly + dinner.
  if (hasWeekly || hasDinner) {
    const labels = [
      hasWeekly ? content.weeklyVideoTitle?.trim() || "Weekly video" : null,
      hasDinner ? content.dinnerVideoTitle?.trim() || "Dinner video" : null,
    ].filter(Boolean);
    parts.push({
      id: "coach-media",
      label: `Coach media (${labels.join(" · ")})`,
      // Soft signal until true video-complete events exist: visit Today this month.
      done: visited("/member/today"),
      href: "/member/today",
    });
  }

  // No on-demand content configured → only show-ups gate.
  if (parts.length === 0) {
    return [];
  }

  return parts;
}

/**
 * Resolve whether this member can start/log maintain workouts right now,
 * plus progress toward the Coach Class earn path.
 */
export async function resolveMaintainAccess(
  userId: string,
  plan: SignupPlan | string | null | undefined,
): Promise<MaintainAccess> {
  const { purchaseHref } = await import("@/lib/member-purchase-path");
  const { resolveStorageUserId } = await import("@/lib/enrollment-db");
  const upgradeHref = purchaseHref("business", { signedIn: true, role: "MEMBER" });
  const { start, end, monthKey } = calendarMonthBounds();
  const showUpsNeeded = MAINTAIN_EARN_SHOW_UPS;
  const storageUserId = userId ? await resolveStorageUserId(userId) : "";

  const emptyLocked = (headline: string, detail: string): MaintainAccess => ({
    allowed: false,
    mode: "locked",
    dayComplete: false,
    usesRemaining: 0,
    usesLimit: MAINTAIN_BUSINESS_USES_PER_MONTH,
    usesUsed: 0,
    showUps: 0,
    showUpsNeeded,
    showUpsMet: false,
    onDemandDone: false,
    onDemandParts: [],
    earnReady: false,
    upgradeHref,
    monthKey,
    headline,
    detail,
  });

  if (!userId) {
    return emptyLocked("Quick maintain", "Sign in to unlock maintain sessions.");
  }

  const dayComplete = await hasCompletedWorkoutToday(storageUserId);
  const usesLimit = MAINTAIN_BUSINESS_USES_PER_MONTH;

  if (canAccessMaintainWorkouts(plan)) {
    const usesUsed = await countMaintainUses(storageUserId, start, end);
    const usesRemaining = Math.max(0, usesLimit - usesUsed);
    const allowed = usesRemaining > 0;
    if (!allowed) {
      return withDayCompleteGate(
        {
          allowed: false,
          mode: "locked",
          dayComplete: false,
          usesRemaining: 0,
          usesLimit,
          usesUsed,
          showUps: showUpsNeeded,
          showUpsNeeded,
          showUpsMet: true,
          onDemandDone: true,
          onDemandParts: [],
          earnReady: true,
          upgradeHref,
          monthKey,
          headline: "Quick maintain · 5 uses used",
          detail: `Business Class includes ${usesLimit} Quick maintain sessions per month. You’re out for this month — resets next month.`,
        },
        dayComplete,
      );
    }
    return withDayCompleteGate(
      {
        allowed: true,
        mode: "full",
        dayComplete: false,
        usesRemaining,
        usesLimit,
        usesUsed,
        showUps: showUpsNeeded,
        showUpsNeeded,
        showUpsMet: true,
        onDemandDone: true,
        onDemandParts: [],
        earnReady: true,
        upgradeHref,
        monthKey,
        headline: `Quick maintain · ${usesRemaining} of ${usesLimit} left`,
        detail: `Business Class — ${usesLimit} Quick maintain sessions per month (~45 min muscle-group).`,
      },
      dayComplete,
    );
  }

  // Explorer (and below teaser floor): locked, upgrade only
  if (!canSeeMaintainTeaser(plan)) {
    return withDayCompleteGate(
      {
        ...emptyLocked(
          "Quick maintain · locked",
          "Upgrade to Coach Class or higher, then earn 5 uses/month — or go Business Class for 5 uses included.",
        ),
        upgradeHref: purchaseHref("member", { signedIn: true, role: "MEMBER" }),
      },
      dayComplete,
    );
  }

  // Coach Class earn path
  const [showUps, usesUsed, onDemandParts] = await Promise.all([
    countShowUpWorkouts(storageUserId, start, end),
    countMaintainUses(storageUserId, start, end),
    resolveOnDemandParts(storageUserId, start, end),
  ]);
  const showUpsMet = showUps >= showUpsNeeded;
  const onDemandDone = onDemandParts.length === 0 || onDemandParts.every((p) => p.done);
  const earnReady = showUpsMet && onDemandDone;
  const usesRemaining = Math.max(0, usesLimit - usesUsed);
  const allowed = earnReady && usesRemaining > 0;

  if (allowed) {
    return withDayCompleteGate(
      {
        allowed: true,
        mode: "earned",
        dayComplete: false,
        usesRemaining,
        usesLimit,
        usesUsed,
        showUps,
        showUpsNeeded,
        showUpsMet,
        onDemandDone,
        onDemandParts,
        earnReady,
        upgradeHref,
        monthKey,
        headline: `Quick maintain · ${usesRemaining} of ${usesLimit} left`,
        detail: `Earned this month by showing up and finishing on-demand. Business Class includes ${usesLimit} uses/month with no earn path.`,
      },
      dayComplete,
    );
  }

  if (earnReady && usesRemaining <= 0) {
    return withDayCompleteGate(
      {
        allowed: false,
        mode: "locked",
        dayComplete: false,
        usesRemaining: 0,
        usesLimit,
        usesUsed,
        showUps,
        showUpsNeeded,
        showUpsMet,
        onDemandDone,
        onDemandParts,
        earnReady,
        upgradeHref,
        monthKey,
        headline: "Quick maintain · used up",
        detail: `You used all ${usesLimit} earned sessions this month. Resets next month — or upgrade to Business Class for ${usesLimit} included uses each month.`,
      },
      dayComplete,
    );
  }

  const missing: string[] = [];
  if (!showUpsMet) {
    missing.push(`show up to ${showUpsNeeded} workouts (${showUps}/${showUpsNeeded})`);
  }
  if (!onDemandDone) {
    missing.push("finish this month’s on-demand content");
  }

  return withDayCompleteGate(
    {
      allowed: false,
      mode: "locked",
      dayComplete: false,
      usesRemaining: 0,
      usesLimit,
      usesUsed,
      showUps,
      showUpsNeeded,
      showUpsMet,
      onDemandDone,
      onDemandParts,
      earnReady,
      upgradeHref,
      monthKey,
      headline: "Quick maintain · locked",
      detail: `Coach Class: ${missing.join(" and ")} for ${usesLimit} uses this month — or upgrade to Business Class for ${usesLimit} uses/month included (no earn path).`,
    },
    dayComplete,
  );
}

function parseMaintainMeta(description: string | null | undefined): {
  key: string | null;
  muscleGroup: string;
  blurb: string;
} {
  const raw = (description || "").trim();
  // maintain|key|muscle|blurb
  if (raw.startsWith("maintain|")) {
    const parts = raw.split("|");
    return {
      key: parts[1] || null,
      muscleGroup: parts[2] || "Maintain",
      blurb: parts.slice(3).join("|") || "45-minute maintain session.",
    };
  }
  return {
    key: null,
    muscleGroup: "Maintain",
    blurb: raw || "45-minute maintain session.",
  };
}

function encodeMaintainMeta(key: string, muscleGroup: string, blurb: string): string {
  return `maintain|${key}|${muscleGroup}|${blurb}`.slice(0, 500);
}

async function pickExercisesByHints(hints: string[], limit = 7): Promise<string[]> {
  const library = await prisma.exercise.findMany({
    where: { archivedAt: null },
    select: { id: true, name: true },
    take: 400,
  });
  const picked: string[] = [];
  const used = new Set<string>();
  for (const hint of hints) {
    if (picked.length >= limit) break;
    const h = hint.toLowerCase();
    const hit = library.find(
      (e) => !used.has(e.id) && e.name.toLowerCase().includes(h),
    );
    if (hit) {
      used.add(hit.id);
      picked.push(hit.id);
    }
  }
  // fill if sparse
  for (const e of library) {
    if (picked.length >= Math.min(5, limit)) break;
    if (used.has(e.id)) continue;
    used.add(e.id);
    picked.push(e.id);
  }
  return picked;
}

/**
 * Maintain default: 3×10 medium.
 * Holds/planks: 3 rounds × 45s (standard sets — not "timed minutes", which made
 * setCount=3 look like a 3-minute single hold and fought reps "45s").
 */
const MAINTAIN_SETS = 3;
const MAINTAIN_REPS = "10";
const MAINTAIN_REST_SEC = 90;
const MAINTAIN_HOLD_SEC = 45;

function isHoldStyleExercise(name: string): boolean {
  const n = name.toLowerCase();
  return (
    n.includes("plank") ||
    n.includes("hold") ||
    n.includes("dead hang") ||
    n.includes("wall sit")
  );
}

function maintainExerciseRx(exerciseName: string): {
  setScheme: string;
  repPattern: string | null;
  reps: string;
  sets: number;
  setCount: number;
  weightTier: string;
  restBetweenSetsSec: number;
  notes: string;
  phase: { phaseType: "REPS" | "TIMED"; reps: number | null; durationSec: number | null };
} {
  if (isHoldStyleExercise(exerciseName)) {
    return {
      // Standard so members get 3 set checkoffs; green hold timer parses "45s" each round.
      setScheme: "standard",
      repPattern: null,
      reps: `${MAINTAIN_HOLD_SEC}s`,
      sets: MAINTAIN_SETS,
      setCount: MAINTAIN_SETS,
      weightTier: "light",
      restBetweenSetsSec: 60,
      notes: `Hold solid form ~${MAINTAIN_HOLD_SEC}s — ${MAINTAIN_SETS} rounds. Maintain pace.`,
      phase: { phaseType: "TIMED", reps: null, durationSec: MAINTAIN_HOLD_SEC },
    };
  }
  // Isolation-ish: a bit higher rep
  const lowerName = exerciseName.toLowerCase();
  const isolation =
    lowerName.includes("curl") ||
    lowerName.includes("extension") ||
    lowerName.includes("raise") ||
    lowerName.includes("fly") ||
    lowerName.includes("kick");
  const reps = isolation ? "12" : MAINTAIN_REPS;
  return {
    setScheme: "standard",
    repPattern: null,
    reps,
    sets: MAINTAIN_SETS,
    setCount: MAINTAIN_SETS,
    weightTier: "medium",
    restBetweenSetsSec: MAINTAIN_REST_SEC,
    notes: "Maintain pace — solid form, finish in ~45 minutes.",
    phase: {
      phaseType: "REPS",
      reps: Number(reps) || 10,
      durationSec: null,
    },
  };
}

async function createMaintainWorkout(spec: (typeof DEFAULT_SPECS)[number]): Promise<string | null> {
  const exerciseIds = await pickExercisesByHints(spec.exerciseHints, 7);
  if (exerciseIds.length < 4) return null;

  const library = await prisma.exercise.findMany({
    where: { id: { in: exerciseIds } },
    select: { id: true, name: true },
  });
  const nameById = new Map(library.map((e) => [e.id, e.name]));

  const workout = await prisma.workout.create({
    data: {
      name: spec.name,
      description: encodeMaintainMeta(spec.key, spec.muscleGroup, spec.blurb),
      source: MAINTAIN_WORKOUT_SOURCE,
      restTimerEnabled: true,
      restTimerSeconds: MAINTAIN_REST_SEC,
      restTimerSound: "cybertruck",
      exercises: {
        create: exerciseIds.map((exerciseId, sortOrder) => {
          const rx = maintainExerciseRx(nameById.get(exerciseId) || "");
          return {
            exercise: { connect: { id: exerciseId } },
            sortOrder,
            setScheme: rx.setScheme,
            repPattern: rx.repPattern,
            reps: rx.reps,
            sets: rx.sets,
            setCount: rx.setCount,
            weightTier: rx.weightTier,
            restBetweenSetsSec: rx.restBetweenSetsSec,
            notes: rx.notes,
            phases: {
              create: [
                {
                  phaseIndex: 0,
                  phaseType: rx.phase.phaseType,
                  reps: rx.phase.reps,
                  durationSec: rx.phase.durationSec,
                  repKind: "FIXED" as const,
                },
              ],
            },
          };
        }),
      },
    },
  });
  return workout.id;
}

/** Fix existing maintain rows: standard 3×10 (or timed holds), setCount, phases. */
export async function repairMaintainWorkoutPrescriptions(): Promise<number> {
  if (isDemoMode()) return 0;

  const rows = await prisma.workoutExercise.findMany({
    where: { workout: { source: MAINTAIN_WORKOUT_SOURCE } },
    select: {
      id: true,
      setScheme: true,
      reps: true,
      sets: true,
      setCount: true,
      weightTier: true,
      exercise: { select: { name: true } },
      phases: { select: { id: true } },
    },
  });

  let fixed = 0;
  for (const row of rows) {
    const rx = maintainExerciseRx(row.exercise.name);
    const needsFix =
      row.setScheme !== rx.setScheme ||
      row.reps !== rx.reps ||
      row.sets !== rx.sets ||
      row.setCount !== rx.setCount ||
      row.weightTier !== rx.weightTier ||
      row.phases.length === 0;

    if (!needsFix) continue;

    await prisma.workoutExercise.update({
      where: { id: row.id },
      data: {
        setScheme: rx.setScheme,
        repPattern: rx.repPattern,
        reps: rx.reps,
        sets: rx.sets,
        setCount: rx.setCount,
        weightTier: rx.weightTier,
        restBetweenSetsSec: rx.restBetweenSetsSec,
        notes: rx.notes,
      },
    });

    if (row.phases.length === 0) {
      await prisma.workoutSetPhase.create({
        data: {
          workoutExerciseId: row.id,
          phaseIndex: 0,
          phaseType: rx.phase.phaseType,
          reps: rx.phase.reps,
          durationSec: rx.phase.durationSec,
          repKind: "FIXED",
        },
      });
    } else {
      // Refresh first phase to match rx
      await prisma.workoutSetPhase.updateMany({
        where: { workoutExerciseId: row.id, phaseIndex: 0 },
        data: {
          phaseType: rx.phase.phaseType,
          reps: rx.phase.reps,
          durationSec: rx.phase.durationSec,
          repKind: "FIXED",
        },
      });
    }
    fixed += 1;
  }
  return fixed;
}

/** Ensure default maintain library exists (idempotent) and prescriptions are complete. */
export async function ensureDefaultMaintainWorkouts(): Promise<void> {
  if (isDemoMode()) return;

  const existing = await prisma.workout.findMany({
    where: { source: MAINTAIN_WORKOUT_SOURCE },
    select: { id: true, description: true },
  });
  const keys = new Set(
    existing.map((w) => parseMaintainMeta(w.description).key).filter(Boolean),
  );

  for (const spec of DEFAULT_SPECS) {
    if (keys.has(spec.key)) continue;
    try {
      await createMaintainWorkout(spec);
    } catch (e) {
      console.warn("[maintain] seed failed", spec.key, e);
    }
  }

  try {
    const fixed = await repairMaintainWorkoutPrescriptions();
    if (fixed > 0) console.info(`[maintain] repaired ${fixed} exercise prescriptions`);
  } catch (e) {
    console.warn("[maintain] repair failed", e);
  }
}

export async function listMaintainWorkouts(): Promise<MaintainWorkoutCard[]> {
  if (isDemoMode()) return [];

  await ensureDefaultMaintainWorkouts();

  const rows = await prisma.workout.findMany({
    where: { source: MAINTAIN_WORKOUT_SOURCE },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      _count: { select: { exercises: true } },
    },
  });

  return rows
    .filter((r) => r._count.exercises > 0)
    .map((r) => {
      const meta = parseMaintainMeta(r.description);
      return {
        id: r.id,
        name: r.name.replace(/^Maintain ·\s*/i, ""),
        muscleGroup: meta.muscleGroup,
        durationMin: MAINTAIN_DURATION_MIN,
        exerciseCount: r._count.exercises,
        blurb: meta.blurb,
      };
    });
}

export async function isMaintainWorkoutId(workoutId: string): Promise<boolean> {
  if (!workoutId || isDemoMode()) return false;
  const row = await prisma.workout.findUnique({
    where: { id: workoutId },
    select: { source: true },
  });
  return row?.source === MAINTAIN_WORKOUT_SOURCE;
}
