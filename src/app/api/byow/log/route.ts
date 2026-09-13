import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { canAccessByowAdmin, canUseByowUpload } from "@/lib/byow-access";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const schema = z.object({
  workoutId: z.string().min(1),
  startedAt: z.string().datetime().optional().nullable(),
  progress: z.number().int().min(0).max(100).optional(),
  exerciseNames: z.array(z.string()).optional(),
});

export async function POST(request: Request) {
  const session = await getSessionUser();
  if (!session || !canUseByowUpload(session)) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "workoutId required." }, { status: 400 });
  }

  const workout = await prisma.byowWorkout.findUnique({
    where: { id: parsed.data.workoutId },
    include: {
      exercises: { include: { exercise: { select: { name: true } } } },
    },
  });
  if (!workout) {
    return NextResponse.json({ error: "Workout not found." }, { status: 404 });
  }
  if (workout.ownerUserId !== session.id && !canAccessByowAdmin(session)) {
    return NextResponse.json({ error: "Not your workout." }, { status: 403 });
  }

  const names =
    parsed.data.exerciseNames?.filter(Boolean) ||
    workout.exercises.map((e) => e.exercise.name);
  const completedAt = new Date();
  let startedAt: Date | null = null;
  if (parsed.data.startedAt) {
    const d = new Date(parsed.data.startedAt);
    if (!Number.isNaN(d.getTime())) startedAt = d;
  }
  let durationSec: number | null = null;
  if (startedAt) {
    durationSec = Math.max(60, Math.round((completedAt.getTime() - startedAt.getTime()) / 1000));
  } else {
    durationSec = Math.max(20 * 60, names.length * 6 * 60);
  }

  const log = await prisma.byowWorkoutLog.create({
    data: {
      userId: session.id,
      workoutId: workout.id,
      startedAt,
      completedAt,
      durationSec,
      progress: parsed.data.progress ?? 100,
      exerciseNames: names.join("|"),
    },
  });

  return NextResponse.json({ ok: true, logId: log.id, durationSec });
}
