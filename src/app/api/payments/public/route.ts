import { NextResponse } from "next/server";
import { listMerchandiseSkus } from "@/lib/merchandise-store";
import { isStripePaymentsEnabled } from "@/lib/member-gates";
import { getEffectiveMembershipOffers, resolveStripePriceId } from "@/lib/pricing-catalog";
import { diagnoseMembershipStripePrices } from "@/lib/stripe-price-diagnostics";
import { getStripePublishableKey } from "@/lib/stripe";
import { isStripeTestMode } from "@/lib/stripe-price-ids";
import {
  SERVICE_OFFERS,
  feeCategoryForCheckoutMode,
  feeCategoryLabel,
} from "@/lib/product-offers";
import { publicTipConfig } from "@/lib/stripe-checkout-tips";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
  const stripeEnabled = isStripePaymentsEnabled();
  const merchandise = await listMerchandiseSkus();
  const tips = publicTipConfig();

  const effectiveOffers = await getEffectiveMembershipOffers();
  const memberships = effectiveOffers
    .filter((o) => o.checkoutMode !== "free")
    .map((offer) => {
      const feeCategory = feeCategoryForCheckoutMode(offer.checkoutMode);
      return {
        plan: offer.id,
        label: offer.label,
        priceLabel: offer.priceDisplay,
        checkoutMode: offer.checkoutMode,
        /** Business fee shape: monthly subscription vs one-time (amounts vary). */
        feeCategory,
        feeCategoryLabel: feeCategoryLabel(feeCategory),
        stripeReady:
          stripeEnabled &&
          (offer.checkoutMode === "subscription" || offer.checkoutMode === "one_time") &&
          Boolean(offer.stripePriceId),
      };
    });

  const memberPriceId = await resolveStripePriceId("member");
  const stripeDiag = isStripeTestMode() ? await diagnoseMembershipStripePrices() : null;

  return NextResponse.json({
    stripeEnabled,
    stripePublishableKey: stripeEnabled ? getStripePublishableKey() : null,
    ...(isStripeTestMode()
      ? {
          stripeTestMode: true,
          memberPriceId,
          memberPriceLen: memberPriceId?.length ?? 0,
          stripeDiag,
        }
      : {}),
    memberships,
    services: SERVICE_OFFERS.map((o) => {
      const feeCategory = feeCategoryForCheckoutMode(o.checkoutMode);
      return {
        plan: o.id,
        label: o.label,
        priceLabel: o.priceLabel,
        checkoutMode: o.checkoutMode,
        feeCategory,
        feeCategoryLabel: feeCategoryLabel(feeCategory),
      };
    }),
    merchandise: merchandise.map((sku) => ({
      id: sku.id,
      name: sku.name,
      priceLabel: sku.priceLabel,
      feeCategory: "one_time" as const,
      feeCategoryLabel: feeCategoryLabel("one_time"),
      stripeReady: stripeEnabled && Boolean(sku.stripePriceId),
    })),
    /** All paid packages fall under one of these two fee types. */
    feeCategories: [
      { id: "subscription", label: "Monthly subscription" },
      { id: "one_time", label: "One-time fee" },
    ],
    venmo: {
      qrUrl: null,
      handle: null,
      instructions: null,
      hasQr: false,
    },
    /** Optional coach tips (membership Checkout optional_items + Account tip card). */
    tips: {
      enabled: tips.enabled,
      presets: tips.presets,
      customEnabled: tips.customEnabled,
      minCustomDollars: tips.minCustomDollars,
      maxCustomDollars: tips.maxCustomDollars,
    },
  });
  } catch (e) {
    console.error("[payments/public]", e instanceof Error ? e.message : e);
    return NextResponse.json(
      {
        stripeEnabled: false,
        stripePublishableKey: null,
        memberships: [],
        services: [],
        merchandise: [],
        feeCategories: [],
        venmo: { qrUrl: null, handle: null, instructions: null, hasQr: false },
        tips: { enabled: false, presets: [], customEnabled: false },
      },
      { status: 200 },
    );
  }
}