import "server-only";

import { getCustomTrainingOffer, updateCustomTrainingOffer } from "@/lib/custom-training-offers-store";
import { getMerchandiseSku } from "@/lib/merchandise-store";
import type { CheckoutDiscount } from "@/lib/referral-discounts";
import { referralDiscountsEnabled } from "@/lib/referral-discounts";
import {
  getOfferDefinition,
  type CustomTrainingParameters,
} from "@/lib/product-offers";
import { getMemberProfile, updateMemberProfile } from "@/lib/member-profiles-store";
import { resolveStripePriceId } from "@/lib/pricing-catalog";
import type { SignupPlan } from "@/lib/signup-plans";
import { signupPlanLabel } from "@/lib/signup-plans";
import { isStripePaymentsEnabled, isPaidSignupPlan } from "@/lib/member-gates";
import {
  isStripeTestMode,
  normalizeStripePublishableKey,
  normalizeStripeSecretKey,
  STRIPE_TEST_PUBLISHABLE_KEY,
} from "@/lib/stripe-price-ids";
import {
  customerHasSavedPaymentMethod,
  ensureStripeCustomer,
  repairMemberStripeBillingState,
} from "@/lib/stripe-customer";
import {
  customerSavedCardReadyForCheckoutPrefill,
  promoteCustomerPaymentMethodsForCheckout,
} from "@/lib/stripe-payment-method-persist";
import { COACH_TIP_METADATA_KIND } from "@/lib/coach-tips";
import {
  buildMembershipTipOptionalItems,
  resolveCoachTipLineItem,
} from "@/lib/stripe-checkout-tips";

type StripeClient = import("stripe").default;

let stripeClient: StripeClient | null = null;

export function getStripe(): StripeClient | null {
  if (!isStripePaymentsEnabled()) return null;
  if (stripeClient) return stripeClient;

  const key = normalizeStripeSecretKey(process.env.STRIPE_SECRET_KEY);
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
  // Free / quote plans do not use Stripe checkout.
  if (!isPaidSignupPlan(plan)) return false;
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
  const fromEnv = normalizeStripePublishableKey(
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ||
      process.env.STRIPE_PUBLISHABLE_KEY,
  );
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
  | "customer"
  | "customer_email"
  | "customer_update"
  | "saved_payment_method_options"
  | "billing_address_collection"
  | "payment_method_collection"
  | "wallet_options"
>;

async function checkoutCustomerFields(input: {
  userId: string;
  email: string;
  name: string;
}): Promise<{
  customerId: string | null;
  hasSavedCard: boolean;
  savedCardPrefillReady: boolean;
  fields: CheckoutCustomerFields;
}> {
  await repairMemberStripeBillingState(input.userId);
  const customerId = await ensureStripeCustomer(input);
  if (!customerId) {
    return {
      customerId: null,
      hasSavedCard: false,
      savedCardPrefillReady: false,
      fields: { customer_email: input.email },
    };
  }

  const profile = await getMemberProfile(input.userId);
  await promoteCustomerPaymentMethodsForCheckout(
    customerId,
    profile?.stripeSubscriptionId,
  );

  const hasSavedCard = await customerHasSavedPaymentMethod(
    customerId,
    profile?.stripeSubscriptionId,
  );
  const savedCardPrefillReady = hasSavedCard
    ? await customerSavedCardReadyForCheckoutPrefill(
        customerId,
        profile?.stripeSubscriptionId,
      )
    : false;

  return {
    customerId,
    hasSavedCard,
    savedCardPrefillReady,
    fields: {
      customer: customerId,
      customer_update: { address: "auto", name: "auto" },
      billing_address_collection: "required",
      payment_method_collection: savedCardPrefillReady ? "if_required" : "always",
      wallet_options: {
        link: { display: "never" },
      },
      saved_payment_method_options: {
        payment_method_save: "enabled",
        payment_method_remove: "enabled",
        allow_redisplay_filters: ["always", "limited", "unspecified"],
      },
    },
  };
}

function applyReferralDiscounts(
  sessionParams: import("stripe").Stripe.Checkout.SessionCreateParams,
  discount?: CheckoutDiscount | null,
) {
  // Stripe: cannot combine pre-applied discounts[] with allow_promotion_codes.
  // Always honor an already-resolved promo/coupon (Checkout field or referral map).
  // referralDiscountsEnabled() only gates the optional allow_promotion_codes fallback.
  if (discount?.promotionCode) {
    sessionParams.discounts = [{ promotion_code: discount.promotionCode }];
    return;
  }
  if (discount?.coupon) {
    sessionParams.discounts = [{ coupon: discount.coupon }];
    return;
  }
  // Members can still type a code in Stripe Checkout when we did not pre-apply one.
  if (referralDiscountsEnabled()) {
    sessionParams.allow_promotion_codes = true;
  }
}

/** Optional coach tips at membership Checkout (fixed presets and/or $1 adjustable). */
function applyMembershipTipOptionalItems(
  sessionParams: import("stripe").Stripe.Checkout.SessionCreateParams,
) {
  const tips = buildMembershipTipOptionalItems();
  if (tips.length === 0) return;
  sessionParams.optional_items = tips;
  sessionParams.metadata = {
    ...(sessionParams.metadata || {}),
    tipsEnabled: "true",
  };
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
    applyMembershipTipOptionalItems(sessionParams);
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
    // One-time tip add-ons alongside the subscription (optional at Checkout).
    applyMembershipTipOptionalItems(sessionParams);
    const session = await createCheckoutSession(stripe, sessionParams);
    if ("error" in session) return session;
    return { ...session, hasSavedCard: customer.hasSavedCard };
  }

  return { error: `${signupPlanLabel(input.plan)} requires a quote — contact the coach.` };
}

