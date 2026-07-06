import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/api-auth";
import { copyWorkoutCycle } from "@/lib/workout-cycle-db";

const copySchema = z.object({
  name: z.string().min(1).max(200),
  programId: z.string().optional().nullable(),
  programSlug: z.string().optional(),
  cycleMonth: z.number().int().min(1).max(99).optional().nullable(),
  deepCloneWorkouts: z.boolean().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const parsed = copySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }

  let programId = parsed.data.programId ?? null;
  if (!programId && parsed.data.programSlug) {
    const { prisma } = await import("@/lib/prisma");
    const program = await prisma.program.findUnique({
      where: { slug: parsed.data.programSlug },
      select: { id: true },
    });
    programId = program?.id ?? null;
  }

  try {
    const cycle = await copyWorkoutCycle(id, {
      name: parsed.data.name,
      programId,
      cycleMonth: parsed.data.cycleMonth ?? null,
      deepCloneWorkouts: parsed.data.deepCloneWorkouts,
    });
    return NextResponse.json(cycle, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Copy failed";
    const status = msg === "CYCLE_NOT_FOUND" ? 404 : 500;
    return NextResponse.json({ detail: msg }, { status });
  }
}