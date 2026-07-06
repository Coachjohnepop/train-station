import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/api-auth";
import { deployCycleToProgram } from "@/lib/workout-cycle-db";

const deploySchema = z.object({
  programId: z.string().optional(),
  programSlug: z.string().optional(),
  cycleMonth: z.number().int().min(1).max(99),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const parsed = deploySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }

  const { prisma } = await import("@/lib/prisma");
  let programId = parsed.data.programId;
  if (!programId && parsed.data.programSlug) {
    const program = await prisma.program.findUnique({
      where: { slug: parsed.data.programSlug },
      select: { id: true },
    });
    if (!program) {
      return NextResponse.json({ detail: "Program not found" }, { status: 404 });
    }
    programId = program.id;
  }
  if (!programId) {
    return NextResponse.json({ detail: "programId or programSlug required" }, { status: 400 });
  }

  try {
    const cycle = await deployCycleToProgram(id, programId, parsed.data.cycleMonth);
    return NextResponse.json(cycle);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Deploy failed";
    const status =
      msg === "CYCLE_NOT_FOUND" ? 404 : msg === "MONTH_SLOT_TAKEN" ? 409 : 500;
    return NextResponse.json({ detail: msg }, { status });
  }
}