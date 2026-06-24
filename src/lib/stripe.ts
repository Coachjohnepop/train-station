import "server-only";

import type { CheckoutDiscount } from "@/lib/referral-discounts";
import { referralDiscountsEnabled } from "@/lib/referral-discounts";
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

export function stripePriceIdForPlan(plan: SignupPlan): string | null {
  if (plan === "member") return process.env.STRIPE_PRICE_MEMBER?.trim() || null;
  if (plan === "pro") return process.env.STRIPE_PRICE_PRO?.trim() || null;
  return null;
}

export function stripeConfiguredForPlan(plan: SignupPlan): boolean {
  if (!isPaidSignupPlan(plan)) return true;
  if (!isStripePaymentsEnabled()) return false;
  return Boolean(stripePriceIdForPlan(plan));
}

export function appBaseUrl(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.VERCEL_URL?.trim();
  if (!fromEnv) return "http://localhost:3000";
  if (fromEnv.startsWith("http")) return fromEnv.replace(/\/$/, "");
  return `https://${fromEnv}`;
}

export async function createSignupCheckoutSession(input: {
  userId: string;
  email: string;
  name: string;
  plan: SignupPlan;
  referralCode?: string | null;
  discount?: CheckoutDiscount | null;
}): Promise<{ url: string; sessionId: string } | { error: string }> {
  const stripe = getStripe();
  if (!stripe) return { error: "Stripe is not configured." };

  const priceId = stripePriceIdForPlan(input.plan);
  if (!priceId) {
    return { error: `Stripe price is not configured for ${signupPlanLabel(input.plan)}.` };
  }

  const base = appBaseUrl();
  const metadata: Record<string, string> = {
    userId: input.userId,
    plan: input.plan,
    signup: "true",
  };
  if (input.referralCode?.trim()) {
    metadata.referralCode = input.referralCode.trim().toUpperCase();
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

  if (referralDiscountsEnabled()) {
    if (input.discount?.promotionCode) {
      sessionParams.discounts = [{ promotion_code: input.discount.promotionCode }];
    } else if (input.discount?.coupon) {
      sessionParams.discounts = [{ coupon: input.discount.coupon }];
    } else {
      sessionParams.allow_promotion_codes = true;
    }
  }

  const session = await stripe.checkout.sessions.create(sessionParams);

  if (!session.url) return { error: "Stripe did not return a checkout URL." };
  return { url: session.url, sessionId: session.id };
}