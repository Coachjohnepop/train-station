import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformStaff } from "@/lib/api-auth";
import { getStripeReservePosition } from "@/lib/affiliate/reserve";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ amountCents: z.number().int().positive().optional() });

/** Send Stripe cash above the affiliate reserve to the bank. Manual payouts only. */
export async function POST(request: Request) {
  const auth = await requirePlatformStaff();
  if (!auth.ok) return auth.response;
  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: "Stripe is not configured." }, { status: 503 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  const pos = await getStripeReservePosition();
  if (pos.balanceError) {
    return NextResponse.json({ error: "Could not read the Stripe balance." }, { status: 502 });
  }
  if (pos.safeToSweepCents < 100) {
    return NextResponse.json(
      { error: "Nothing above the reserve is available to send to the bank." },
      { status: 400 },
    );
  }
  let amountCents = pos.safeToSweepCents;
  if (parsed.success && parsed.data.amountCents != null) {
    if (parsed.data.amountCents > pos.safeToSweepCents) {
      return NextResponse.json(
        { error: "That amount would go below the reserve." },
        { status: 400 },
      );
    }
    amountCents = parsed.data.amountCents;
  }
  try {
    const payout = await stripe.payouts.create({ amount: amountCents, currency: "usd" });
    return NextResponse.json({
      ok: true,
      amountCents,
      payoutId: payout.id,
      reserveKeptCents: pos.reserveNeededCents,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sweep failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
