import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCoachStaff } from "@/lib/api-auth";
import { pasteCycleOntoProgramMonth } from "@/lib/workout-cycle-db";

const schema = z.object({
  sourceCycleId: z.string().min(1),
  programId: z.string().optional(),
  programSlug: z.string().optional(),
  cycleMonth: z.number().int().min(1).max(99),
  name: z.string().max(200).optional(),
  /** When true, overwrite existing month content after coach confirmed. */
  force: z.boolean().optional(),
});

/** Paste a library 28-day cycle onto a program month (day-number map, deep clone). */
export async function POST(request: Request) {
  const auth = await requireCoachStaff();
  if (!auth.ok) return auth.response;

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const cycle = await pasteCycleOntoProgramMonth(parsed.data);
    return NextResponse.json(cycle, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Paste failed";
    if (msg === "CONTENT_EXISTS") {
      const summary =
        e instanceof Error && "summary" in e
          ? String((e as Error & { summary?: string }).summary || "")
          : "";
      return NextResponse.json(
        {
          detail: "CONTENT_EXISTS",
          summary:
            summary ||
            "This month already has workouts. Confirm overwrite to replace with a fresh clone.",
          code: "CONTENT_EXISTS",
        },
        { status: 409 },
      );
    }
    const status =
      msg === "PROGRAM_NOT_FOUND" || msg === "CYCLE_NOT_FOUND"
        ? 404
        : msg === "PROGRAM_REQUIRED"
          ? 400
          : 500;
    return NextResponse.json({ detail: msg }, { status });
  }
}
