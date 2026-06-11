/**
 * UserData layer — thin abstraction over user-specific state (enrollments, logs, equipment, settings, etc.).
 *
 * Today: delegates to the existing high-fidelity preview/JSON stores in prisma/*.dev.json + seed.
 * Tomorrow: will have a parallel Prisma implementation; callers won't care.
 *
 * This is the foundation for stabilizing the member experience (the source of recent churn)
 * and for safely adding new features (wizards that seed profile data, coach views, equipment-aware home options, etc.).
 *
 * Rule: All new or refactored member/coach code should go through functions here instead of
 * directly importing "demo-*.ts" or doing raw isDemoMode() + fs reads.
 */

import { isDemoMode as _isDemoMode, getDemoEnrollments, enrollDemo, unenrollDemo, advanceDemoEnrollmentForWorkout } from "@/lib/demo-enrollments";
import {
  createDemoWorkoutLog,
  createDemoExercisePerformance,
} from "@/lib/demo-logs";
import { prisma } from "@/lib/prisma";
import { DEMO_MEMBER_EMAIL } from "@/lib/demo-workout";
import { getCurrentUserId } from "@/lib/current-user";
import type { EnrollmentsMap, UserEnrollment, LogExerciseInput, CreateLogResult } from "./types";

// Re-export the log types so API routes and other layers can import the contract from the data layer.
export type { LogExerciseInput, CreateLogResult } from "./types";

// Re-export the single source of truth for demo vs real decision.
export const isDemoMode = _isDemoMode;

/**
 * Returns the enrollments for a specific user (or the legacy "demo-user" bucket).
 * In demo/preview: reads from enrollments.dev.json (per-uid with legacy migration + inherit).
 * In real DB mode: (future) will query ProgramEnrollment.
 *
 * This is the first method migrated into the data layer as part of Phase 0 stabilization.
 */
export function getUserEnrollments(userId?: string): EnrollmentsMap {
  // Today this is purely the preview path. Real path will be added here.
  return getDemoEnrollments(userId);
}

/**
 * Enroll a user in a program (idempotent).
 * Preview: writes to enrollments.dev.json.
 */
export function enrollUserInProgram(slug: string, userId?: string) {
  enrollDemo(slug, userId);
}

/**
 * Unenroll a user from a program.
 */
export function unenrollUserFromProgram(slug: string, userId?: string) {
  unenrollDemo(slug, userId);
}

/**
 * Convenience: turn the raw map into a typed array of UserEnrollment (what member-context etc. often want).
 */
export function getUserEnrollmentsAsArray(userId?: string): UserEnrollment[] {
  const map = getUserEnrollments(userId);
  return Object.entries(map).map(([slug, val]) => ({
    slug,
    currentWeek: val.currentWeek ?? 1,
    currentDay: val.currentDay ?? 1,
  }));
}

/**
 * Create a workout log entry + per-exercise performances (for silhouettes, strength, greens, counts).
 * If a programSlug is provided, also advance the user's enrollment pointer for that program
 * (using the logged workoutId to find the matching ProgramDay, supporting hybrid Gym/Home options).
 *
 * This is the central implementation for the most important member mutation.
 * The route becomes a thin caller; all branching + hybrid advance logic lives here.
 *
 * For the demo/preview branch we delegate to the existing high-fidelity createDemo* + advanceDemo*
 * helpers (so shapes, ids, and side effects for logs.dev.json / enrollments.dev.json stay identical,
 * and all existing read paths that consume those files continue to work without changes this slice).
 *
 * For the real Prisma branch we use the exact logic that was previously inline in the route
 * (user lookup with cookie + legacy DEMO_MEMBER_EMAIL fallback, creates, hybrid-aware advance).
 *
 * Returns a uniform shape that the MemberWorkoutConsole (and future callers) expect.
 */
