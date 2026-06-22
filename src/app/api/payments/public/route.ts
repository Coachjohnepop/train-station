import { NextResponse } from "next/server";
import { getLandingMedia } from "@/lib/landing-media-store";
import { isStripePaymentsEnabled } from "@/lib/member-gates";
import { stripePriceIdForPlan } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = await getLandingMedia();
  const stripeEnabled = isStripePaymentsEnabled();

  return NextResponse.json({
    stripeEnabled,
    coachClass: {
      plan: "member",
      priceLabel: "$25/mo",
      stripeReady: stripeEnabled && Boolean(stripePriceIdForPlan("member")),
    },
    firstClass: {
      plan: "pro",
      priceLabel: "$50/mo",
      stripeReady: stripeEnabled && Boolean(stripePriceIdForPlan("pro")),
    },
    venmo: {
      qrUrl: config.venmoQrUrl,
      handle: config.venmoHandle,
      instructions: config.venmoInstructions,
      hasQr: Boolean(config.venmoQrUrl?.trim()),
    },
  });
}