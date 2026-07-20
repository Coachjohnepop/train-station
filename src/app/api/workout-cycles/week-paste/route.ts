import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCoachStaff } from "@/lib/api-auth";
import { pasteWeekPackOntoProgramWeek } from "@/lib/workout-cycle-db";

const schema = z.object({
  sourceCycleId: z.string().min(1),
  programSlug: z.string().min(1),
  targetWeekNumber: z.number().int().min(1).max(52),
  force: z.boolean().optional(),
});

/** Paste a library week pack onto a program calendar week (deep clone). */
export async function POST(request: Request) {
  const auth = await requireCoachStaff();
  if (!auth.ok) return auth.response;

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await pasteWeekPackOntoProgramWeek(parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Week paste failed";
    if (msg === "CONTENT_EXISTS") {
      const summary = (e as Error & { summary?: string }).summary || "Target week has content";
      return NextResponse.json(
        {
          detail: msg,
          needsConfirm: true,
          summary,
          message: `${summary}. Confirm to replace with a fresh clone from the week pack.`,
        },
        { status: 409 },
      );
    }
    const status =
      msg === "PROGRAM_NOT_FOUND" || msg === "WEEK_NOT_FOUND" || msg === "CYCLE_NOT_FOUND"
        ? 404
        : 500;
    return NextResponse.json({ detail: msg }, { status });
  }
}