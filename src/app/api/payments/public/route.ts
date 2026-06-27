import { NextResponse } from "next/server";
import { listMerchandiseSkus } from "@/lib/merchandise-store";
import { getLandingMedia } from "@/lib/landing-media-store";
import { isStripePaymentsEnabled } from "@/lib/member-gates";
import { getEffectiveMembershipOffers, resolveStripePriceId } from "@/lib/pricing-catalog";
import { isStripeTestMode } from "@/lib/stripe-price-ids";
import { SERVICE_OFFERS } from "@/lib/product-offers";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = await getLandingMedia();
  const stripeEnabled = isStripePaymentsEnabled();
  const merchandise = await listMerchandiseSkus();

  const effectiveOffers = await getEffectiveMembershipOffers();
  const memberships = effectiveOffers
    .filter((o) => o.checkoutMode !== "free")
    .map((offer) => ({
      plan: offer.id,
      label: offer.label,
      priceLabel: offer.priceDisplay,
      checkoutMode: offer.checkoutMode,
      stripeReady:
        stripeEnabled &&
        (offer.checkoutMode === "subscription" || offer.checkoutMode === "one_time") &&
        Boolean(offer.stripePriceId),
    }));

  const memberPriceId = await resolveStripePriceId("member");

  return NextResponse.json({
    stripeEnabled,
    ...(isStripeTestMode()
      ? { stripeTestMode: true, memberPriceId, memberPriceLen: memberPriceId?.length ?? 0 }
      : {}),
    memberships,
    services: SERVICE_OFFERS.map((o) => ({
      plan: o.id,
      label: o.label,
      priceLabel: o.priceLabel,
      checkoutMode: o.checkoutMode,
    })),
    merchandise: merchandise.map((sku) => ({
      id: sku.id,
      name: sku.name,
      priceLabel: sku.priceLabel,
      stripeReady: stripeEnabled && Boolean(sku.stripePriceId),
    })),
    venmo: {
      qrUrl: config.venmoQrUrl,
      handle: config.venmoHandle,
      instructions: config.venmoInstructions,
      hasQr: Boolean(config.venmoQrUrl?.trim()),
    },
  });
}