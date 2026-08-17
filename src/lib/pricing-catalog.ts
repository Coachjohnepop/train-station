import "server-only";

import { MEMBERSHIP_OFFERS, getOfferDefinition, type ProductOfferDefinition } from "@/lib/product-offers";
import {
  getPricingPlanRecord,
  listPricingPlanRecords,
  upsertPricingPlanRecord,
} from "@/lib/pricing-catalog-store";
import { getStripe } from "@/lib/stripe";
import { canonicalMembershipPriceId } from "@/lib/stripe-price-ids";
import type { MembershipPlan } from "@/lib/signup-plans";

export type EffectiveMembershipOffer = ProductOfferDefinition & {
  priceCents: number;
  priceDisplay: string;
  stripePriceId: string | null;
  stripeProductId: string | null;
  adminConfigured: boolean;
};

const PAID_PLANS: MembershipPlan[] = ["member", "business", "pro"];

function defaultPriceCents(offer: ProductOfferDefinition): number {
  if (offer.defaultPriceCents) return offer.defaultPriceCents;
  const match = offer.priceLabel.match(/\$([\d,]+)/);
  if (!match) return 0;
  return Math.round(Number(match[1].replace(/,/g, "")) * 100);
}

function envStripePriceId(planId: string): string | null {
  const offer = getOfferDefinition(planId);
  if (!offer?.stripePriceEnv) return null;
  const primary = process.env[offer.stripePriceEnv]?.trim();
  // Guard against accidental paste of sk_/pk_ into STRIPE_PRICE_* (broke Live cutover).
  if (primary?.startsWith("price_")) return primary;
  if (planId === "pro") {
    const legacy = process.env.STRIPE_PRICE_FIRST_CLASS_1ON1?.trim();
    if (legacy?.startsWith("price_")) return legacy;
  }
  return null;
}

export function formatPriceDisplay(
  cents: number,
  checkoutMode: ProductOfferDefinition["checkoutMode"],
): { priceLabel: string; priceNote?: string } {
  const dollars = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);

  if (checkoutMode === "subscription") {
    return { priceLabel: dollars.replace(/\.00$/, ""), priceNote: "/mo" };
  }
  if (checkoutMode === "one_time") {
    return { priceLabel: dollars.replace(/\.00$/, ""), priceNote: "one-time" };
  }
  return { priceLabel: dollars };
}

export function joinPriceDisplay(priceLabel: string, priceNote?: string): string {
  if (!priceNote) return priceLabel;
  if (priceNote.startsWith("/")) return `${priceLabel}${priceNote}`;
  return `${priceLabel} ${priceNote}`;
}

function pickStripePriceId(envId: string | null, catalogId: string | null): string | null {
  if (!envId) return catalogId;
  if (!catalogId) return envId;
  if (envId === catalogId) return envId;
  // Env is the current merchant. Catalog can still hold a prior account's price_.
  return envId;
}

async function firstRetrievablePriceId(ids: Array<string | null>): Promise<string | null> {
  const stripe = getStripe();
  const seen = new Set<string>();
  for (const raw of ids) {
    const id = raw?.trim() || "";
    if (!id.startsWith("price_") || seen.has(id)) continue;
    seen.add(id);
    if (!stripe) return id;
    try {
      await stripe.prices.retrieve(id);
      return id;
    } catch {
      /* price is from another Stripe account or deleted */
    }
  }
  return null;
}

export async function resolveStripePriceId(planId: string): Promise<string | null> {
  const canonical = canonicalMembershipPriceId(planId);
  const record = PAID_PLANS.includes(planId as MembershipPlan)
    ? await getPricingPlanRecord(planId as MembershipPlan)
    : null;
  const catalogId = record?.enabled && record.stripePriceId ? record.stripePriceId : null;
  return firstRetrievablePriceId([
    canonical,
    envStripePriceId(planId),
    catalogId,
  ]);
}

