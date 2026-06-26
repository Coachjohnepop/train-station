import "server-only";

import { getCustomTrainingOffer, updateCustomTrainingOffer } from "@/lib/custom-training-offers-store";
import { getMerchandiseSku } from "@/lib/merchandise-store";
import type { CheckoutDiscount } from "@/lib/referral-discounts";
import { referralDiscountsEnabled } from "@/lib/referral-discounts";
import {
  getOfferDefinition,
  type CustomTrainingParameters,
} from "@/lib/product-offers";
import { resolveStripePriceId } from "@/lib/pricing-catalog";
import type { SignupPlan } from "@/lib/signup-plans";
import { signupPlanLabel } from "@/lib/signup-plans";
import { isStripePaymentsEnabled, isPaidSignupPlan } from "@/lib/member-gates";

type StripeClient = import("stripe").default;

let stripeClient: StripeClient | null = null;

export function getStripe(): StripeClient | null {
  if (!isStripePaymentsEnabled()) return null;
  if (stripeClient) return stripeClient;

  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Stripe = require("stripe") as typeof import("stripe").default;
  stripeClient = new Stripe(key, { apiVersion: "2026-05-27.dahlia" });
  return stripeClient;
}

export async function stripePriceIdForPlan(plan: SignupPlan): Promise<string | null> {
  return resolveStripePriceId(plan);
}

export async function stripeConfiguredForPlan(plan: SignupPlan): Promise<boolean> {
  if (!isPaidSignupPlan(plan)) return true;
  if (!isStripePaymentsEnabled()) return false;
  const offer = getOfferDefinition(plan);
  if (!offer) return false;
  if (offer.checkoutMode === "subscription" || offer.checkoutMode === "one_time") {
    return Boolean(await resolveStripePriceId(plan));
  }
  if (offer.checkoutMode === "custom_offer") return true;
  return false;
}

export async function createBillingPortalSession(input: {
  customerId: string;
  returnPath?: string;
}): Promise<{ url: string } | { error: string }> {
  const stripe = getStripe();
  if (!stripe) return { error: "Stripe is not configured." };

  const base = appBaseUrl();
  const returnUrl = `${base}${input.returnPath || "/member/account"}`;

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: input.customerId,
      return_url: returnUrl,
    });
    if (!session.url) return { error: "Stripe did not return a portal URL." };
    return { url: session.url };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Billing portal unavailable.";
    return { error: message };
  }
}

export function appBaseUrl(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.VERCEL_URL?.trim();
  if (!fromEnv) return "http://localhost:3000";
  if (fromEnv.startsWith("http")) return fromEnv.replace(/\/$/, "");
  return `https://${fromEnv}`;
}

function applyReferralDiscounts(
  sessionParams: import("stripe").Stripe.Checkout.SessionCreateParams,
  discount?: CheckoutDiscount | null,
) {
  if (!referralDiscountsEnabled()) return;
  if (discount?.promotionCode) {
    sessionParams.discounts = [{ promotion_code: discount.promotionCode }];
  } else if (discount?.coupon) {
    sessionParams.discounts = [{ coupon: discount.coupon }];
  } else {
    sessionParams.allow_promotion_codes = true;
  }
}

