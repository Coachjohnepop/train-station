import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
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