async function buildEffectiveOffer(
  base: ProductOfferDefinition,
): Promise<EffectiveMembershipOffer> {
  const record =
    base.id !== "explorer" ? await getPricingPlanRecord(base.id as MembershipPlan) : null;
  const priceCents = record?.priceCents ?? defaultPriceCents(base);
  const display = formatPriceDisplay(priceCents, base.checkoutMode);
  const stripePriceId =
    canonicalMembershipPriceId(base.id) ||
    pickStripePriceId(envStripePriceId(base.id), record?.stripePriceId || null);

  return {
    ...base,
    label: record?.label || base.label,
    shortLabel: record?.label || base.shortLabel,
    priceLabel: display.priceLabel,
    priceNote: display.priceNote,
    priceCents,
    priceDisplay: joinPriceDisplay(display.priceLabel, display.priceNote),
    stripePriceId: stripePriceId || null,
    stripeProductId: record?.stripeProductId ?? null,
    adminConfigured: Boolean(record),
  };
}

export async function getEffectiveMembershipOffers(): Promise<EffectiveMembershipOffer[]> {
  const bases = MEMBERSHIP_OFFERS.filter((o) =>
    ["explorer", "member", "business", "pro"].includes(o.id),
  );
  return Promise.all(bases.map(buildEffectiveOffer));
}

export async function getEffectiveMembershipOffer(
  planId: MembershipPlan,
): Promise<EffectiveMembershipOffer | null> {
  const base = MEMBERSHIP_OFFERS.find((o) => o.id === planId);
  if (!base) return null;
  return buildEffectiveOffer(base);
}

export async function syncStripePriceForPlan(input: {
  planId: MembershipPlan;
  priceCents: number;
  label?: string;
}): Promise<{ stripePriceId: string; stripeProductId: string } | { error: string }> {
  const stripe = getStripe();
  if (!stripe) return { error: "Stripe is not configured." };

  const base = getOfferDefinition(input.planId);
  if (!base || (base.checkoutMode !== "subscription" && base.checkoutMode !== "one_time")) {
    return { error: "This plan does not support Stripe price sync." };
  }

  const existing = await getPricingPlanRecord(input.planId);
  let productId = existing?.stripeProductId || null;

  if (!productId && existing?.stripePriceId) {
    try {
      const oldPrice = await stripe.prices.retrieve(existing.stripePriceId);
      productId =
        typeof oldPrice.product === "string" ? oldPrice.product : oldPrice.product?.id || null;
    } catch {
      productId = null;
    }
  }

  if (!productId) {
    const product = await stripe.products.create({
      name: input.label || base.label,
      description: base.description,
      metadata: { planId: input.planId, source: "train-station-admin" },
    });
    productId = product.id;
  }

  const price = await stripe.prices.create({
    product: productId,
    currency: "usd",
    unit_amount: input.priceCents,
    ...(base.checkoutMode === "subscription"
      ? { recurring: { interval: "month" as const } }
      : {}),
    metadata: { planId: input.planId, source: "train-station-admin" },
  });

  await upsertPricingPlanRecord(input.planId, {
    label: input.label,
    priceCents: input.priceCents,
    stripePriceId: price.id,
    stripeProductId: productId,
    enabled: true,
  });

  return { stripePriceId: price.id, stripeProductId: productId };
}

export async function importStripePriceIdsFromEnv(): Promise<void> {
  for (const planId of PAID_PLANS) {
    const envId = canonicalMembershipPriceId(planId) || envStripePriceId(planId);
    if (!envId) continue;
    const existing = await getPricingPlanRecord(planId);
    if (existing?.stripePriceId === envId) continue;
    const base = getOfferDefinition(planId);
    if (!base) continue;
    await upsertPricingPlanRecord(planId, {
      label: existing?.label || base.label,
      priceCents: existing?.priceCents ?? defaultPriceCents(base),
      stripePriceId: envId,
      stripeProductId: existing?.stripeProductId ?? null,
      enabled: existing?.enabled ?? true,
    });
  }
}

export async function getAdminPricingSnapshot() {
  const offers = await getEffectiveMembershipOffers();
  const records = await listPricingPlanRecords();
  return {
    offers: offers.filter((o) => o.id !== "explorer"),
    records,
    stripeConnected: Boolean(process.env.STRIPE_SECRET_KEY?.trim()),
  };
}