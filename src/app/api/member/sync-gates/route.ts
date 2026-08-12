import { NextResponse } from "next/server";
import { getSessionUser, syncMemberGateCookies } from "@/lib/auth";
import { resolveMemberAppEntryPath } from "@/lib/member-app-entry-server";
import {
  memberNeedsFreePaymentMethodAsync,
  memberNeedsPaymentAsync,
  memberNeedsApproval,
} from "@/lib/member-gates";
import { getMemberProfile } from "@/lib/member-profiles-store";

export const dynamic = "force-dynamic";

/**
 * Re-align browser gate cookies with Postgres profile.
 * Fixes webhook-paid / closed-tab cases where `ts_needs_payment` stays set
 * and Today keeps bouncing to checkout.
 */
export async function POST() {
  const session = await getSessionUser();
  if (!session || session.role !== "MEMBER") {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const profile = await getMemberProfile(session.id);
  const needsPayment = await memberNeedsPaymentAsync(profile, session.id);
  const needsFreePm = await memberNeedsFreePaymentMethodAsync(profile, session.id);
  const needsOnboard = !profile?.onboardingComplete;
  const pendingApproval = memberNeedsApproval(profile, session.id);
  const redirectTo = await resolveMemberAppEntryPath(session.id, profile);

  const res = NextResponse.json({
    ok: true,
    plan: profile?.plan ?? null,
    paymentStatus: profile?.paymentStatus ?? null,
    onboardingComplete: Boolean(profile?.onboardingComplete),
    needsPayment,
    needsFreePm,
    needsOnboard,
    pendingApproval,
    redirectTo,
  });
  await syncMemberGateCookies(res, { userId: session.id, profile });
  return res;
}

/** GET also allowed so a hard navigation or beacon can refresh cookies. */
export async function GET() {
  return POST();
}
