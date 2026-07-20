import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCoachStaff } from "@/lib/api-auth";
import {
  listWorkoutTemplates,
  promoteWorkoutToTemplate,
} from "@/lib/workout-templates";

export async function GET(request: Request) {
  const auth = await requireCoachStaff();
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const category = url.searchParams.get("category") || undefined;
  const archiveParam = url.searchParams.get("archive");
  const archive =
    archiveParam === "archived" || archiveParam === "all" || archiveParam === "active"
      ? archiveParam
      : "active";
  const list = await listWorkoutTemplates({
    category: category || undefined,
    archive,
  });
  return NextResponse.json(list);
}

const promoteSchema = z.object({
  sourceWorkoutId: z.string().min(1),
  /** Coach-facing title — required; empty/whitespace rejected. */
  name: z
    .string()
    .trim()
    .min(2, "Template title required (at least 2 characters)")
    .max(200),
  category: z.string().max(40).optional(),
  versionLabel: z.string().max(80).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export async function POST(request: Request) {
  const auth = await requireCoachStaff();
  if (!auth.ok) return auth.response;

  const parsed = promoteSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      {
        detail: parsed.error.flatten(),
        message: "Template title required — type a name before saving.",
      },
      { status: 400 },
    );
  }

  try {
    const row = await promoteWorkoutToTemplate(parsed.data);
    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Promote failed";
    const status =
      msg === "WORKOUT_NOT_FOUND" || msg.includes("WORKOUT_NOT_FOUND")
        ? 404
        : msg === "NAME_REQUIRED"
          ? 400
          : 500;
    return NextResponse.json(
      {
        detail: msg,
        message:
          msg === "NAME_REQUIRED"
            ? "Template title required — type a name before saving."
            : msg,
      },
      { status },
    );
  }
}
