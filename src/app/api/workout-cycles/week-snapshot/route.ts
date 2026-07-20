import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCoachStaff } from "@/lib/api-auth";
import { snapshotProgramWeekToLibrary } from "@/lib/workout-cycle-db";

const schema = z.object({
  programSlug: z.string().min(1),
  weekNumber: z.number().int().min(1).max(52),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
});

/** Save the open program calendar week (Mon–Sun) into the template library as a week pack. */
export async function POST(request: Request) {
  const auth = await requireCoachStaff();
  if (!auth.ok) return auth.response;

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const cycle = await snapshotProgramWeekToLibrary(parsed.data);
    return NextResponse.json(cycle, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Week snapshot failed";
    const status =
      msg === "PROGRAM_NOT_FOUND" || msg === "WEEK_NOT_FOUND"
        ? 404
        : msg === "WEEK_EMPTY"
          ? 400
          : 500;
    return NextResponse.json(
      {
        detail: msg,
        message:
          msg === "WEEK_EMPTY"
            ? "This week has no Gym/Home workouts to save. Add content first."
            : msg,
      },
      { status },
    );
  }
}
