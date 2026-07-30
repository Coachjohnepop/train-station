import { NextResponse } from "next/server";
import { requirePlatformStaff } from "@/lib/api-auth";
import { listBankPayouts } from "@/lib/stripe-account-money";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requirePlatformStaff();
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const account = url.searchParams.get("account") || "platform";
  const limit = Number(url.searchParams.get("limit") || "40");
  const startingAfter = url.searchParams.get("starting_after") || undefined;

  try {
    const result = await listBankPayouts(account, {
      limit: Number.isFinite(limit) ? limit : 40,
      startingAfter,
    });
    if (result.error) {
      return NextResponse.json(
        { error: result.error, rows: [], hasMore: false },
        { status: 503 },
      );
    }
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Could not load bank payouts.";
    console.error("[admin/billing/bank-payouts]", message);
    return NextResponse.json({ error: message, rows: [], hasMore: false }, { status: 500 });
  }
}
