import "server-only";

import { getCustomTrainingOffer, updateCustomTrainingOffer } from "@/lib/custom-training-offers-store";
import { getMerchandiseSku } from "@/lib/merchandise-store";
import type { CheckoutDiscount } from "@/lib/referral-discounts";
import { referralDiscountsEnabled } from "@/lib/referral-discounts";
import {
  getOfferDefinition,
  type CustomTrainingParameters,
} from "@/lib/product-offers";
import { updateMemberProfile } from "@/lib/member-profiles-store";
import { resolveStripePriceId } from "@/lib/pricing-catalog";
import type { SignupPlan } from "@/lib/signup-plans";
import { signupPlanLabel } from "@/lib/signup-plans";
import { isStripePaymentsEnabled, isPaidSignupPlan } from "@/lib/member-gates";
import { isStripeTestMode, STRIPE_TEST_PUBLISHABLE_KEY } from "@/lib/stripe-price-ids";
import {
  customerHasSavedPaymentMethod,
  ensureStripeCustomer,
} from "@/lib/stripe-customer";

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

export function getStripePublishableKey(): string | null {
  const fromEnv =
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ||
    process.env.STRIPE_PUBLISHABLE_KEY?.trim();
  if (fromEnv) return fromEnv;
  if (isStripeTestMode() && process.env.STRIPE_USE_CANONICAL_PRICES !== "false") {
    return STRIPE_TEST_PUBLISHABLE_KEY;
  }
  return null;
}

function embeddedCheckoutFields(base: string): Pick<
  import("stripe").Stripe.Checkout.SessionCreateParams,
  "ui_mode" | "return_url" | "redirect_on_completion"
> {
  return {
    ui_mode: "embedded_page",
    return_url: `${base}/member/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    redirect_on_completion: "if_required",
  };
}

export function appBaseUrl(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.VERCEL_URL?.trim();
  if (fromEnv) {
    if (fromEnv.startsWith("http")) return fromEnv.replace(/\/$/, "");
    return `https://${fromEnv.replace(/\/$/, "")}`;
  }
  if (process.env.VERCEL || process.env.NODE_ENV === "production") {
    return "https://www.thetrainstation.co";
  }
  return "http://localhost:3000";
}

async function createCheckoutSession(
  stripe: StripeClient,
  sessionParams: import("stripe").Stripe.Checkout.SessionCreateParams,
): Promise<{ clientSecret: string; sessionId: string } | { error: string }> {
  try {
    const session = await stripe.checkout.sessions.create(sessionParams);
    if (!session.client_secret) {
      return { error: "Stripe did not return a checkout client secret." };
    }
    return { clientSecret: session.client_secret, sessionId: session.id };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Stripe checkout failed.";
    console.error("[stripe] checkout.sessions.create failed:", message);
    return { error: message };
  }
}

type CheckoutCustomerFields = Pick<
  import("stripe").Stripe.Checkout.SessionCreateParams,
  "customer" | "customer_email" | "customer_update" | "saved_payment_method_options"
>;

async function checkoutCustomerFields(input: {
  userId: string;
  email: string;
  name: string;
}): Promise<{ customerId: string | null; hasSavedCard: boolean; fields: CheckoutCustomerFields }> {
  const customerId = await ensureStripeCustomer(input);
  if (!customerId) {
    return {
      customerId: null,
      hasSavedCard: false,
      fields: { customer_email: input.email },
    };
  }

  const hasSavedCard = await customerHasSavedPaymentMethod(customerId);
  return {
    customerId,
    hasSavedCard,
    fields: {
      customer: customerId,
      customer_update: { address: "auto", name: "auto" },
      saved_payment_method_options: {
        payment_method_save: "enabled",
        payment_method_remove: "enabled",
        allow_redisplay_filters: ["always", "limited"],
      },
    },
  };
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
  }
  // Promo code entry on Stripe Checkout disabled for now — re-enable when we ship referrals.
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
}): Promise<
  { clientSecret: string; sessionId: string; hasSavedCard: boolean } | { error: string }
