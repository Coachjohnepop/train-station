import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/api-auth";
import { createWorkoutCycle, listWorkoutCycles } from "@/lib/workout-cycle-db";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  programId: z.string().optional().nullable(),
  programSlug: z.string().optional(),
  cycleMonth: z.number().int().min(1).max(99).optional().nullable(),
});

export async function GET(request: Request) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const programSlug = url.searchParams.get("program") || url.searchParams.get("programSlug") || undefined;
  const libraryOnly = url.searchParams.get("library") === "1";
  const archiveParam = url.searchParams.get("archive");
  const archive =
    archiveParam === "archived" || archiveParam === "all" || archiveParam === "active"
      ? archiveParam
      : "active";

  const cycles = await listWorkoutCycles({ programSlug, libraryOnly, archive });
  return NextResponse.json(cycles);
}

export async function POST(request: Request) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;

  const parsed = createSchema.safeParse(await request.json());
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
    const cycle = await createWorkoutCycle({
      name: parsed.data.name,
      description: parsed.data.description,
      programId,
      cycleMonth: parsed.data.cycleMonth ?? null,
    });
    return NextResponse.json(cycle, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Create failed";
    return NextResponse.json({ detail: msg }, { status: 500 });
  }
}