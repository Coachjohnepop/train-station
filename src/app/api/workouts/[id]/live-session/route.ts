import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveUserId } from "@/lib/current-user";
import {
  clearLiveWorkoutSession,
  getLiveWorkoutSession,
  upsertLiveWorkoutSession,
} from "@/lib/live-workout-session";

const putSchema = z.object({
  userId: z.string().min(1),
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  completedSets: z.record(z.string(), z.array(z.number().int().positive())),
  finishedExercises: z.array(z.string()),
  weights: z.record(z.string(), z.string()).optional().default({}),
  activeId: z.string().optional(),
  updatedBy: z.enum(["coach", "member"]),
  clear: z.boolean().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const { id: workoutId } = await params;
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId") || (await resolveUserId());
  const sessionDate = searchParams.get("date") || undefined;

  const session = await getLiveWorkoutSession({
    userId,
    workoutId,
    sessionDate,
  });

  return NextResponse.json({ session, userId, workoutId });
}

export async function PUT(request: Request, { params }: Params) {
  const { id: workoutId } = await params;
  const parsed = putSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  if (data.clear) {
    await clearLiveWorkoutSession({
      userId: data.userId,
      workoutId,
      sessionDate: data.sessionDate,
    });
    return NextResponse.json({ ok: true, cleared: true });
  }

  const result = await upsertLiveWorkoutSession({
    userId: data.userId,
    workoutId,
    sessionDate: data.sessionDate,
    completedSets: data.completedSets,
    finishedExercises: data.finishedExercises,
    weights: data.weights,
    activeId: data.activeId,
    updatedBy: data.updatedBy,
  });

  return NextResponse.json({
    ok: true,
    session: result.session,
    blobSaved: result.blobSaved,
  });
}