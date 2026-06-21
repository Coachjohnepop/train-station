import { NextResponse } from "next/server";
import { z } from "zod";
import {
  applyNewMemberOnboardingCookie,
  getSessionUser,
  syncMemberGateCookies,
} from "@/lib/auth";
import { getMemberProfile, updateMemberProfile } from "@/lib/member-profiles-store";
import { stripeAutoApproveOnPay } from "@/lib/member-gates";
import { getStripe } from "@/lib/stripe";

const schema = z.object({
  sessionId: z.string().min(1),
});

/** Browser return path after Stripe Checkout — confirms session and unlocks onboarding. */
export async function POST(request: Request) {
  const sessionUser = await getSessionUser();
  if (!sessionUser || sessionUser.role !== "MEMBER") {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing checkout session." }, { status: 400 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe is not configured." }, { status: 503 });
  }

  const checkout = await stripe.checkout.sessions.retrieve(parsed.data.sessionId);
  const userId = checkout.metadata?.userId || checkout.client_reference_id;
  if (!userId || userId !== sessionUser.id) {
    return NextResponse.json({ error: "Checkout session does not match this account." }, { status: 403 });
  }

  if (checkout.payment_status !== "paid" && checkout.status !== "complete") {
    return NextResponse.json({ error: "Payment is not complete yet." }, { status: 409 });
  }

  const paidAt = new Date().toISOString();
  const profile = await getMemberProfile(sessionUser.id);
  const patch: Parameters<typeof updateMemberProfile>[1] = {
    paymentStatus: "paid",
    paidAt,
    stripeCustomerId:
      typeof checkout.customer === "string" ? checkout.customer : profile?.stripeCustomerId ?? null,
    stripeSubscriptionId:
      typeof checkout.subscription === "string"
        ? checkout.subscription
        : profile?.stripeSubscriptionId ?? null,
    stripeCheckoutSessionId: checkout.id,
  };

  if (stripeAutoApproveOnPay() && profile?.approvalStatus === "pending") {
    patch.approvalStatus = "approved";
    patch.approvedAt = paidAt;
  }

  const updated = await updateMemberProfile(sessionUser.id, patch);
  const plan = updated.plan;

  const res = NextResponse.json({
    ok: true,
    redirectTo: `/member/onboard?plan=${encodeURIComponent(plan)}`,
  });
  syncMemberGateCookies(res, { userId: sessionUser.id, profile: updated });
  applyNewMemberOnboardingCookie(res, plan);
  return res;
}