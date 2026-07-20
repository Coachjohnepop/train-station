import { NextResponse } from "next/server";
import { requirePlatformStaff } from "@/lib/api-auth";
import { listBillingTransactions } from "@/lib/stripe-billing-admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requirePlatformStaff();
  if (!auth.ok) return auth.response;

  const limit = Number(new URL(request.url).searchParams.get("limit") || "50");
  try {
    const result = await listBillingTransactions(Number.isFinite(limit) ? limit : 50);
    if (result.error) {
      return NextResponse.json({ error: result.error, transactions: [] }, { status: 503 });
    }
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Could not load transactions.";
    console.error("[admin/billing/transactions]", message);
    return NextResponse.json({ error: message, transactions: [] }, { status: 500 });
  }
}