/**
 * Free Explorer — save a card with $0 Setup Checkout (no charge).
 * Used when admin lever freeRequiresPaymentMethod is ON.
 */
export async function createFreeCardSetupSession(input: {
  userId: string;
  email: string;
  name: string;
}): Promise<
  { clientSecret: string; sessionId: string; hasSavedCard: boolean } | { error: string }
> {
  const stripe = getStripe();
  if (!stripe) return { error: "Stripe is not configured." };

  const customer = await checkoutCustomerFields({
    userId: input.userId,
    email: input.email,
    name: input.name,
  });
  if (!customer.customerId) {
    return { error: "Could not create a Stripe customer for card setup." };
  }

  if (customer.hasSavedCard) {
    // Stamp profile if Stripe already has a card (toggle flipped after legacy free).
    await updateMemberProfile(input.userId, {
      stripeCustomerId: customer.customerId,
      paymentMethod: "card_on_file",
      paymentNote: "Free Explorer card on file (not charged)",
    });
    return { clientSecret: "", sessionId: "", hasSavedCard: true };
  }

  const base = appBaseUrl();
  const sessionParams: import("stripe").Stripe.Checkout.SessionCreateParams = {
    mode: "setup",
    currency: "usd",
    ui_mode: "embedded_page",
    return_url: `${base}/member/payment-setup/complete?session_id={CHECKOUT_SESSION_ID}`,
    redirect_on_completion: "if_required",
    customer: customer.customerId,
    customer_update: { address: "auto", name: "auto" },
    billing_address_collection: "required",
    payment_method_types: ["card"],
    client_reference_id: input.userId,
    metadata: {
      kind: "free_card_on_file",
      userId: input.userId,
      plan: "explorer",
    },
    setup_intent_data: {
      metadata: {
        kind: "free_card_on_file",
        userId: input.userId,
        plan: "explorer",
      },
    },
  };

  const session = await createCheckoutSession(stripe, sessionParams);
  if ("error" in session) return session;
  return { ...session, hasSavedCard: false };
}

/** After Setup Checkout completes — stamp Free Explorer card_on_file (still unpaid). */
export async function confirmFreeCardSetupSession(input: {
  userId: string;
  sessionId: string;
}): Promise<{ ok: true; already?: boolean } | { error: string }> {
  const stripe = getStripe();
  if (!stripe) return { error: "Stripe is not configured." };

  let session: import("stripe").Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(input.sessionId, {
      expand: ["setup_intent", "customer"],
    });
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Could not load setup session." };
  }

  if (session.mode !== "setup") {
    return { error: "Not a card setup session." };
  }
  if (session.status !== "complete") {
    return { error: "Card setup is not complete yet." };
  }

  const metaUser = session.metadata?.userId || session.client_reference_id;
  if (metaUser && metaUser !== input.userId) {
    return { error: "This setup session belongs to a different account." };
  }

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer && typeof session.customer === "object" && "id" in session.customer
        ? session.customer.id
        : null;

  // Ensure default payment method on customer when SetupIntent finished
  try {
    const si =
      typeof session.setup_intent === "string"
        ? await stripe.setupIntents.retrieve(session.setup_intent)
        : session.setup_intent;
    const pmId =
      si && typeof si.payment_method === "string"
        ? si.payment_method
        : si?.payment_method && typeof si.payment_method === "object"
          ? si.payment_method.id
          : null;
    if (customerId && pmId) {
      await stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: pmId },
      });
    }
  } catch (e) {
    console.warn("[stripe] free card setup default PM", e);
  }

  await updateMemberProfile(input.userId, {
    stripeCustomerId: customerId,
    paymentMethod: "card_on_file",
    // Explicitly not paid — Free stays free
    paymentNote: "Free Explorer card on file (not charged)",
  });

  return { ok: true };
}

/**
 * Standalone one-time coach tip (Account, Messages soft link, etc.).
 * Does not change membership plan or paymentStatus.
 */
export async function createCoachTipCheckoutSession(input: {
  userId: string;
  email: string;
  name: string;
  amountCents: number;
}): Promise<
  { clientSecret: string; sessionId: string; hasSavedCard: boolean; amountCents: number } | { error: string }
> {
  const stripe = getStripe();
  if (!stripe) return { error: "Stripe is not configured." };

  const line = resolveCoachTipLineItem(input.amountCents);
  if ("error" in line) return line;

  const customer = await checkoutCustomerFields({
    userId: input.userId,
    email: input.email,
    name: input.name,
  });

  const base = appBaseUrl();
  const sessionParams: import("stripe").Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    ...embeddedCheckoutFields(base),
    ...customer.fields,
    client_reference_id: input.userId,
    metadata: {
      kind: COACH_TIP_METADATA_KIND,
      userId: input.userId,
      tipAmountCents: String(line.amountCents),
      tipLabel: line.label,
    },
    line_items: [
      {
        price: line.price,
        quantity: line.quantity,
      },
    ],
    payment_intent_data: {
      setup_future_usage: "off_session",
      metadata: {
        kind: COACH_TIP_METADATA_KIND,
        userId: input.userId,
        tipAmountCents: String(line.amountCents),
      },
    },
  };

  const session = await createCheckoutSession(stripe, sessionParams);
  if ("error" in session) return session;
  return {
    ...session,
    hasSavedCard: customer.hasSavedCard,
    amountCents: line.amountCents,
  };
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