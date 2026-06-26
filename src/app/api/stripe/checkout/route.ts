import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, syncMemberGateCookies } from "@/lib/auth";
import { ensureMemberProfile, getMemberProfile, updateMemberProfile } from "@/lib/member-profiles-store";
import { memberCheckoutPath } from "@/lib/member-gates";
import { normalizeSignupPlan } from "@/lib/signup-plans";
import { resolveReferralDiscount } from "@/lib/referral-discounts";
import { createSignupCheckoutSession, stripeConfiguredForPlan } from "@/lib/stripe";

const schema = z.object({
  plan: z.string().max(40).optional(),
  referralCode: z.string().max(40).optional(),
  customOfferId: z.string().max(80).optional(),
  merchandiseSkuId: z.string().max(80).optional(),
  quantity: z.number().int().min(1).max(99).optional(),
});

export async function POST(request: Request) {
  const session = await getSessionUser();
  if (!session || session.role !== "MEMBER") {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const profile = await getMemberProfile(session.id);
  const plan = normalizeSignupPlan(parsed.data.plan || profile?.plan || "explorer");

  if (!stripeConfiguredForPlan(plan)) {
    return NextResponse.json(
      {
        error: "Payments are not configured for this plan yet.",
        redirectTo: `/member/onboard?plan=${encodeURIComponent(plan)}`,
      },
      { status: 503 },
    );
  }

  await ensureMemberProfile({
    userId: session.id,
    email: session.email,
    plan,
    phone: profile?.phone,
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

  await updateMemberProfile(session.id, {
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

  const res = NextResponse.json({ ok: true, url: checkout.url });
  syncMemberGateCookies(res, {
    userId: session.id,
    profile: await getMemberProfile(session.id),
  });
  return res;
}

export async function GET(request: Request) {
  const session = await getSessionUser();
  if (!session || session.role !== "MEMBER") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const profile = await getMemberProfile(session.id);
  const plan = normalizeSignupPlan(
    new URL(request.url).searchParams.get("plan") || profile?.plan || "explorer",
  );

  if (!stripeConfiguredForPlan(plan)) {
    return NextResponse.redirect(new URL(`/member/onboard?plan=${encodeURIComponent(plan)}`, request.url));
  }

  const referralInput = profile?.referralCode || null;
  const referral = referralInput ? await resolveReferralDiscount(referralInput) : null;

  const checkout = await createSignupCheckoutSession({
    userId: session.id,
    email: session.email,
    name: session.name,
    plan,
    referralCode: referral?.referralCode ?? null,
    discount: referral?.discount ?? null,
  });

  if ("error" in checkout) {
    return NextResponse.redirect(new URL(memberCheckoutPath(plan), request.url));
  }

  await updateMemberProfile(session.id, {
    plan,
    paymentStatus: "pending",
    stripeCheckoutSessionId: checkout.sessionId,
    ...(referral?.referralCode
      ? {
          referralCode: referral.referralCode,
          referredByUserId: referral.ownerUserId,
        }
      : {}),
  });

  return NextResponse.redirect(checkout.url);
}