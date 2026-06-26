import { NextResponse } from "next/server";
import { listMerchandiseSkus } from "@/lib/merchandise-store";
import { getLandingMedia } from "@/lib/landing-media-store";
import { isStripePaymentsEnabled } from "@/lib/member-gates";
import { MEMBERSHIP_OFFERS, SERVICE_OFFERS, stripePriceIdForOffer } from "@/lib/product-offers";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = await getLandingMedia();
  const stripeEnabled = isStripePaymentsEnabled();
  const merchandise = await listMerchandiseSkus();

  const memberships = MEMBERSHIP_OFFERS.filter((o) => o.checkoutMode !== "free").map((offer) => ({
    plan: offer.id,
    label: offer.label,
    priceLabel: offer.priceNote ? `${offer.priceLabel}${offer.priceNote}` : offer.priceLabel,
    checkoutMode: offer.checkoutMode,
    stripeReady:
      stripeEnabled &&
      (offer.checkoutMode === "subscription" || offer.checkoutMode === "one_time") &&
      Boolean(stripePriceIdForOffer(offer.id)),
  }));

  return NextResponse.json({
    stripeEnabled,
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