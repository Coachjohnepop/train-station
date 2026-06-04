import { NextResponse } from "next/server";
import { z } from "zod";
import { assignWorkoutToDay } from "@/lib/program-schedule";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  workoutId: z.string().nullable(),
});

type Params = { params: Promise<{ dayId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { dayId } = await params;
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.workoutId) {
    const workout = await prisma.workout.findUnique({
      where: { id: parsed.data.workoutId },
    });
    if (!workout) {
      return NextResponse.json({ detail: "Workout not found" }, { status: 404 });
    }
  }

  try {
    const day = await assignWorkoutToDay(dayId, parsed.data.workoutId);
    return NextResponse.json(day);
  } catch {
    return NextResponse.json({ detail: "Day not found" }, { status: 404 });
  }
}