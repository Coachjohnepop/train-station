import { NextResponse } from "next/server";
import { requirePlatformStaff } from "@/lib/api-auth";
import { getBillingAdminOverview } from "@/lib/stripe-billing-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requirePlatformStaff();
  if (!auth.ok) return auth.response;

  try {
    const overview = await getBillingAdminOverview();
    return NextResponse.json(overview, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Could not load billing overview.";
    console.error("[admin/billing/overview]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
