import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCoachStaff } from "@/lib/api-auth";
import { updateMaintainWorkoutMeta } from "@/lib/member-maintain-workouts";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  muscleGroup: z.string().max(120).optional(),
  blurb: z.string().max(400).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Params) {
  const auth = await requireCoachStaff();
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  const parsed = patchSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid update.", detail: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const workout = await updateMaintainWorkoutMeta(id, parsed.data);
  if (!workout) {
    return NextResponse.json({ error: "Quick maintain workout not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, workout });
}
