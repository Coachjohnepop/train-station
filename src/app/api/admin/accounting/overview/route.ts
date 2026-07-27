import { NextResponse } from "next/server";
import { requirePlatformStaff } from "@/lib/api-auth";
import { getAccountingDashboard } from "@/lib/accounting-dashboard";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requirePlatformStaff();
  if (!auth.ok) return auth.response;

  try {
    const data = await getAccountingDashboard();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Could not load accounting dashboard.";
    console.error("[admin/accounting/overview]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
