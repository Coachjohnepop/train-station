import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  isDemoMode,
  hydrateDemoExercises,
  loadDemoExercises,
  saveDemoExercises,
  createDemoExerciseId,
} from "@/lib/demo-exercises";
import { BLOB_TOKEN } from "@/lib/demo-json-blob";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  videoUrl: z.string().max(2000).optional(),
  tags: z.string().optional(),
});

export async function GET() {
  if (isDemoMode()) {
    await hydrateDemoExercises();
    const exercises = loadDemoExercises();
    return NextResponse.json(exercises);
  }
  const exercises = await prisma.exercise.findMany({
    orderBy: { name: "asc" },
  });
  return NextResponse.json(exercises);
}

export async function POST(request: Request) {
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }
  const { name, description, videoUrl, tags } = parsed.data;

  if (isDemoMode()) {
    await hydrateDemoExercises();
    const list = loadDemoExercises();
    const exercise = {
      id: createDemoExerciseId(),
      name: name.trim(),
      description: description?.trim() || null,
      videoUrl: videoUrl?.trim() || null,
      tags: tags?.trim() || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      defaultSetScheme: null,
      defaultSets: null,
      defaultWeightTier: null,
    };
    list.push(exercise);
    const { blobSaved } = await saveDemoExercises(list);
    if (process.env.VERCEL && BLOB_TOKEN && !blobSaved) {
      return NextResponse.json(
        { detail: "Exercise created but cloud save failed — retry in a moment." },
        { status: 503 },
      );
    }
    return NextResponse.json(exercise, { status: 201 });
  }

  try {
    const exercise = await prisma.exercise.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        videoUrl: videoUrl?.trim() || null,
        tags: tags?.trim() || null,
      },
    });
    return NextResponse.json(exercise, { status: 201 });
  } catch (err) {
    console.error("POST /api/exercises", err);
    return NextResponse.json(
      {
        detail:
          "Database error saving exercise. Check DATABASE_URL in .env (or paste your real Supabase connection strings).",
      },
      { status: 500 },
    );
  }
}