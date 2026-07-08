import { NextResponse } from "next/server";
import { z } from "zod";
import { BLOB_TOKEN } from "@/lib/demo-json-blob";
import { isCoachCatalogDemo } from "@/lib/catalog-mode";
import { cloneWorkout } from "@/lib/clone-workout";
import { requireCoachStaff } from "@/lib/api-auth";

const bodySchema = z.object({
  name: z.string().min(1).max(200).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const auth = await requireCoachStaff();
  if (!auth.ok) return auth.response;

  const { id: sourceWorkoutId } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const cloned = await cloneWorkout(sourceWorkoutId, parsed.data.name);
    if (isCoachCatalogDemo() && process.env.VERCEL && BLOB_TOKEN && cloned.blobSaved === false) {
      return NextResponse.json(
        { detail: "Workout cloned but cloud save failed — retry in a moment." },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { id: cloned.id, name: cloned.name, description: cloned.description },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "WORKOUT_NOT_FOUND") {
      return NextResponse.json({ detail: "Workout not found" }, { status: 404 });
    }
    if (
      error instanceof Error &&
      (error.message === "CLONE_VERIFY_FAILED" ||
        error.message.includes("could not be saved to cloud storage"))
    ) {
      return NextResponse.json(
        { detail: "Workout cloned but cloud save failed — retry in a moment." },
        { status: 503 },
      );
    }
    console.error("POST /api/workouts/[id]/clone", error);
    return NextResponse.json({ detail: "Clone failed" }, { status: 500 });
  }
}