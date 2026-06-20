import { NextResponse } from "next/server";
import { z } from "zod";
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
});

export async function POST(request: Request) {
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
      const result = await buildWorkoutFromText(text, workoutName);
      return NextResponse.json({ mode, ...result });
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