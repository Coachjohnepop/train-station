import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { DEMO_MEMBER_EMAIL } from "@/lib/demo-workout";
import { isDemoMode, advanceDemoEnrollmentForWorkout } from "@/lib/demo-enrollments";
import {
  createDemoWorkoutLog,
  createDemoExercisePerformance,
} from "@/lib/demo-logs";
import { resolveUserId, getCurrentUserId } from "@/lib/current-user";

const logExerciseSchema = z.object({
  workoutExerciseId: z.string().optional(),
  exerciseId: z.string(),
  setScheme: z.string(),
  repPattern: z.string().nullable().optional(),
  reps: z.string().nullable().optional(),
  sets: z.number().int().nullable().optional(),
  weightTier: z.string(),
  startingWeightLbs: z.number().positive().optional().nullable(),
  repsCompleted: z.number().int().optional().nullable(),
  setsCompleted: z.number().int().optional().nullable(),
});

const logBodySchema = z.object({
  exercises: z.array(logExerciseSchema).min(0),  // allow partial (0+)
  programSlug: z.string().optional(),
  progress: z.number().int().min(0).max(100).optional(),
  targetUserId: z.string().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id: workoutId } = await params;

  const parsed = logBodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { detail: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const progress = parsed.data.progress ?? 100;
  const completed = progress === 100;
  const performedAt = new Date();

  const uid = parsed.data.targetUserId || (await resolveUserId("demo-user"));

  if (isDemoMode()) {
    // Demo path: persist to file so button works, silhouettes update, enrollment advances, % is recorded.
    // Supports instructor coaching a specific member via targetUserId (from admin) or current joined cookie user.
    const demoLog = createDemoWorkoutLog({
      workoutId,
      userId: uid,
      performedAt,
      completed,
      progress,
    });

    const createdIds: string[] = [];
    for (const ex of parsed.data.exercises) {
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

    // Advance demo enrollment if this log was from a program context (so schedule "Continue" and member view progress)
    if (parsed.data.programSlug) {
      try {
        advanceDemoEnrollmentForWorkout(parsed.data.programSlug, workoutId, uid);
      } catch {
        // non-fatal
      }
    }

    return NextResponse.json({
      ok: true,
      logId: demoLog.id,
      performances: createdIds.length,
      performedAt: demoLog.performedAt,
      progress: demoLog.progress,
      completed: demoLog.completed,
    });
  }

  // --- Real DB path (Supabase/Postgres) ---
  // Prefer cookie current user, fall back to the legacy demo email lookup for admin/demo flows
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
    return NextResponse.json({ detail: "User not found" }, { status: 500 });
  }

  const workout = await prisma.workout.findUnique({
    where: { id: workoutId },
    select: { id: true },
  });
  if (!workout) {
    return NextResponse.json({ detail: "Workout not found" }, { status: 404 });
  }

  // Create the session log
  const log = await prisma.workoutLog.create({
    data: {
      userId: user.id,
      workoutId,
      performedAt,
      completed,
      progress,
    },
  });

  // Create per-exercise performances for silhouettes / history
  const created = [];
  for (const ex of parsed.data.exercises) {
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

  // If logged from within a program schedule, try to advance the enrollment pointer
  // so "Continue" on dashboard and schedule progress feels alive.
  if (parsed.data.programSlug) {
    try {
      const enrollment = await prisma.programEnrollment.findFirst({
        where: {
          userId: user.id,
          program: { slug: parsed.data.programSlug },
        },
        include: { program: true },
      });
      if (enrollment) {
        // Support hybrid: match primary workoutId OR in the day's options
        const matchingDay = await prisma.programDay.findFirst({
          where: {
            week: { programId: enrollment.programId },
            OR: [
              { workoutId },
              { options: { some: { workoutId } } },
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
      // non-fatal; logging succeeded
    }
  }

  return NextResponse.json({
    ok: true,
    logId: log.id,
    performances: created.length,
    performedAt: performedAt.toISOString(),
    progress,
    completed,
  });
}
