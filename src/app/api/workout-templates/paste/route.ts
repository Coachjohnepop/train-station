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
  /** Multi-part day part (1–5). Defaults to 1 (Main/AM). */
  partIndex: z.number().int().min(1).max(5).optional(),
  /** When true with replace, first call returns 409 if tracks already have content. */
  force: z.boolean().optional(),
  /**
   * Name for the cloned workout on the destination day.
   * Required when pasting from the template library (must differ from the template name).
   */
  contentName: z.string().max(200).optional().nullable(),
});

export async function POST(request: Request) {
  const auth = await requireCoachStaff();
  if (!auth.ok) return auth.response;

  const parsed = pasteSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }

  let sourceWorkoutId = parsed.data.sourceWorkoutId;
  let sourceTemplateName: string | null = null;
  const fromTemplate = Boolean(parsed.data.templateId);

  if (parsed.data.templateId) {
    if (!isCoachCatalogDemo()) {
      const tmpl = await prisma.workoutTemplate.findUnique({
        where: { id: parsed.data.templateId },
        select: { workoutId: true, archivedAt: true, name: true },
      });
      if (!tmpl) {
        return NextResponse.json({ detail: "Template not found" }, { status: 404 });
      }
      if (tmpl.archivedAt) {
        return NextResponse.json(
          { detail: "Template is archived — restore it before pasting." },
          { status: 409 },
        );
      }
      sourceWorkoutId = tmpl.workoutId;
      sourceTemplateName = tmpl.name;
    } else {
      const { getDemoSeed } = await import("@/lib/demo-seed-store");
      const seed = await getDemoSeed({ preferFresh: true });
      const list =
        (seed.workoutTemplates as {
          id: string;
          name?: string;
          workoutId: string;
          archivedAt?: string | null;
        }[]) || [];
      const tmpl = list.find((t) => t.id === parsed.data.templateId);
      if (!tmpl) {
        return NextResponse.json({ detail: "Template not found" }, { status: 404 });
      }
      if (tmpl.archivedAt) {
        return NextResponse.json(
          { detail: "Template is archived — restore it before pasting." },
          { status: 409 },
        );
      }
      sourceWorkoutId = tmpl.workoutId;
      sourceTemplateName = tmpl.name || null;
    }
  }

  if (!sourceWorkoutId) {
    return NextResponse.json(
      { detail: "templateId or sourceWorkoutId required" },
      { status: 400 },
    );
  }

  try {
    const replace = parsed.data.replace !== false;
    const force = parsed.data.force === true;
    const result = await pasteWorkoutOntoProgramDay({
      sourceWorkoutId,
      dayId: parsed.data.dayId,
      tracks: parsed.data.tracks,
      replace,
      partIndex: parsed.data.partIndex,
      // Soft confirm on overwrite unless coach already confirmed (force).
      requireConfirmIfOccupied: replace && !force,
      contentName: parsed.data.contentName,
      sourceTemplateName,
      // Template pastes must get a new title (different week / day usage).
      requireRename: fromTemplate,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Paste failed";
    if (msg === "NEEDS_CONFIRM") {
      const err = e as Error & { occupiedTracks?: string[]; partIndex?: number };
      return NextResponse.json(
        {
          detail: "NEEDS_CONFIRM",
          needsConfirm: true,
          occupiedTracks: err.occupiedTracks || [],
          partIndex: err.partIndex ?? parsed.data.partIndex ?? 1,
          message:
            "This day/part already has Gym or Home content. Confirm to replace with a fresh clone.",
        },
        { status: 409 },
      );
    }
    if (msg === "RENAME_REQUIRED") {
      return NextResponse.json(
        {
          detail: msg,
          message:
            "Give this copy a new name (different from the template title) before pasting onto another week/day.",
        },
        { status: 400 },
      );
    }
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
