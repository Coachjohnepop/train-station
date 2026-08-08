import { NextResponse } from "next/server";
import { getSessionUser, syncMemberGateCookies } from "@/lib/auth";
import { getMemberProfile } from "@/lib/member-profiles-store";
import { getGamificationLevers } from "@/lib/gamification-config-store";
import { isPaidSignupPlan } from "@/lib/member-gates";
import { createFreeCardSetupSession, getStripePublishableKey } from "@/lib/stripe";
import { isFreeExplorerPlan } from "@/lib/free-tier-product";

export const dynamic = "force-dynamic";

/** Start $0 card setup for Free Explorer when admin lever is ON. */
export async function POST() {
  const session = await getSessionUser();
  if (!session || session.role !== "MEMBER") {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const levers = await getGamificationLevers();
  if (!levers.freeRequiresPaymentMethod) {
    return NextResponse.json(
      { error: "Free card-on-file is turned off.", redirectTo: "/member/onboard?plan=explorer" },
      { status: 400 },
    );
  }

  const profile = await getMemberProfile(session.id);
  const plan = profile?.plan ?? "explorer";
  if (isPaidSignupPlan(plan) || !isFreeExplorerPlan(plan)) {
    return NextResponse.json(
      { error: "Card setup is only for Free Explorer.", redirectTo: "/member/checkout" },
      { status: 400 },
    );
  }

  const created = await createFreeCardSetupSession({
    userId: session.id,
    email: session.email,
    name: session.name || profile?.email || session.email,
  });

  if ("error" in created) {
    return NextResponse.json({ error: created.error }, { status: 400 });
  }

  if (created.hasSavedCard) {
    const updated = await getMemberProfile(session.id);
    const res = NextResponse.json({
      ok: true,
      alreadyOnFile: true,
      redirectTo: updated?.onboardingComplete
        ? "/member/today"
        : "/member/onboard?plan=explorer",
    });
    await syncMemberGateCookies(res, { userId: session.id, profile: updated });
    return res;
  }

  const pk = getStripePublishableKey();
  if (!pk) {
    return NextResponse.json({ error: "Stripe publishable key missing." }, { status: 503 });
  }

  return NextResponse.json({
    ok: true,
    clientSecret: created.clientSecret,
    sessionId: created.sessionId,
    publishableKey: pk,
  });
}
