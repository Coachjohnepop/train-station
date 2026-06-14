import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { workoutPrescriptionSchema } from "@/lib/exercise-schema";
import fs from "fs";
import path from "path";

const SEED_FILE = path.join(process.cwd(), "prisma", "seed-data.json");

// Always re-read the file (no in-memory cache) so that mutations from the builder
// (remove / edit setup) are immediately visible on re-fetch, consistent with other demo loaders.
function loadSeed() {
  return JSON.parse(fs.readFileSync(SEED_FILE, "utf8"));
}

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
    // Demo: actually persist the new workoutExercise into the seed snapshot.
    // This makes Remove/Edit setup work for real seeded workouts when drilled from Programs.
    const data = loadSeed();
    if (!data.workoutExercises) data.workoutExercises = [];

    const ex = (data.exercises || []).find((e: any) => e.id === parsed.data.exerciseId);

    // Compute next sortOrder for this workout (simple, matches real path roughly)
    const existingForWorkout = data.workoutExercises.filter((we: any) => we.workoutId === workoutId);
    const sortOrder = existingForWorkout.length > 0
      ? Math.max(...existingForWorkout.map((we: any) => we.sortOrder ?? 0)) + 1
      : 0;

    const newItem = {
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
    fs.writeFileSync(SEED_FILE, JSON.stringify(data, null, 2));

    return NextResponse.json(newItem, { status: 201 });
  }

  // Real DB path only
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
    const seedData = loadSeed();
    if (!seedData.workoutExercises) seedData.workoutExercises = [];

    const weIdx = seedData.workoutExercises.findIndex((we: any) => we.id === itemId);
    if (weIdx === -1) {
      return NextResponse.json({ detail: "Item not found" }, { status: 404 });
    }

    const we = { ...seedData.workoutExercises[weIdx] };

    // Apply only provided fields (mirrors real Prisma update)
    if (data.setScheme !== undefined) we.setScheme = data.setScheme;
    if (data.repPattern !== undefined) we.repPattern = data.repPattern;
    if (data.reps !== undefined) we.reps = data.reps;
    if (data.weightTier !== undefined) we.weightTier = data.weightTier;
    if (data.sets !== undefined) we.sets = data.sets;
    if (data.restSec !== undefined) we.restSec = data.restSec;
    if (data.notes !== undefined) we.notes = data.notes;
    if (data.sortOrder !== undefined) we.sortOrder = data.sortOrder;

    // Always attach fresh exercise (so name edits from library are reflected)
    const ex = (seedData.exercises || []).find((e: any) => e.id === we.exerciseId);
    we.exercise = ex || { id: we.exerciseId, name: "Exercise" };

    seedData.workoutExercises[weIdx] = we;
    fs.writeFileSync(SEED_FILE, JSON.stringify(seedData, null, 2));

    return NextResponse.json(we);
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
    const seedData = loadSeed();
    if (!seedData.workoutExercises) seedData.workoutExercises = [];

    const before = seedData.workoutExercises.length;
    seedData.workoutExercises = seedData.workoutExercises.filter(
      (we: any) => !(we.id === itemId && we.workoutId === workoutId)
    );

    if (seedData.workoutExercises.length !== before) {
      fs.writeFileSync(SEED_FILE, JSON.stringify(seedData, null, 2));
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