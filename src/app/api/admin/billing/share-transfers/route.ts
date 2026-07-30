import { NextResponse } from "next/server";
import { requirePlatformStaff } from "@/lib/api-auth";
import { listShareTransfers } from "@/lib/stripe-account-money";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requirePlatformStaff();
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const account = url.searchParams.get("account") || "platform";
  const limit = Number(url.searchParams.get("limit") || "40");

  try {
    const result = await listShareTransfers(account, {
      limit: Number.isFinite(limit) ? limit : 40,
    });
    if (result.error) {
      return NextResponse.json(
        { error: result.error, rows: [], hasMore: false },
        { status: 503 },
      );
    }
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Could not load share transfers.";
    console.error("[admin/billing/share-transfers]", message);
    return NextResponse.json({ error: message, rows: [], hasMore: false }, { status: 500 });
  }
}