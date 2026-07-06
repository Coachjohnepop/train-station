import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/api-auth";
import { detectUploadTargetFromPaste } from "@/lib/parse-upload-cycle-target";
import {
  buildExercisesFromText,
  buildProgramWeekFromText,
  buildWorkoutFromText,
} from "@/lib/text-upload-build";

const schema = z.object({
  mode: z.enum(["exercises", "workout", "program-week"]),
  rawText: z.string().min(1),
  workoutName: z.string().max(200).optional(),
  programSlug: z.string().optional(),
  weekNumber: z.number().int().positive().optional(),
  cycleId: z.string().optional(),
  cycleDay: z.number().int().min(1).max(28).optional(),
  trainingLocation: z.enum(["gym", "home"]).optional(),
});

export async function POST(request: Request) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }

  const { mode, rawText, workoutName, programSlug, weekNumber } = parsed.data;
  const text = rawText.trim();

  try {
    if (mode === "exercises") {
      const result = await buildExercisesFromText(text);
      return NextResponse.json({ mode, ...result });
    }

    if (mode === "workout") {
      const target = detectUploadTargetFromPaste(workoutName || "", text);
      const cleanName = workoutName?.trim()
        ? target.contentTitle || workoutName
        : target.contentTitle || undefined;
      const result = await buildWorkoutFromText(text, cleanName);
      let cycleSlot: Record<string, unknown> | null = null;
      if (parsed.data.cycleId && parsed.data.cycleDay && result.workoutId) {
        const { updateCycleDaySlot, getWorkoutCycleById } = await import(
          "@/lib/workout-cycle-db"
        );
        const cycle = await getWorkoutCycleById(parsed.data.cycleId);
        await updateCycleDaySlot(parsed.data.cycleId, parsed.data.cycleDay, {
          trainingLocation: parsed.data.trainingLocation ?? "gym",
          workoutId: result.workoutId,
        });
        cycleSlot = {
          cycleDay: parsed.data.cycleDay,
          cycleMonth: cycle?.cycleMonth ?? 1,
          location: parsed.data.trainingLocation ?? "gym",
        };
      }
      return NextResponse.json({ mode, ...result, cycleSlot });
    }

    if (!programSlug || !weekNumber) {
      return NextResponse.json(
        { detail: "programSlug and weekNumber required for program-week mode" },
        { status: 400 },
      );
    }

    const result = await buildProgramWeekFromText(text, programSlug, weekNumber);
    return NextResponse.json({ mode, ...result });
  } catch (e: any) {
    console.error("POST /api/text-upload/build", e);
    return NextResponse.json({ error: e?.message || "Build failed" }, { status: 500 });
  }
}