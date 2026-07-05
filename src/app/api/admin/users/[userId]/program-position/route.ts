import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCoachStaff } from "@/lib/api-auth";
import {
  getUserProgramPositions,
  setUserProgramPosition,
} from "@/lib/data/user-data";


type Params = { params: Promise<{ userId: string }> };

const patchSchema = z.object({
  programSlug: z.string().min(1),
  currentPhase: z.number().int().min(1).max(12).optional(),
  currentWeek: z.number().int().min(1).max(52),
  currentDay: z.number().int().min(1).max(7),
  trainingLocation: z.enum(["gym", "home"]).optional(),
});

export async function GET(request: Request, { params }: Params) {
  const auth = await requireCoachStaff();
  if (!auth.ok) return auth.response;

  const { userId } = await params;
  const programSlug = new URL(request.url).searchParams.get("programSlug") || undefined;

  const positions = await getUserProgramPositions(userId);
  if (programSlug) {
    const match = positions.find((p) => p.programSlug === programSlug);
    if (!match) {
      return NextResponse.json({ detail: "Not enrolled in program" }, { status: 404 });
    }
    return NextResponse.json(match);
  }

  return NextResponse.json({ positions });
}

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireCoachStaff();
  if (!auth.ok) return auth.response;

  const { userId } = await params;
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await setUserProgramPosition(
      userId,
      parsed.data.programSlug,
      parsed.data.currentWeek,
      parsed.data.currentDay,
      {
        currentPhase: parsed.data.currentPhase,
        trainingLocation: parsed.data.trainingLocation,
      },
    );

    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Update failed";
    if (message === "Program not found") {
      return NextResponse.json({ detail: message }, { status: 404 });
    }
    console.error("PATCH program-position", e);
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}