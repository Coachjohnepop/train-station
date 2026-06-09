import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";

const SEED_FILE = path.join(process.cwd(), "prisma", "seed-data.json");
let seedCache: any = null;
function loadSeed() {
  if (!seedCache) {
    seedCache = JSON.parse(fs.readFileSync(SEED_FILE, "utf8"));
  }
  return seedCache;
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
      return NextResponse.json({ detail: "Workout not found" }, { status: 404 });
    }
    const items = (data.workoutExercises || [])
      .filter((we: any) => we.workoutId === id)
      .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((we: any) => {
        const ex = (data.exercises || []).find((e: any) => e.id === we.exerciseId);
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