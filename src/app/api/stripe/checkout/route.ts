import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, syncMemberGateCookies } from "@/lib/auth";
import { ensureMemberProfile, getMemberProfile, updateMemberProfile } from "@/lib/member-profiles-store";
import { memberCheckoutPath } from "@/lib/member-gates";
import { normalizeSignupPlan } from "@/lib/signup-plans";
import { resolveReferralDiscount } from "@/lib/referral-discounts";
import { getOfferDefinition } from "@/lib/product-offers";
import {
  changeMemberSubscriptionPlan,
  createSignupCheckoutSession,
  stripeConfiguredForPlan,
} from "@/lib/stripe";

const schema = z.object({
  plan: z.string().max(40).optional(),
  referralCode: z.string().max(40).optional(),
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
      existingProfile.stripeSubscriptionId &&
      plan !== existingProfile.plan &&
      getOfferDefinition(plan)?.checkoutMode === "subscription"
    ) {
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
      syncMemberGateCookies(res, {
        userId: session.id,
        profile: updated,
      });
      return res;
    }

    const profile = await ensureMemberProfile({
      userId: session.id,
      email: session.email,
      plan,
      phone: existingProfile?.phone,
    });

    const referralInput = parsed.data.referralCode?.trim() || profile?.referralCode || null;
    const referral = referralInput ? await resolveReferralDiscount(referralInput) : null;

    const checkout = await createSignupCheckoutSession({
      userId: session.id,
      email: session.email,
      name: session.name,
      plan,
      referralCode: referral?.referralCode ?? null,
      discount: referral?.discount ?? null,
      customOfferId: parsed.data.customOfferId,
      merchandiseSkuId: parsed.data.merchandiseSkuId,
      quantity: parsed.data.quantity,
    });

    if ("error" in checkout) {
      return NextResponse.json({ error: checkout.error }, { status: 503 });
    }

    let updatedProfile = profile;
    try {
      updatedProfile = await updateMemberProfile(session.id, {
        plan,
        paymentStatus: "pending",
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
    syncMemberGateCookies(res, {
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