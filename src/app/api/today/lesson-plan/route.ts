import { NextResponse } from "next/server";
import { z } from "zod";
import { previewWorkoutCatalogMatches } from "@/lib/exercise-catalog-preview";
import { interpretLessonPlan } from "@/lib/lesson-plan-interpreter";
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
});

export async function POST(request: Request) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }

  const result = await interpretLessonPlan(parsed.data);
  const catalogPreview = await previewWorkoutCatalogMatches(result.workout);
  return NextResponse.json({ ...result, catalogPreview });
}