import { NextResponse } from "next/server";
import { z } from "zod";
import { isCoachCatalogDemo } from "@/lib/catalog-mode";
import { prisma } from "@/lib/prisma";
import { workoutPrescriptionSchema } from "@/lib/exercise-schema";
import { hydrateDemoExercises, loadDemoExercises } from "@/lib/demo-exercises";
import { BLOB_TOKEN } from "@/lib/demo-json-blob";
import { getDemoSeed, mutateDemoSeed } from "@/lib/demo-seed-store";
import { requireBlobPersisted } from "@/lib/demo-persistence";
import { requireStaff } from "@/lib/api-auth";
import {
  compactDemoWorkoutSortOrders,
  ensureDemoWorkoutInSeed,
  resolveDemoExercise,
} from "@/lib/demo-workout-items";
import {
  addSmsWorkoutExercise,
  deleteSmsWorkoutExercise,
  isSmsWorkoutId,
  patchSmsWorkoutExercise,
} from "@/lib/sms-workout-builder-api";

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
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;

  const { id: workoutId } = await params;
  const parsed = addSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }

  if (isSmsWorkoutId(workoutId)) {
    const item = await addSmsWorkoutExercise(workoutId, parsed.data);
    if (!item) {
      return NextResponse.json({ detail: "Workout or exercise not found" }, { status: 404 });
    }
    return NextResponse.json(item, { status: 201 });
  }

  if (isCoachCatalogDemo()) {
    await hydrateDemoExercises({ preferFresh: true });
    const exList = loadDemoExercises();
    const ex = exList.find((e: any) => e.id === parsed.data.exerciseId);

    let newItem: Record<string, unknown> | null = null;
    try {
      for (let attempt = 0; attempt < 4; attempt++) {
        newItem = null;
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
        requireBlobPersisted(blobSaved, "Exercise add");

        const seed = await getDemoSeed({ preferFresh: Boolean(BLOB_TOKEN) });
        const persisted = ((seed.workoutExercises as any[]) || []).some(
          (we) => we.id === newItem?.id && we.workoutId === workoutId,
        );
        if (persisted) {
          return NextResponse.json(newItem, { status: 201 });
        }
        await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
      }
      return NextResponse.json(
        { detail: "Exercise added but cloud save failed — retry in a moment." },
        { status: 503 },
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Exercise add failed";
      return NextResponse.json({ detail: msg }, { status: 503 });
    }
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

function demoItemMatchesPatch(we: any, data: Record<string, unknown>): boolean {
  if (data.exerciseId !== undefined && we.exerciseId !== data.exerciseId) return false;
  if (data.setScheme !== undefined && we.setScheme !== data.setScheme) return false;
  if (data.repPattern !== undefined && we.repPattern !== data.repPattern) return false;
  if (data.reps !== undefined && we.reps !== data.reps) return false;
  if (data.weightTier !== undefined && we.weightTier !== data.weightTier) return false;
  if (data.sets !== undefined && we.sets !== data.sets) return false;
  if (data.restSec !== undefined && we.restSec !== data.restSec) return false;
  if (data.notes !== undefined && we.notes !== data.notes) return false;
  if (data.sortOrder !== undefined && we.sortOrder !== data.sortOrder) return false;
  return true;
}

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;

  const { id: workoutId } = await params;
  const parsed = updateItemSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }
  const { itemId, ...data } = parsed.data;
  if (isSmsWorkoutId(workoutId)) {
    const item = await patchSmsWorkoutExercise(workoutId, itemId, data);
    if (!item) {
      return NextResponse.json({ detail: "Item not found" }, { status: 404 });
    }
    return NextResponse.json(item);
  }
  if (isCoachCatalogDemo()) {
    await hydrateDemoExercises({ preferFresh: true });
    const exList = loadDemoExercises();

    try {
      for (let attempt = 0; attempt < 4; attempt++) {
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
        requireBlobPersisted(blobSaved, "Exercise update");

        const seed = await getDemoSeed({ preferFresh: Boolean(BLOB_TOKEN) });
        const persisted = ((seed.workoutExercises as any[]) || []).find(
          (we) => we.id === itemId && we.workoutId === workoutId,
        );
        if (persisted && demoItemMatchesPatch(persisted, data)) {
          return NextResponse.json({
            ...persisted,
            exercise: resolveDemoExercise(persisted.exerciseId, exList),
          });
        }
        await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
      }
      return NextResponse.json(
        { detail: "Exercise update could not be verified — retry in a moment." },
        { status: 503 },
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Exercise update failed";
      return NextResponse.json({ detail: msg }, { status: 503 });
    }
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
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;

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

  if (isSmsWorkoutId(workoutId)) {
    const ok = await deleteSmsWorkoutExercise(workoutId, itemId);
    if (!ok) {
      return NextResponse.json({ detail: "Item not found" }, { status: 404 });
    }
    return new NextResponse(null, { status: 204 });
  }

  if (isCoachCatalogDemo()) {
    try {
      for (let attempt = 0; attempt < 4; attempt++) {
        let removed = false;
        const { blobSaved } = await mutateDemoSeed((seedData) => {
          if (!seedData.workoutExercises) seedData.workoutExercises = [];
          const before = seedData.workoutExercises.length;
          seedData.workoutExercises = seedData.workoutExercises.filter(
            (we: any) => !(we.id === itemId && we.workoutId === workoutId),
          );
          removed = seedData.workoutExercises.length !== before;
          if (removed) {
            seedData.workoutExercises = compactDemoWorkoutSortOrders(
              seedData.workoutExercises as any[],
              workoutId,
            );
          }
        });
        if (!removed) {
          return NextResponse.json({ detail: "Item not found" }, { status: 404 });
        }
        requireBlobPersisted(blobSaved, "Exercise remove");

        const seed = await getDemoSeed({ preferFresh: Boolean(BLOB_TOKEN) });
        const stillThere = ((seed.workoutExercises as any[]) || []).some(
          (we) => we.id === itemId && we.workoutId === workoutId,
        );
        if (!stillThere) {
          return new NextResponse(null, { status: 204 });
        }
        await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
      }
      return NextResponse.json(
        { detail: "Remove could not be verified — retry in a moment." },
        { status: 503 },
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Exercise remove failed";
      return NextResponse.json({ detail: msg }, { status: 503 });
    }
  }

  const existing = await prisma.workoutExercise.findFirst({
    where: { id: itemId, workoutId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ detail: "Item not found" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.workoutExercise.delete({ where: { id: itemId } });
    const remaining = await tx.workoutExercise.findMany({
      where: { workoutId },
      orderBy: { sortOrder: "asc" },
      select: { id: true },
    });
    await Promise.all(
      remaining.map((row, idx) =>
        tx.workoutExercise.update({
          where: { id: row.id },
          data: { sortOrder: idx },
        }),
      ),
    );
  });
  return new NextResponse(null, { status: 204 });
}
