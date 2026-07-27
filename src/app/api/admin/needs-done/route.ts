import { NextResponse } from "next/server";
import { requireCoachStaff } from "@/lib/api-auth";
import { listCoachNeedsDone } from "@/lib/coach-needs-done";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireCoachStaff();
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const openOnly = url.searchParams.get("openOnly") !== "0";
  const limit = Number(url.searchParams.get("limit") || "40");

  try {
    const members = await listCoachNeedsDone({ openOnly, limit });
    return NextResponse.json(
      {
        members,
        openCount: members.filter((m) => m.openCount > 0).length,
        generatedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Could not load needs-done.";
    console.error("[admin/needs-done]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
