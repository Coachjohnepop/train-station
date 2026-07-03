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

import {
  isDemoMode as _isDemoMode,
  getDemoEnrollments,
  enrollDemo,
  unenrollDemo,
  advanceDemoEnrollmentForWorkout,
  setDemoEnrollmentPosition,
} from "@/lib/demo-enrollments";
import {
  enrollUserInProgramDb,
  getEnrollmentsMapForUser,
  resolveStorageUserId,
  setUserProgramPositionDb,
  unenrollUserFromProgramDb,
} from "@/lib/enrollment-db";
import { clampEnrollmentPosition, linearEnrollmentDay } from "@/lib/member-enrollment-day";
import { getProgramBySlug } from "@/lib/program-data";
import { recordDemoWorkoutSession } from "@/lib/demo-logs";
import { prisma } from "@/lib/prisma";

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
export async function getUserEnrollments(userId?: string): Promise<EnrollmentsMap> {
  const uid = userId || "demo-user";
  if (isDemoMode()) {
    return getDemoEnrollments(uid);
  }
  return getEnrollmentsMapForUser(uid);
}

/**
 * Enroll a user in a program (idempotent).
 * Preview: writes to enrollments.dev.json.
 */
export async function enrollUserInProgram(slug: string, userId?: string) {
  const uid = userId || "demo-user";
  if (isDemoMode()) {
    await enrollDemo(slug, uid);
    return;
  }
  await enrollUserInProgramDb(slug, uid);
}

/**
 * Unenroll a user from a program.
 */
export async function unenrollUserFromProgram(slug: string, userId?: string) {
  const uid = userId || "demo-user";
  if (isDemoMode()) {
    await unenrollDemo(slug, uid);
    return;
  }
  await unenrollUserFromProgramDb(slug, uid);
}

/**
 * Convenience: turn the raw map into a typed array of UserEnrollment (what member-context etc. often want).
 */
export async function getUserEnrollmentsAsArray(userId?: string): Promise<UserEnrollment[]> {
  const map = await getUserEnrollments(userId);
  return Object.entries(map).map(([slug, val]) => ({
    slug,
    currentWeek: val.currentWeek ?? 1,
    currentDay: val.currentDay ?? 1,
  }));
}

export type ProgramPositionResult = {
  programSlug: string;
  programName: string;
  currentWeek: number;
  currentDay: number;
  enrollmentDayNumber: number;
  durationWeeks: number;
};

/** Coach-set member position in a program (week + day within week). */
export async function setUserProgramPosition(
  userId: string,
  programSlug: string,
  currentWeek: number,
  currentDay: number,
): Promise<ProgramPositionResult> {
  const program = await getProgramBySlug(programSlug);
  if (!program) {
    throw new Error("Program not found");
  }

  const { weekNumber, dayNumber } = clampEnrollmentPosition(
    currentWeek,
    currentDay,
    program.durationWeeks,
  );

  if (isDemoMode()) {
    const map = await getUserEnrollments(userId);
    if (!map[programSlug]) {
      await enrollDemo(programSlug, userId);
    }
    await setDemoEnrollmentPosition(
      programSlug,
      weekNumber,
      dayNumber,
      userId,
      program.durationWeeks,
    );
  } else {
    await setUserProgramPositionDb(userId, programSlug, weekNumber, dayNumber);
  }

  return {
    programSlug,
    programName: program.name,
    currentWeek: weekNumber,
    currentDay: dayNumber,
    enrollmentDayNumber: linearEnrollmentDay(weekNumber, dayNumber),
    durationWeeks: program.durationWeeks,
  };
}

export async function getUserProgramPositions(userId: string): Promise<ProgramPositionResult[]> {
  const enrolls = await getUserEnrollmentsAsArray(userId);
  const out: ProgramPositionResult[] = [];

  for (const en of enrolls) {
    const program = await getProgramBySlug(en.slug);
    if (!program) continue;
    const cat = (program.category || "workout") as string;
    if (cat !== "workout" && cat !== "journey" && cat !== "yoga") continue;

    const { weekNumber, dayNumber } = clampEnrollmentPosition(
      en.currentWeek,
      en.currentDay,
      program.durationWeeks,
    );

    out.push({
      programSlug: en.slug,
      programName: program.name,
      currentWeek: weekNumber,
      currentDay: dayNumber,
      enrollmentDayNumber: linearEnrollmentDay(weekNumber, dayNumber),
      durationWeeks: program.durationWeeks,
    });
  }

  return out.sort((a, b) => {
    if (a.programSlug === "adult") return -1;
    if (b.programSlug === "adult") return 1;
    return a.programName.localeCompare(b.programName);
  });
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
 * For the real Prisma branch we resolve demo roster ids to Prisma User.id via resolveStorageUserId.
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
    const { log: demoLog, performanceIds } = await recordDemoWorkoutSession({
      workoutId: input.workoutId,
      userId: uid,
      performedAt,
      completed,
      progress,
      exercises: input.exercises.map((ex) => ({
        exerciseId: ex.exerciseId,
        workoutExerciseId: ex.workoutExerciseId ?? null,
        setScheme: ex.setScheme,
        repPattern: ex.repPattern ?? null,
        reps: ex.reps ?? null,
        sets: ex.sets ?? null,
        weightTier: ex.weightTier,
        startingWeightLbs: ex.startingWeightLbs ?? null,
        repsCompleted: ex.repsCompleted ?? null,
        setsCompleted: ex.setsCompleted ?? null,
      })),
    });

    if (input.programSlug) {
      try {
        await advanceDemoEnrollmentForWorkout(input.programSlug, input.workoutId, uid);
      } catch {
        // non-fatal (same as before)
      }
    }

    return {
      ok: true,
      logId: demoLog.id,
      performances: performanceIds.length,
      performedAt: demoLog.performedAt,
      progress: demoLog.progress,
      completed: demoLog.completed,
    };
  }

  // --- Real DB path (Supabase/Postgres) ---
  const storageUserId = await resolveStorageUserId(uid);
  const user = await prisma.user.findUnique({ where: { id: storageUserId } });
  if (!user) {
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
