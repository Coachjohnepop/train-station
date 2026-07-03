import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveUserId } from "@/lib/current-user";
import { createWorkoutLogAndPerformances, type LogExerciseInput } from "@/lib/data/user-data";
import { awardGamificationPoints } from "@/lib/member-gamification-store";
import { localTodayIso } from "@/lib/program-calendar";

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
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
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

  const uid = parsed.data.targetUserId || (await resolveUserId());

  try {
    const result = await createWorkoutLogAndPerformances({
      workoutId,
      userId: uid,
      exercises: parsed.data.exercises as LogExerciseInput[],
      programSlug: parsed.data.programSlug,
      progress: parsed.data.progress,
    });

    let gamification: Awaited<ReturnType<typeof awardGamificationPoints>> | null = null;
    let gamificationWarning: string | null = null;
    try {
      const sessionDate = parsed.data.sessionDate || localTodayIso();
      gamification = await awardGamificationPoints({
        userId: uid,
        eventId: `workout:${workoutId}:${sessionDate}`,
        type: "workout_logged",
        programSlug: parsed.data.programSlug ?? null,
      });
    } catch (gamErr: unknown) {
      gamificationWarning =
        gamErr instanceof Error
          ? gamErr.message
          : "Could not save gamification points — please try again in a moment.";
      console.warn("Workout logged but gamification award failed", gamErr);
    }

    const gamificationPayload = gamification
      ? {
          ...gamification,
          pointsEarned: gamification.pointsEarned,
        }
      : null;

    return NextResponse.json({ ...result, gamification: gamificationPayload, gamificationWarning });
  } catch (e: any) {
    // Preserve previous error behavior for "user not found" / "workout not found" etc.
    if (e?.message?.includes("User not found")) {
      return NextResponse.json({ detail: "User not found" }, { status: 500 });
    }
    if (e?.message?.includes("Workout not found")) {
      return NextResponse.json({ detail: "Workout not found" }, { status: 404 });
    }
    return NextResponse.json(
      { detail: e?.message || "Failed to log workout" },
      { status: 500 }
    );
  }
}
