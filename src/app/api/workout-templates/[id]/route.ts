import { NextResponse } from "next/server";
import { requireCoachStaff } from "@/lib/api-auth";
import { deleteWorkoutTemplate } from "@/lib/workout-templates";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireCoachStaff();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  try {
    await deleteWorkoutTemplate(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Delete failed";
    const status = msg === "TEMPLATE_NOT_FOUND" ? 404 : 500;
    return NextResponse.json({ detail: msg }, { status });
  }
}
