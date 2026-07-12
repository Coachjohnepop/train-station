import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/api-auth";
import {
  archiveWorkoutCycle,
  deleteWorkoutCycle,
  getWorkoutCycleById,
  restoreWorkoutCycle,
} from "@/lib/workout-cycle-db";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const cycle = await getWorkoutCycleById(id);
  if (!cycle) {
    return NextResponse.json({ detail: "Cycle not found" }, { status: 404 });
  }
  return NextResponse.json(cycle);
}

/**
 * DELETE = soft-archive by default.
 * ?hard=1 = permanent (only if archived, unless force=1).
 */
export async function DELETE(request: Request, { params }: Params) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const url = new URL(request.url);
  const hard = url.searchParams.get("hard") === "1";
  const forceHard = url.searchParams.get("force") === "1";

  try {
    if (!hard) {
      const cycle = await archiveWorkoutCycle(id);
      return NextResponse.json({ ok: true, mode: "archived", cycle });
    }
    const result = await deleteWorkoutCycle(id, { hard: true, forceHard });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Delete failed";
    const status =
      msg === "CYCLE_NOT_FOUND" ? 404 : msg === "NOT_ARCHIVED" ? 409 : 500;
    return NextResponse.json({ detail: msg }, { status });
  }
}

/** PATCH { action: "restore" } — bring pack back from archive. */
export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (body?.action !== "restore") {
    return NextResponse.json(
      { detail: 'Use { "action": "restore" } to un-archive a cycle pack.' },
      { status: 400 },
    );
  }

  try {
    const cycle = await restoreWorkoutCycle(id);
    return NextResponse.json(cycle);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Restore failed";
    const status = msg === "CYCLE_NOT_FOUND" ? 404 : 500;
    return NextResponse.json({ detail: msg }, { status });
  }
}
