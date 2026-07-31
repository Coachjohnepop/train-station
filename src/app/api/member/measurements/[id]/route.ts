import { NextResponse } from "next/server";
import { requireMemberAccess } from "@/lib/api-auth";
import { deleteUserMeasurement } from "@/lib/measurements-store";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireMemberAccess();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }

  try {
    const ok = await deleteUserMeasurement({
      id: id.trim(),
      userId: auth.session.id,
    });
    if (!ok) {
      return NextResponse.json({ error: "Measurement not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Delete failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
