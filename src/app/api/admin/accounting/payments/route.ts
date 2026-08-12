import { NextResponse } from "next/server";
import { requirePlatformStaff } from "@/lib/api-auth";
import { listPaymentLedger } from "@/lib/analytics-facts";

export const dynamic = "force-dynamic";

/** App payment books — FactSubscriptionPayment (not only live Stripe API). */
export async function GET(request: Request) {
  const auth = await requirePlatformStaff();
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const userId = url.searchParams.get("userId")?.trim() || undefined;
  const limitRaw = Number(url.searchParams.get("limit") || "50");
  const limit = Number.isFinite(limitRaw) ? limitRaw : 50;
  const status = url.searchParams.get("status")?.trim() || undefined;

  try {
    const data = await listPaymentLedger({ userId, limit, status });
    return NextResponse.json(
      {
        ...data,
        rows: data.rows.map((r) => ({
          ...r,
          paidAt: r.paidAtLabel,
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Could not load payment ledger.";
    console.error("[admin/accounting/payments]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
