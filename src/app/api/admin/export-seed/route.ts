import { NextResponse } from "next/server";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import { buildSeedSnapshot } from "@/lib/export-seed-snapshot";

export async function GET() {
  const session = await getSessionUser();
  if (!session || !isStaffRole(session.role)) {
    return NextResponse.json({ error: "Staff login required" }, { status: 401 });
  }

  try {
    const snapshot = await buildSeedSnapshot();
    const stamp = snapshot._meta.exportedAt.slice(0, 10);
    const body = JSON.stringify(snapshot, null, 2);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="seed-data-${stamp}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("GET /api/admin/export-seed", e);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}