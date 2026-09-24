import { NextResponse } from "next/server";
import { getCurrentAffiliate } from "@/lib/affiliate/auth";
import { requestAffiliatePayout } from "@/lib/affiliate/payouts";

export const dynamic = "force-dynamic";

export async function POST() {
  const affiliate = await getCurrentAffiliate();
  if (!affiliate) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const result = await requestAffiliatePayout(affiliate.id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({
    ok: true,
    amountCents: result.amountCents,
    transferId: result.transferId,
  });
}