export async function createWorkoutLogAndPerformances(input: {
  workoutId: string;
  userId: string;
  exercises: LogExerciseInput[];
  programSlug?: string;
  progress?: number;
}): Promise<CreateLogResult> {
  const progress = input.progress ?? 100;
  const completed = progress === 100;
  const performedAt = new Date();

  const uid = input.userId;

  if (isDemoMode()) {
    // Demo path: delegate to the proven helpers so that logs.dev.json, enrollments.dev.json,
    // greens/rings on schedule pages, past silhouettes, dashboard counts, coach impersonation,
    // and strength all continue to behave exactly as before.
    const demoLog = createDemoWorkoutLog({
      workoutId: input.workoutId,
      userId: uid,
      performedAt,
      completed,
      progress,
    });

    const createdIds: string[] = [];
    for (const ex of input.exercises) {
      const perf = createDemoExercisePerformance({
        exerciseId: ex.exerciseId,
        userId: uid,
        workoutExerciseId: ex.workoutExerciseId ?? null,
        setScheme: ex.setScheme,
        repPattern: ex.repPattern ?? null,
        reps: ex.reps ?? null,
        sets: ex.sets ?? null,
        weightTier: ex.weightTier,
        startingWeightLbs: ex.startingWeightLbs ?? null,
        performedAt,
        repsCompleted: ex.repsCompleted ?? null,
        setsCompleted: ex.setsCompleted ?? null,
      });
      createdIds.push(perf.id);
    }

    if (input.programSlug) {
      try {
        advanceDemoEnrollmentForWorkout(input.programSlug, input.workoutId, uid);
      } catch {
        // non-fatal (same as before)
      }
    }

    return {
      ok: true,
      logId: demoLog.id,
      performances: createdIds.length,
      performedAt: demoLog.performedAt,
      progress: demoLog.progress,
      completed: demoLog.completed,
    };
  }

  // --- Real DB path (Supabase/Postgres) ---
  // (Logic moved from the previous inline version in the route for centralization.)
  // Prefer cookie current user, fall back to the legacy demo email lookup for admin/demo flows.
  let userId = uid;
  try {
    const cookieUid = await getCurrentUserId();
    if (cookieUid) userId = cookieUid;
  } catch {}

  let user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    user = await prisma.user.findUnique({ where: { email: DEMO_MEMBER_EMAIL } });
  }
  if (!user) {
    // The caller (route) will typically surface a 500, but we return a shape the caller can handle.
    throw new Error("User not found for logging");
  }

  const workout = await prisma.workout.findUnique({
    where: { id: input.workoutId },
    select: { id: true },
  });
  if (!workout) {
    throw new Error("Workout not found");
  }

  // Create the session log
  const log = await prisma.workoutLog.create({
    data: {
      userId: user.id,
      workoutId: input.workoutId,
      performedAt,
      completed,
      progress,
    },
  });

  // Create per-exercise performances for silhouettes / history
  const created: string[] = [];
  for (const ex of input.exercises) {
    const perf = await prisma.exercisePerformance.create({
      data: {
        userId: user.id,
        exerciseId: ex.exerciseId,
        workoutExerciseId: ex.workoutExerciseId ?? null,
        setScheme: ex.setScheme,
        weightTier: ex.weightTier,
        startingWeightLbs: ex.startingWeightLbs ?? null,
        repsCompleted: ex.repsCompleted ?? null,
        setsCompleted: ex.setsCompleted ?? null,
        performedAt,
      },
    });
    created.push(perf.id);
  }

  // If logged from within a program schedule, advance the enrollment pointer
  // so "Continue" on dashboard and schedule progress / greens feel alive.
  // Supports hybrid: match primary workoutId OR in the day's options.
  if (input.programSlug) {
    try {
      const enrollment = await prisma.programEnrollment.findFirst({
        where: {
          userId: user.id,
          program: { slug: input.programSlug },
        },
        include: { program: true },
      });
      if (enrollment) {
        const matchingDay = await prisma.programDay.findFirst({
          where: {
            week: { programId: enrollment.programId },
            OR: [
              { workoutId: input.workoutId },
              { options: { some: { workoutId: input.workoutId } } },
            ],
          },
          include: { week: true },
        });
        if (matchingDay) {
          let nextWeek = matchingDay.week.weekNumber;
          let nextDay = matchingDay.dayNumber + 1;
          if (nextDay > 7) {
            nextDay = 1;
            nextWeek += 1;
          }
          const maxWeeks = enrollment.program.durationWeeks || 4;
          if (nextWeek > maxWeeks) {
            nextWeek = maxWeeks;
            nextDay = 7;
          }
          await prisma.programEnrollment.update({
            where: { id: enrollment.id },
            data: { currentWeek: nextWeek, currentDay: nextDay },
          });
        }
      }
    } catch {
      // non-fatal; logging succeeded (same behavior as before)
    }
  }

  return {
    ok: true,
    logId: log.id,
    performances: created.length,
    performedAt: performedAt.toISOString(),
    progress,
    completed,
  };
}

// Future methods (added slice-by-slice in later Phase 0 steps):
// - getUserWorkoutLogsAndPerformances(userId)
// - getUserEquipment(userId)
// - getUserStrengthScore(userId)
// - getUserReminderSettings(userId)
// - etc.
//
// Each will have the isDemoMode() branch (or repo dispatch) in ONE place.
// The createWorkoutLogAndPerformances above is the first full write-path example.
