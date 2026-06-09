import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  isDemoMode,
  loadDemoExercises,
  saveDemoExercises,
  createDemoExerciseId,
} from "@/lib/demo-exercises";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  videoUrl: z.string().max(2000).optional(),
});

export async function GET() {
  if (isDemoMode()) {
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
  const { name, description, videoUrl } = parsed.data;

  if (isDemoMode()) {
    const list = loadDemoExercises();
    const exercise = {
      id: createDemoExerciseId(),
      name: name.trim(),
      description: description?.trim() || null,
      videoUrl: videoUrl?.trim() || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      defaultSetScheme: null,
      defaultSets: null,
      defaultWeightTier: null,
      tags: null,
    };
    list.push(exercise);
    saveDemoExercises(list);
    return NextResponse.json(exercise, { status: 201 });
  }

  try {
    const exercise = await prisma.exercise.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        videoUrl: videoUrl?.trim() || null,
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