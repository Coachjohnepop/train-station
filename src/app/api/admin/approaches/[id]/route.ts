import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  label: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().min(1).max(200).optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ detail: "Could not save that approach." }, { status: 400 });
  }
  try {
    const row = await prisma.approach.update({ where: { id }, data: parsed.data });
    return NextResponse.json(row);
  } catch {
    return NextResponse.json({ detail: "Approach not found." }, { status: 404 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const used = await prisma.workoutExercise.count({ where: { approachId: id } });
  if (used > 0) {
    await prisma.approach.update({ where: { id }, data: { active: false } });
    return NextResponse.json({ ok: true, archived: true });
  }
  await prisma.approach.delete({ where: { id } });
  return NextResponse.json({ ok: true, archived: false });
}
