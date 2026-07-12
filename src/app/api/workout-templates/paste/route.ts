import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCoachStaff } from "@/lib/api-auth";
import { pasteWorkoutOntoProgramDay } from "@/lib/workout-templates";
import { prisma } from "@/lib/prisma";
import { isCoachCatalogDemo } from "@/lib/catalog-mode";

const pasteSchema = z.object({
  /** Template library id OR raw workout id */
  templateId: z.string().optional(),
  sourceWorkoutId: z.string().optional(),
  dayId: z.string().min(1),
  tracks: z.object({
    gym: z.boolean().optional(),
    home: z.boolean().optional(),
  }),
  replace: z.boolean().optional(),
});

export async function POST(request: Request) {
  const auth = await requireCoachStaff();
  if (!auth.ok) return auth.response;

  const parsed = pasteSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }

  let sourceWorkoutId = parsed.data.sourceWorkoutId;

  if (parsed.data.templateId) {
    if (!isCoachCatalogDemo()) {
      const tmpl = await prisma.workoutTemplate.findUnique({
        where: { id: parsed.data.templateId },
        select: { workoutId: true },
      });
      if (!tmpl) {
        return NextResponse.json({ detail: "Template not found" }, { status: 404 });
      }
      sourceWorkoutId = tmpl.workoutId;
    } else {
      const { getDemoSeed } = await import("@/lib/demo-seed-store");
      const seed = await getDemoSeed({ preferFresh: true });
      const list = (seed.workoutTemplates as { id: string; workoutId: string }[]) || [];
      const tmpl = list.find((t) => t.id === parsed.data.templateId);
      if (!tmpl) {
        return NextResponse.json({ detail: "Template not found" }, { status: 404 });
      }
      sourceWorkoutId = tmpl.workoutId;
    }
  }

  if (!sourceWorkoutId) {
    return NextResponse.json(
      { detail: "templateId or sourceWorkoutId required" },
      { status: 400 },
    );
  }

  try {
    const result = await pasteWorkoutOntoProgramDay({
      sourceWorkoutId,
      dayId: parsed.data.dayId,
      tracks: parsed.data.tracks,
      replace: parsed.data.replace,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Paste failed";
    const status =
      msg === "DAY_NOT_FOUND"
        ? 404
        : msg === "SELECT_TRACK"
          ? 400
          : msg.includes("WORKOUT_NOT_FOUND")
            ? 404
            : 500;
    return NextResponse.json({ detail: msg }, { status });
  }
}
