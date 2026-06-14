import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";
import { loadDemoExercises } from "@/lib/demo-exercises";

const SEED_FILE = path.join(process.cwd(), "prisma", "seed-data.json");

// Always re-read the file in demo mode. This ensures that when admin exercise
// mutations (via saveDemoExercises) write updates back into seed-data.json,
// subsequent requests (e.g. loading a workout to see the new exercise names)
// pick up the change in the same dev server process without requiring a restart.
function loadSeed() {
  return JSON.parse(fs.readFileSync(SEED_FILE, "utf8"));
}
function isDemoMode() {
  const url = process.env.DATABASE_URL ?? "";
  return !url || url.includes("dummy.supabase") || url.includes("dummy");
}

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  if (isDemoMode()) {
    const data = loadSeed();
    const w = (data.workouts || []).find((ww: any) => ww.id === id);
    if (!w) {
      // Support newly created workouts (unique IDs from POST in demo)
      return NextResponse.json({ id, name: "New Workout", description: null, exercises: [] });
    }

    // Use loadDemoExercises() so that names edited (and saved) via the Exercise Library
    // are immediately visible here. The library updates exercises.dev.json (and now also
    // syncs seed-data.json), and this lookup now pulls from the live demo list.
    const exList = loadDemoExercises();

    const items = (data.workoutExercises || [])
      .filter((we: any) => we.workoutId === id)
      .sort((a: any, b: any) => {
        const aEx = exList.find((e: any) => e.id === a.exerciseId);
        const bEx = exList.find((e: any) => e.id === b.exerciseId);
        const aIsWarm = /warm/i.test(aEx?.name || "");
        const bIsWarm = /warm/i.test(bEx?.name || "");
        if (aIsWarm && !bIsWarm) return -1;
        if (!aIsWarm && bIsWarm) return 1;
        return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
      })
      .map((we: any) => {
        const ex = exList.find((e: any) => e.id === we.exerciseId);
        return {
          id: we.id,
          sortOrder: we.sortOrder,
          setScheme: we.setScheme,
          repPattern: we.repPattern,
          reps: we.reps,
          sets: we.sets,
          weightTier: we.weightTier,
          notes: we.notes,
          exercise: ex || { id: we.exerciseId, name: "Unknown" },
        };
      });
    return NextResponse.json({ ...w, exercises: items });
  }
  const workout = await prisma.workout.findUnique({
    where: { id },
    include: {
      exercises: {
        orderBy: { sortOrder: "asc" },
        include: { exercise: true },
      },
    },
  });
  if (!workout) {
    return NextResponse.json({ detail: "Workout not found" }, { status: 404 });
  }
  return NextResponse.json(workout);
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const workout = await prisma.workout.update({
      where: { id },
      data: parsed.data,
    });
    return NextResponse.json(workout);
  } catch {
    return NextResponse.json({ detail: "Workout not found" }, { status: 404 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  try {
    await prisma.workout.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ detail: "Workout not found" }, { status: 404 });
  }
}