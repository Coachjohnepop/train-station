import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCoachStaff } from "@/lib/api-auth";
import { snapshotProgramMonthToLibrary } from "@/lib/workout-cycle-db";

const schema = z.object({
  programId: z.string().optional(),
  programSlug: z.string().optional(),
  cycleMonth: z.number().int().min(1).max(99).optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
});

/** Capture a program's 28-day month into the cycle template library (deep clone). */
export async function POST(request: Request) {
  const auth = await requireCoachStaff();
  if (!auth.ok) return auth.response;

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const cycle = await snapshotProgramMonthToLibrary(parsed.data);
    return NextResponse.json(cycle, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Snapshot failed";
    const status =
      msg === "PROGRAM_NOT_FOUND" || msg === "CYCLE_NOT_FOUND"
        ? 404
        : msg === "PROGRAM_REQUIRED"
          ? 400
          : 500;
    return NextResponse.json({ detail: msg }, { status });
  }
}
