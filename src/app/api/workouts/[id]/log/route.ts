import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { DEMO_MEMBER_EMAIL } from "@/lib/demo-workout";

const logExerciseSchema = z.object({
  workoutExerciseId: z.string().optional(),
  exerciseId: z.string(),
  setScheme: z.string(),
  weightTier: z.string(),
  startingWeightLbs: z.number().positive().optional().nullable(),
});

const logBodySchema = z.object({
  exercises: z.array(logExerciseSchema).min(1),
  programSlug: z.string().optional(),
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

  const user = await prisma.user.findUnique({
    where: { email: DEMO_MEMBER_EMAIL },
  });
  if (!user) {
    return NextResponse.json({ detail: "Demo member not found" }, { status: 500 });
  }

  const workout = await prisma.workout.findUnique({
    where: { id: workoutId },
    select: { id: true },
  });
  if (!workout) {
    return NextResponse.json({ detail: "Workout not found" }, { status: 404 });
  }

  const performedAt = new Date();

  // Create the session log
  const log = await prisma.workoutLog.create({
    data: {
      userId: user.id,
      workoutId,
      performedAt,
      completed: true,
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
        const matchingDay = await prisma.programDay.findFirst({
          where: {
            workoutId,
            week: { programId: enrollment.programId },
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
  });
}
