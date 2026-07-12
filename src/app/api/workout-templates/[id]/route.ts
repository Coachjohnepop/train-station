import { NextResponse } from "next/server";
import { requireCoachStaff } from "@/lib/api-auth";
import {
  archiveWorkoutTemplate,
  deleteWorkoutTemplate,
  restoreWorkoutTemplate,
} from "@/lib/workout-templates";

type Params = { params: Promise<{ id: string }> };

/**
 * DELETE = soft-archive by default (look-back shelf).
 * ?hard=1 = permanent delete only if already archived (or force=1).
 */
export async function DELETE(request: Request, { params }: Params) {
  const auth = await requireCoachStaff();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const url = new URL(request.url);
  const hard = url.searchParams.get("hard") === "1";
  const forceHard = url.searchParams.get("force") === "1";

  try {
    if (!hard) {
      const row = await archiveWorkoutTemplate(id);
      return NextResponse.json({ ok: true, mode: "archived", template: row });
    }
    const result = await deleteWorkoutTemplate(id, { hard: true, forceHard });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Delete failed";
    const status =
      msg === "TEMPLATE_NOT_FOUND" ? 404 : msg === "NOT_ARCHIVED" ? 409 : 500;
    return NextResponse.json({ detail: msg }, { status });
  }
}

/** PATCH { action: "restore" } — un-archive from shelf. */
export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireCoachStaff();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (body?.action !== "restore") {
    return NextResponse.json(
      { detail: 'Use { "action": "restore" } to un-archive a template.' },
      { status: 400 },
    );
  }

  try {
    const row = await restoreWorkoutTemplate(id);
    return NextResponse.json(row);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Restore failed";
    const status = msg === "TEMPLATE_NOT_FOUND" ? 404 : 500;
    return NextResponse.json({ detail: msg }, { status });
  }
}
