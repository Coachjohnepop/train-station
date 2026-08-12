import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, syncMemberGateCookies } from "@/lib/auth";
import { ensureMemberProfile, getMemberProfile, updateMemberProfile } from "@/lib/member-profiles-store";
import { isPublicCardCheckoutEnabled, memberCheckoutPath } from "@/lib/member-gates";
import {
  isMembershipPlan,
  membershipPlanRank,
  normalizeSignupPlan,
} from "@/lib/signup-plans";
import { resolveReferralDiscount, type CheckoutDiscount } from "@/lib/referral-discounts";
import { resolveStripePromotionCode } from "@/lib/stripe-discount-codes";
import { getOfferDefinition } from "@/lib/product-offers";
import {
  changeMemberSubscriptionPlan,
  createSignupCheckoutSession,
  stripeConfiguredForPlan,
} from "@/lib/stripe";

const schema = z.object({
  plan: z.string().max(40).optional(),
  referralCode: z.string().max(40).optional(),
  /** Human promo code (e.g. FEEDBACK50) or promo_… / coupon_… id */
  promoCode: z.string().max(40).optional(),
  customOfferId: z.string().max(80).optional(),
  merchandiseSkuId: z.string().max(80).optional(),
  quantity: z.number().int().min(1).max(99).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getSessionUser();
    if (!session || session.role !== "MEMBER") {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }

    const parsed = schema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const existingProfile = await getMemberProfile(session.id);
    const plan = normalizeSignupPlan(parsed.data.plan || existingProfile?.plan || "explorer");

    if (!isPublicCardCheckoutEnabled()) {
      return NextResponse.json(
        {
          error:
            "Card checkout is paused. Pay with Venmo on this screen — Coach Jeremy will unlock your ticket after payment posts.",
          redirectTo: memberCheckoutPath(plan),
          publicCardCheckout: false,
        },
        { status: 503 },
      );
    }

    // Already paid for this ticket — do not open another Checkout session.
    // Clear stale payment-gate cookies and send them into onboard / Today.
    if (
      existingProfile?.paymentStatus === "paid" &&
      existingProfile.plan === plan &&
      !parsed.data.customOfferId &&
      !parsed.data.merchandiseSkuId
    ) {
      const redirectTo = existingProfile.onboardingComplete
        ? "/member/today"
        : `/member/onboard?plan=${encodeURIComponent(existingProfile.plan)}`;
      const res = NextResponse.json({
        ok: true,
        alreadyPaid: true,
        redirectTo,
        plan: existingProfile.plan,
      });
      await syncMemberGateCookies(res, {
        userId: session.id,
        profile: existingProfile,
      });
      return res;
    }

    if (
      existingProfile?.paymentStatus !== "paid" &&
      existingProfile?.plan &&
      isMembershipPlan(existingProfile.plan) &&
      isMembershipPlan(plan)
    ) {
      const currentRank = membershipPlanRank(existingProfile.plan);
      const requestedRank = membershipPlanRank(plan);
      if (
        currentRank !== null &&
        requestedRank !== null &&
        requestedRank < currentRank
      ) {
        return NextResponse.json(
          {
            error: "Downgrades aren’t available during signup — finish checkout or upgrade to a higher tier.",
            redirectTo: memberCheckoutPath(existingProfile.plan),
          },
          { status: 400 },
        );
      }
    }

    if (!(await stripeConfiguredForPlan(plan))) {
      return NextResponse.json(
        {
          error: "Payments are not configured for this plan yet.",
          redirectTo: `/member/onboard?plan=${encodeURIComponent(plan)}`,
        },
        { status: 503 },
      );
    }

    if (
      existingProfile?.paymentStatus === "paid" &&
      plan !== existingProfile.plan &&
      getOfferDefinition(plan)?.checkoutMode === "subscription"
    ) {
      // Subscription ↔ subscription switch (proration) when we have a Stripe sub id.
      if (existingProfile.stripeSubscriptionId) {
        const changed = await changeMemberSubscriptionPlan({
          userId: session.id,
          subscriptionId: existingProfile.stripeSubscriptionId,
          newPlan: plan,
        });
        if ("error" in changed) {
          return NextResponse.json({ error: changed.error }, { status: 400 });
        }
        const updated = await getMemberProfile(session.id);
        const res = NextResponse.json({
          ok: true,
          planChanged: true,
          redirectTo: "/member/account",
          plan: changed.plan,
        });
        await syncMemberGateCookies(res, {
          userId: session.id,
          profile: updated,
        });
        return res;
      }
      // Paid via Venmo / one-time / missing sub id: fall through to a real Checkout
      // session for the new plan (plan stamped only after payment confirms).
    }

    const profile = await ensureMemberProfile({
      userId: session.id,
      email: session.email,
      plan,
      phone: existingProfile?.phone,
    });

    const referralInput = parsed.data.referralCode?.trim() || profile?.referralCode || null;
    const referral = referralInput ? await resolveReferralDiscount(referralInput) : null;

    // Explicit promo field wins over referral map discount (still can store referral for attribution).
    let discount: CheckoutDiscount | null = referral?.discount ?? null;
    const promoRaw = parsed.data.promoCode?.trim();
    if (promoRaw) {
      const fromStripe = await resolveStripePromotionCode(promoRaw);
      if (!fromStripe) {
        return NextResponse.json(
          { error: "That discount code isn’t valid or has expired." },
          { status: 400 },
        );
      }
      discount = fromStripe;
    }

    const checkout = await createSignupCheckoutSession({
      userId: session.id,
      email: session.email,
      name: session.name,
      plan,
      referralCode: referral?.referralCode ?? null,
      discount,
      customOfferId: parsed.data.customOfferId,
      merchandiseSkuId: parsed.data.merchandiseSkuId,
      quantity: parsed.data.quantity,
    });

    if ("error" in checkout) {
      return NextResponse.json({ error: checkout.error }, { status: 503 });
    }

    // Re-read before write — confirm/webhook may mark paid while this request creates the session.
    const latestProfile = await getMemberProfile(session.id);
    const keepPaidStatus = latestProfile?.paymentStatus === "paid";

    let updatedProfile = profile;
    try {
      // Do not flip `plan` for already-paid members until confirm/webhook succeeds —
      // otherwise an abandoned upgrade/downgrade checkout changes their ticket early.
      // Unpaid signup still stamps the intended plan + pending payment.
      updatedProfile = await updateMemberProfile(session.id, {
        ...(keepPaidStatus ? {} : { plan, paymentStatus: "pending" as const }),
        stripeCheckoutSessionId: checkout.sessionId,
        ...(parsed.data.customOfferId ? { customTrainingOfferId: parsed.data.customOfferId } : {}),
        ...(referral?.referralCode
          ? {
              referralCode: referral.referralCode,
              referredByUserId: referral.ownerUserId,
            }
          : {}),
      });
    } catch (e: unknown) {
      console.error("[stripe/checkout] profile update failed after session create", e);
    }

    const res = NextResponse.json({
      ok: true,
      clientSecret: checkout.clientSecret,
      sessionId: checkout.sessionId,
      hasSavedCard: checkout.hasSavedCard,
    });
    await syncMemberGateCookies(res, {
      userId: session.id,
      profile: updatedProfile,
    });
    return res;
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Checkout failed.";
    console.error("[stripe/checkout] unexpected error", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const session = await getSessionUser();
  if (!session || session.role !== "MEMBER") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const existingProfile = await getMemberProfile(session.id);
  const url = new URL(request.url);
  const plan = normalizeSignupPlan(
    url.searchParams.get("plan") || existingProfile?.plan || "explorer",
  );

  const redirect = new URL(memberCheckoutPath(plan), request.url);
  for (const key of ["offerId", "sku", "canceled"]) {
    const value = url.searchParams.get(key);
    if (value) redirect.searchParams.set(key, value);
  }

  return NextResponse.redirect(redirect);
}