import { NextResponse } from "next/server";
import { z } from "zod";
import { previewWorkoutCatalogMatches } from "@/lib/exercise-catalog-preview";
import { interpretLessonPlan } from "@/lib/lesson-plan-interpreter";
import { buildWorkoutFromParsedSms } from "@/lib/sms-generated-workouts";
import { requireStaff } from "@/lib/api-auth";

const schema = z.object({
  rawText: z.string().min(1),
  includeWarmup: z.boolean().optional(),
  templateMemberName: z.string().optional(),
  answers: z.record(z.string(), z.string()).optional(),
  priorQuestions: z
    .array(
      z.object({
        id: z.string(),
        prompt: z.string(),
        hint: z.string().optional(),
        choices: z.array(z.string()).optional(),
      }),
    )
    .optional(),
  workoutId: z.string().optional(),
});

export async function POST(request: Request) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }

  const interpreted = await interpretLessonPlan(parsed.data);
  if (interpreted.questions.length > 0) {
    return NextResponse.json(
      { error: "Answer quick questions before opening the workout editor." },
      { status: 400 },
    );
  }

  const built = await buildWorkoutFromParsedSms(
    interpreted.workout,
    parsed.data.workoutId,
  );
  const catalogPreview = await previewWorkoutCatalogMatches(interpreted.workout);

  return NextResponse.json({
    workoutId: built.workoutId,
    newExerciseIds: built.newExerciseIds,
    exerciseCount: built.exerciseCount,
    interpretation: interpreted,
    catalogPreview,
  });
}