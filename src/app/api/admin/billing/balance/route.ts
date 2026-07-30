import { NextResponse } from "next/server";
import { requirePlatformStaff } from "@/lib/api-auth";
import { getStripeBalanceSnapshot } from "@/lib/stripe-account-money";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requirePlatformStaff();
  if (!auth.ok) return auth.response;

  const account = new URL(request.url).searchParams.get("account") || "platform";
  try {
    const balance = await getStripeBalanceSnapshot(account);
    return NextResponse.json(balance, { headers: { "Cache-Control": "no-store" } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Could not load balance.";
    console.error("[admin/billing/balance]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
