import { NextResponse } from "next/server";
import { requirePlatformStaff } from "@/lib/api-auth";
import { listBillingSubscriptions } from "@/lib/stripe-billing-admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requirePlatformStaff();
  if (!auth.ok) return auth.response;

  const limit = Number(new URL(request.url).searchParams.get("limit") || "40");
  try {
    const result = await listBillingSubscriptions(Number.isFinite(limit) ? limit : 40);
    if (result.error) {
      return NextResponse.json({ error: result.error, subscriptions: [] }, { status: 503 });
    }
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Could not load subscriptions.";
    console.error("[admin/billing/subscriptions]", message);
    return NextResponse.json({ error: message, subscriptions: [] }, { status: 500 });
  }
}
