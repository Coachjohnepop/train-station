import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCoachStaff } from "@/lib/api-auth";
import {
  createEmptyMaintainWorkout,
  listAdminMaintainWorkouts,
} from "@/lib/member-maintain-workouts";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  muscleGroup: z.string().max(120).optional(),
  blurb: z.string().max(400).optional(),
});

export async function GET() {
  const auth = await requireCoachStaff();
  if (!auth.ok) return auth.response;
  const workouts = await listAdminMaintainWorkouts();
  return NextResponse.json({ ok: true, workouts });
}

export async function POST(request: Request) {
  const auth = await requireCoachStaff();
  if (!auth.ok) return auth.response;
  const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Name is required.", detail: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const id = await createEmptyMaintainWorkout(parsed.data);
  return NextResponse.json({ ok: true, id });
}
