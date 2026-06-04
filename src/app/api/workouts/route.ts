import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
});

export async function GET() {
  const workouts = await prisma.workout.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { exercises: true } },
    },
  });
  return NextResponse.json(workouts);
}

export async function POST(request: Request) {
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }
  const workout = await prisma.workout.create({
    data: {
      name: parsed.data.name.trim(),
      description: parsed.data.description?.trim() || null,
    },
  });
  return NextResponse.json(workout, { status: 201 });
}