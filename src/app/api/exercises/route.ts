import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  videoUrl: z.string().max(2000).optional(),
});

export async function GET() {
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
          "Database error saving exercise. Run: npx prisma generate && rm -rf .next && npm run dev",
      },
      { status: 500 },
    );
  }
}