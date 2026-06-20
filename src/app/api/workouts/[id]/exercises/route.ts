import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { workoutPrescriptionSchema } from "@/lib/exercise-schema";
import { hydrateDemoExercises, loadDemoExercises } from "@/lib/demo-exercises";
import { getDemoSeed, mutateDemoSeed } from "@/lib/demo-seed-store";

function isDemoMode() {
  const url = process.env.DATABASE_URL ?? "";
  return !url || url.includes("dummy.supabase") || url.includes("dummy");
}

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

  if (isDemoMode()) {
    await hydrateDemoExercises();
    const exList = loadDemoExercises();
    const ex = exList.find((e: any) => e.id === parsed.data.exerciseId);

    let newItem: Record<string, unknown> | null = null;
    await mutateDemoSeed((data) => {
      if (!data.workoutExercises) data.workoutExercises = [];

      const existingForWorkout = data.workoutExercises.filter(
        (we: any) => we.workoutId === workoutId,
      );
      const sortOrder =
        existingForWorkout.length > 0
          ? Math.max(...existingForWorkout.map((we: any) => we.sortOrder ?? 0)) + 1
          : 0;

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
        exercise: ex || { id: parsed.data.exerciseId, name: "Exercise" },
      };
      data.workoutExercises.push(newItem);
    });

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
    await hydrateDemoExercises();
    const exList = loadDemoExercises();

    let updated: Record<string, unknown> | null = null;
    try {
      await mutateDemoSeed((seedData) => {
        if (!seedData.workoutExercises) seedData.workoutExercises = [];

        const weIdx = seedData.workoutExercises.findIndex((we: any) => we.id === itemId);
        if (weIdx === -1) {
          throw new Error("NOT_FOUND");
        }

        const we = { ...seedData.workoutExercises[weIdx] } as any;

        if (data.setScheme !== undefined) we.setScheme = data.setScheme;
        if (data.repPattern !== undefined) we.repPattern = data.repPattern;
        if (data.reps !== undefined) we.reps = data.reps;
        if (data.weightTier !== undefined) we.weightTier = data.weightTier;
        if (data.sets !== undefined) we.sets = data.sets;
        if (data.restSec !== undefined) we.restSec = data.restSec;
        if (data.notes !== undefined) we.notes = data.notes;
        if (data.sortOrder !== undefined) we.sortOrder = data.sortOrder;

        const ex = exList.find((e: any) => e.id === we.exerciseId);
        we.exercise = ex || { id: we.exerciseId, name: "Exercise" };

        seedData.workoutExercises[weIdx] = we;
        updated = we;
      });
    } catch (e) {
      if (e instanceof Error && e.message === "NOT_FOUND") {
        return NextResponse.json({ detail: "Item not found" }, { status: 404 });
      }
      throw e;
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
    await mutateDemoSeed((seedData) => {
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