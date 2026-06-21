import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  isDemoMode,
  hydrateDemoExercises,
  loadDemoExercises,
  saveDemoExercises,
} from "@/lib/demo-exercises";
import { mutateDemoSeed } from "@/lib/demo-seed-store";
import { BLOB_TOKEN } from "@/lib/demo-json-blob";

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
    await hydrateDemoExercises();
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
    const { exercisesBlobSaved, seedBlobSaved } = await saveDemoExercises(list);
    if (process.env.VERCEL && BLOB_TOKEN && (!exercisesBlobSaved || !seedBlobSaved)) {
      return NextResponse.json(
        { detail: "Update applied but cloud save failed — retry in a moment." },
        { status: 503 },
      );
    }
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
    await hydrateDemoExercises();
    const list = loadDemoExercises();
    const idx = list.findIndex((e: any) => e.id === id);
    if (idx === -1) {
      return NextResponse.json({ detail: "Exercise not found" }, { status: 404 });
    }
    list.splice(idx, 1);
    const { exercisesBlobSaved, seedBlobSaved } = await saveDemoExercises(list);

    const { blobSaved: workoutRefsBlobSaved } = await mutateDemoSeed((seed) => {
      if (seed.workoutExercises) {
        seed.workoutExercises = seed.workoutExercises.filter(
          (we: any) => we.exerciseId !== id,
        );
      }
    });

    if (
      process.env.VERCEL &&
      BLOB_TOKEN &&
      (!exercisesBlobSaved || !seedBlobSaved || !workoutRefsBlobSaved)
    ) {
      return NextResponse.json(
        { detail: "Delete applied but cloud save failed — retry in a moment." },
        { status: 503 },
      );
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