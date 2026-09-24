import { NextResponse } from "next/server";
import { requirePlatformStaff } from "@/lib/api-auth";
import { processAffiliatePayout } from "@/lib/affiliate/payouts";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Staff pay-now. Moves commission to the affiliate's Stripe Connect account. */
export async function POST(_request: Request, context: Params) {
  const auth = await requirePlatformStaff();
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  const result = await processAffiliatePayout(id, { ignoreMinimum: true });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({
    ok: true,
    payoutId: result.payoutId,
    amountCents: result.amountCents,
    transferId: result.transferId,
  });
}
