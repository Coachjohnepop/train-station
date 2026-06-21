import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { workoutPrescriptionSchema } from "@/lib/exercise-schema";
import { hydrateDemoExercises, loadDemoExercises } from "@/lib/demo-exercises";
import { BLOB_TOKEN } from "@/lib/demo-json-blob";
import { mutateDemoSeed } from "@/lib/demo-seed-store";
import { ensureDemoWorkoutInSeed, resolveDemoExercise } from "@/lib/demo-workout-items";

function isDemoMode() {
  const url = process.env.DATABASE_URL ?? "";
  return !url || url.includes("dummy.supabase") || url.includes("dummy");
}

const addSchema = workoutPrescriptionSchema.extend({
  exerciseId: z.string().min(1),
});

const updateItemSchema = z.object({
  itemId: z.string().min(1),
  exerciseId: z.string().min(1).optional(),
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

  if (isDemoMode()) {
    await hydrateDemoExercises({ preferFresh: true });
    const exList = loadDemoExercises();
    const ex = exList.find((e: any) => e.id === parsed.data.exerciseId);

    let newItem: Record<string, unknown> | null = null;
    const { blobSaved } = await mutateDemoSeed((data) => {
      if (!data.workouts) data.workouts = [];
      data.workouts = ensureDemoWorkoutInSeed(data.workouts as any[], workoutId);
      if (!data.workoutExercises) data.workoutExercises = [];

      const existingForWorkout = data.workoutExercises.filter(
        (we: any) => we.workoutId === workoutId,
      );
      const sortOrder =
        existingForWorkout.length > 0
          ? Math.max(...existingForWorkout.map((we: any) => we.sortOrder ?? 0)) + 1
          : 0;

      const exercise = resolveDemoExercise(parsed.data.exerciseId, exList);
      newItem = {
        id: "demo-we-" + Date.now(),
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
        exercise,
      };
      data.workoutExercises.push(newItem);
    });
    if (process.env.VERCEL && BLOB_TOKEN && !blobSaved) {
      return NextResponse.json(
        { detail: "Exercise added but cloud save failed — retry in a moment." },
        { status: 503 },
      );
    }

    return NextResponse.json(newItem, { status: 201 });
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
  if (isDemoMode()) {
    await hydrateDemoExercises({ preferFresh: true });
    const exList = loadDemoExercises();

    let updated: Record<string, unknown> | null = null;
    let notFound = false;
    const { blobSaved } = await mutateDemoSeed((seedData) => {
      if (!seedData.workoutExercises) seedData.workoutExercises = [];

      const weIdx = seedData.workoutExercises.findIndex((we: any) => we.id === itemId);
      if (weIdx === -1) {
        notFound = true;
        return;
      }

      const we = { ...seedData.workoutExercises[weIdx] } as any;

      if (data.exerciseId !== undefined) {
        const ex = exList.find((e: any) => e.id === data.exerciseId);
        if (!ex) {
          notFound = true;
          return;
        }
        we.exerciseId = data.exerciseId;
      }
      if (data.setScheme !== undefined) we.setScheme = data.setScheme;
      if (data.repPattern !== undefined) we.repPattern = data.repPattern;
      if (data.reps !== undefined) we.reps = data.reps;
      if (data.weightTier !== undefined) we.weightTier = data.weightTier;
      if (data.sets !== undefined) we.sets = data.sets;
      if (data.restSec !== undefined) we.restSec = data.restSec;
      if (data.notes !== undefined) we.notes = data.notes;
      if (data.sortOrder !== undefined) we.sortOrder = data.sortOrder;

      we.exercise = resolveDemoExercise(we.exerciseId, exList);

      seedData.workoutExercises[weIdx] = we;
      updated = we;
    });

    if (notFound) {
      return NextResponse.json({ detail: "Item not found" }, { status: 404 });
    }
    if (process.env.VERCEL && BLOB_TOKEN && !blobSaved) {
      return NextResponse.json(
        { detail: "Update applied but cloud save failed — retry in a moment." },
        { status: 503 },
      );
    }

    return NextResponse.json(updated);
  }
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

  if (isDemoMode()) {
    let removed = false;
    const { blobSaved } = await mutateDemoSeed((seedData) => {
      if (!seedData.workoutExercises) seedData.workoutExercises = [];
      const before = seedData.workoutExercises.length;
      seedData.workoutExercises = seedData.workoutExercises.filter(
        (we: any) => !(we.id === itemId && we.workoutId === workoutId),
      );
      removed = seedData.workoutExercises.length !== before;
    });
    if (!removed) {
      return NextResponse.json({ detail: "Item not found" }, { status: 404 });
    }
    if (process.env.VERCEL && BLOB_TOKEN && !blobSaved) {
      return NextResponse.json(
        { detail: "Remove applied but cloud save failed — retry in a moment." },
        { status: 503 },
      );
    }
    return new NextResponse(null, { status: 204 });
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