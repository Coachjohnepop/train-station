import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";
import {
  isDemoMode,
  loadDemoExercises,
  saveDemoExercises,
} from "@/lib/demo-exercises";

const SEED_FILE = path.join(process.cwd(), "prisma", "seed-data.json");

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  videoUrl: z.string().max(2000).optional().nullable(),
  tags: z.string().optional().nullable(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }

  const data: {
    name?: string;
    description?: string | null;
    videoUrl?: string | null;
    tags?: string | null;
  } = {};

  if (parsed.data.name !== undefined) data.name = parsed.data.name.trim();
  if (parsed.data.description !== undefined) {
    data.description = parsed.data.description?.trim() || null;
  }
  if (parsed.data.videoUrl !== undefined) {
    data.videoUrl = parsed.data.videoUrl?.trim() || null;
  }
  if (parsed.data.tags !== undefined) {
    data.tags = parsed.data.tags?.trim() || null;
  }

  if (isDemoMode()) {
    const list = loadDemoExercises();
    const idx = list.findIndex((e: any) => e.id === id);
    if (idx === -1) {
      return NextResponse.json({ detail: "Exercise not found" }, { status: 404 });
    }
    const ex = { ...list[idx] };
    if (data.name !== undefined) ex.name = data.name;
    if (data.description !== undefined) ex.description = data.description;
    if (data.videoUrl !== undefined) ex.videoUrl = data.videoUrl;
    if (data.tags !== undefined) ex.tags = data.tags;
    ex.updatedAt = new Date().toISOString();
    list[idx] = ex;
    saveDemoExercises(list);
    return NextResponse.json(ex);
  }

  try {
    const exercise = await prisma.exercise.update({
      where: { id },
      data,
    });
    return NextResponse.json(exercise);
  } catch {
    return NextResponse.json({ detail: "Exercise not found" }, { status: 404 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  if (isDemoMode()) {
    const list = loadDemoExercises();
    const idx = list.findIndex((e: any) => e.id === id);
    if (idx === -1) {
      return NextResponse.json({ detail: "Exercise not found" }, { status: 404 });
    }
    list.splice(idx, 1);
    saveDemoExercises(list);

    // Clean references: remove any workoutExercise entries that pointed to this exercise.
    // This ensures the exercise truly disappears from scheduled workouts (no more "Unknown" rows).
    // Matches the transcript complaint where deletes left things behind and editing felt broken.
    try {
      const seed = JSON.parse(fs.readFileSync(SEED_FILE, "utf8"));
      if (seed.workoutExercises) {
        const before = seed.workoutExercises.length;
        seed.workoutExercises = seed.workoutExercises.filter((we: any) => we.exerciseId !== id);
        if (seed.workoutExercises.length !== before) {
          fs.writeFileSync(SEED_FILE, JSON.stringify(seed, null, 2));
        }
      }
    } catch (e) {
      console.error("Failed to prune workoutExercises after exercise delete", e);
    }

    return new NextResponse(null, { status: 204 });
  }
  try {
    await prisma.exercise.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ detail: "Exercise not found" }, { status: 404 });
  }
}