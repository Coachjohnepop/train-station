import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { workoutPrescriptionSchema } from "@/lib/exercise-schema";

const addSchema = workoutPrescriptionSchema.extend({
  exerciseId: z.string().min(1),
});

const updateItemSchema = z.object({
  itemId: z.string().min(1),
  setScheme: workoutPrescriptionSchema.shape.setScheme.optional(),
  repPattern: workoutPrescriptionSchema.shape.repPattern.optional().nullable(),
  reps: workoutPrescriptionSchema.shape.reps.optional().nullable(),
  weightTier: workoutPrescriptionSchema.shape.weightTier.optional(),
  sets: workoutPrescriptionSchema.shape.sets.optional().nullable(),
  restSec: z.number().int().nonnegative().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  sortOrder: z.number().int().nonnegative().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id: workoutId } = await params;
  const parsed = addSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }

  const maxOrder = await prisma.workoutExercise.aggregate({
    where: { workoutId },
    _max: { sortOrder: true },
  });
  const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;

  const exercise = await prisma.exercise.findUnique({
    where: { id: parsed.data.exerciseId },
    select: { id: true },
  });
  if (!exercise) {
    return NextResponse.json({ detail: "Exercise not found" }, { status: 404 });
  }

  const workout = await prisma.workout.findUnique({
    where: { id: workoutId },
    select: { id: true },
  });
  if (!workout) {
    return NextResponse.json({ detail: "Workout not found" }, { status: 404 });
  }

  try {
    const item = await prisma.workoutExercise.create({
      data: {
        workoutId,
        exerciseId: parsed.data.exerciseId,
        sortOrder,
        setScheme: parsed.data.setScheme,
        repPattern: parsed.data.repPattern ?? null,
        reps: parsed.data.reps ?? null,
        weightTier: parsed.data.weightTier,
        sets: parsed.data.sets,
        restSec: parsed.data.restSec ?? null,
        notes: parsed.data.notes ?? null,
      },
      include: { exercise: true },
    });
    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    console.error("workoutExercise.create failed:", err);
    const message =
      err instanceof Error ? err.message : "Could not save exercise";
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Params) {
  await params;
  const parsed = updateItemSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }
  const { itemId, ...data } = parsed.data;
  try {
    const item = await prisma.workoutExercise.update({
      where: { id: itemId },
      data,
      include: { exercise: true },
    });
    return NextResponse.json(item);
  } catch (err) {
    console.error("workoutExercise.update failed:", err);
    const message =
      err instanceof Error ? err.message : "Could not update exercise";
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const { id: workoutId } = await params;
  const url = new URL(request.url);
  let itemId = url.searchParams.get("itemId") ?? undefined;

  if (!itemId) {
    try {
      const body = (await request.json()) as { itemId?: string };
      itemId = body.itemId;
    } catch {
      /* no JSON body */
    }
  }

  if (!itemId) {
    return NextResponse.json({ detail: "itemId required" }, { status: 400 });
  }

  const existing = await prisma.workoutExercise.findFirst({
    where: { id: itemId, workoutId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ detail: "Item not found" }, { status: 404 });
  }

  await prisma.workoutExercise.delete({ where: { id: itemId } });
  return new NextResponse(null, { status: 204 });
}