> {
  const stripe = getStripe();
  if (!stripe) return { error: "Stripe is not configured." };

  const offer = getOfferDefinition(input.plan);
  if (!offer) return { error: "Unknown offer." };

  const customer = await checkoutCustomerFields({
    userId: input.userId,
    email: input.email,
    name: input.name,
  });

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
      ...embeddedCheckoutFields(base),
      ...customer.fields,
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
      payment_intent_data: {
        setup_future_usage: "off_session",
      },
    };
    applyReferralDiscounts(sessionParams, input.discount);
    const session = await createCheckoutSession(stripe, sessionParams);
    if ("error" in session) return session;
    await updateCustomTrainingOffer(customOffer.id, {
      status: "sent",
      stripeCheckoutSessionId: session.sessionId,
      memberUserId: input.userId,
      memberEmail: input.email,
    });
    return { ...session, hasSavedCard: customer.hasSavedCard };
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
      ...embeddedCheckoutFields(base),
      ...customer.fields,
      client_reference_id: input.userId,
      metadata,
      line_items: [{ price: priceId, quantity: qty }],
      payment_intent_data: {
        setup_future_usage: "off_session",
      },
    };
    applyReferralDiscounts(sessionParams, input.discount);
    const session = await createCheckoutSession(stripe, sessionParams);
    if ("error" in session) return session;
    return { ...session, hasSavedCard: customer.hasSavedCard };
  }

  if (offer.checkoutMode === "one_time") {
    const priceId = await resolveStripePriceId(input.plan);
    if (!priceId) {
      return { error: `Stripe price is not configured for ${signupPlanLabel(input.plan)}.` };
    }
    const sessionParams: import("stripe").Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      ...embeddedCheckoutFields(base),
      ...customer.fields,
      client_reference_id: input.userId,
      metadata,
      line_items: [{ price: priceId, quantity: 1 }],
      payment_intent_data: {
        setup_future_usage: "off_session",
      },
    };
    applyReferralDiscounts(sessionParams, input.discount);
    const session = await createCheckoutSession(stripe, sessionParams);
    if ("error" in session) return session;
    return { ...session, hasSavedCard: customer.hasSavedCard };
  }

  if (offer.checkoutMode === "subscription") {
    const priceId = await resolveStripePriceId(input.plan);
    if (!priceId) {
      return { error: `Stripe price is not configured for ${signupPlanLabel(input.plan)}.` };
    }
    const sessionParams: import("stripe").Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      ...embeddedCheckoutFields(base),
      ...customer.fields,
      client_reference_id: input.userId,
      metadata,
      line_items: [{ price: priceId, quantity: 1 }],
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
    const session = await createCheckoutSession(stripe, sessionParams);
    if ("error" in session) return session;
    return { ...session, hasSavedCard: customer.hasSavedCard };
  }

  return { error: `${signupPlanLabel(input.plan)} requires a quote — contact the coach.` };
}

export async function changeMemberSubscriptionPlan(input: {
  userId: string;
  subscriptionId: string;
  newPlan: SignupPlan;
}): Promise<{ ok: true; plan: SignupPlan } | { error: string }> {
  const stripe = getStripe();
  if (!stripe) return { error: "Stripe is not configured." };

  const offer = getOfferDefinition(input.newPlan);
  if (!offer || offer.checkoutMode !== "subscription") {
    return { error: "That plan is not available as a subscription switch." };
  }

  const priceId = await resolveStripePriceId(input.newPlan);
  if (!priceId) {
    return { error: `Stripe price is not configured for ${signupPlanLabel(input.newPlan)}.` };
  }

  try {
    const subscription = await stripe.subscriptions.retrieve(input.subscriptionId);
    const itemId = subscription.items.data[0]?.id;
    if (!itemId) return { error: "Subscription has no billable items." };

    await stripe.subscriptions.update(input.subscriptionId, {
      items: [{ id: itemId, price: priceId }],
      proration_behavior: "create_prorations",
      metadata: {
        ...subscription.metadata,
        userId: input.userId,
        plan: input.newPlan,
      },
    });

    await updateMemberProfile(input.userId, { plan: input.newPlan });
    return { ok: true, plan: input.newPlan };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Plan change failed.";
    console.error("[stripe] subscription plan change failed:", message);
    return { error: message };
  }
}

function summarizeCustomParams(params: CustomTrainingParameters): string {
  const days = params.dropInDays.length > 0 ? params.dropInDays.join(", ") : "flexible";
  return `${params.daysPerWeek} days/wk · ${params.sessionsPerDay}/day · ${params.minutesPerSession} min · ${days}`;
}