export async function createSignupCheckoutSession(input: {
  userId: string;
  email: string;
  name: string;
  plan: SignupPlan;
  referralCode?: string | null;
  discount?: CheckoutDiscount | null;
  customOfferId?: string | null;
  merchandiseSkuId?: string | null;
  quantity?: number;
}): Promise<{ url: string; sessionId: string } | { error: string }> {
  const stripe = getStripe();
  if (!stripe) return { error: "Stripe is not configured." };

  const offer = getOfferDefinition(input.plan);
  if (!offer) return { error: "Unknown offer." };

  const base = appBaseUrl();
  const metadata: Record<string, string> = {
    userId: input.userId,
    plan: input.plan,
    signup: "true",
  };
  if (input.referralCode?.trim()) {
    metadata.referralCode = input.referralCode.trim().toUpperCase();
  }

  if (offer.checkoutMode === "custom_offer") {
    if (!input.customOfferId) {
      return { error: "A coach must send you a custom training offer link first." };
    }
    const customOffer = await getCustomTrainingOffer(input.customOfferId);
    if (!customOffer || customOffer.status === "canceled") {
      return { error: "This custom training offer is not available." };
    }
    if (customOffer.priceCents <= 0) {
      return { error: "Custom training price is not set." };
    }
    metadata.customOfferId = customOffer.id;
    metadata.offerLabel = customOffer.label;

    const sessionParams: import("stripe").Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      customer_email: input.email,
      client_reference_id: input.userId,
      metadata,
      line_items: [
        {
          price_data: {
            currency: customOffer.currency,
            unit_amount: customOffer.priceCents,
            product_data: {
              name: customOffer.label,
              description: summarizeCustomParams(customOffer.parameters),
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${base}/member/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/member/checkout?plan=custom_training&offerId=${encodeURIComponent(customOffer.id)}&canceled=1`,
    };
    applyReferralDiscounts(sessionParams, input.discount);
    const session = await stripe.checkout.sessions.create(sessionParams);
    if (!session.url) return { error: "Stripe did not return a checkout URL." };
    await updateCustomTrainingOffer(customOffer.id, {
      status: "sent",
      stripeCheckoutSessionId: session.id,
      memberUserId: input.userId,
      memberEmail: input.email,
    });
    return { url: session.url, sessionId: session.id };
  }

  if (input.plan === "merchandise") {
    const sku = input.merchandiseSkuId
      ? await getMerchandiseSku(input.merchandiseSkuId)
      : null;
    const priceId = sku?.stripePriceId || (await resolveStripePriceId("merchandise"));
    if (!priceId || !sku) {
      return { error: "Merchandise item is not configured for checkout yet." };
    }
    metadata.merchandiseSkuId = sku.id;
    const qty = Math.max(1, Math.min(99, input.quantity ?? 1));
    const sessionParams: import("stripe").Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      customer_email: input.email,
      client_reference_id: input.userId,
      metadata,
      line_items: [{ price: priceId, quantity: qty }],
      success_url: `${base}/member/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/member/checkout?plan=merchandise&sku=${encodeURIComponent(sku.id)}&canceled=1`,
    };
    applyReferralDiscounts(sessionParams, input.discount);
    const session = await stripe.checkout.sessions.create(sessionParams);
    if (!session.url) return { error: "Stripe did not return a checkout URL." };
    return { url: session.url, sessionId: session.id };
  }

  if (offer.checkoutMode === "one_time") {
    const priceId = await resolveStripePriceId(input.plan);
    if (!priceId) {
      return { error: `Stripe price is not configured for ${signupPlanLabel(input.plan)}.` };
    }
    const sessionParams: import("stripe").Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      customer_email: input.email,
      client_reference_id: input.userId,
      metadata,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${base}/member/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/member/checkout?plan=${encodeURIComponent(input.plan)}&canceled=1`,
    };
    applyReferralDiscounts(sessionParams, input.discount);
    const session = await stripe.checkout.sessions.create(sessionParams);
    if (!session.url) return { error: "Stripe did not return a checkout URL." };
    return { url: session.url, sessionId: session.id };
  }

  if (offer.checkoutMode === "subscription") {
    const priceId = await resolveStripePriceId(input.plan);
    if (!priceId) {
      return { error: `Stripe price is not configured for ${signupPlanLabel(input.plan)}.` };
    }
    const sessionParams: import("stripe").Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      customer_email: input.email,
      client_reference_id: input.userId,
      metadata,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${base}/member/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/member/checkout?plan=${encodeURIComponent(input.plan)}&canceled=1`,
      subscription_data: {
        metadata: {
          userId: input.userId,
          plan: input.plan,
          ...(input.referralCode?.trim()
            ? { referralCode: input.referralCode.trim().toUpperCase() }
            : {}),
        },
      },
    };
    applyReferralDiscounts(sessionParams, input.discount);
    const session = await stripe.checkout.sessions.create(sessionParams);
    if (!session.url) return { error: "Stripe did not return a checkout URL." };
    return { url: session.url, sessionId: session.id };
  }

  return { error: `${signupPlanLabel(input.plan)} requires a quote — contact the coach.` };
}

function summarizeCustomParams(params: CustomTrainingParameters): string {
  const days = params.dropInDays.length > 0 ? params.dropInDays.join(", ") : "flexible";
  return `${params.daysPerWeek} days/wk · ${params.sessionsPerDay}/day · ${params.minutesPerSession} min · ${days}`;
}