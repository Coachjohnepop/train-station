import "server-only";

import { NextResponse } from "next/server";
import {
  applyNewMemberOnboardingCookie,
  applySessionCookies,
  isStaffRole,
  syncMemberGateCookies,
  type SessionUser,
} from "@/lib/auth";
import {
  memberCheckoutPath,
  MEMBER_PENDING_PATH,
  memberNeedsApproval,
  memberNeedsPayment,
} from "@/lib/member-gates";
import { memberOnboardPath, memberTodayPath } from "@/lib/member-destinations";
import { getMemberProfile } from "@/lib/member-profiles-store";
import { applyRememberedEmailCookie } from "@/lib/remembered-email";

export async function resolveLoginDestination(
  user: SessionUser,
  redirect?: string,
): Promise<string> {
  let destination = isStaffRole(user.role) ? "/admin" : memberTodayPath();

  if (!isStaffRole(user.role)) {
    const profile = await getMemberProfile(user.id);
    const plan = profile?.plan || "explorer";
    const needsOnboard =
      (profile && !profile.onboardingComplete) ||
      (!profile && user.id.startsWith("member-"));

    if (memberNeedsPayment(profile, user.id)) {
      destination = memberCheckoutPath(plan);
    } else if (needsOnboard) {
      destination = memberOnboardPath();
      if (plan) destination = `/member/onboard?plan=${encodeURIComponent(plan)}`;
    } else if (memberNeedsApproval(profile, user.id)) {
      destination = MEMBER_PENDING_PATH;
    }
  }

  if (redirect && redirect.startsWith("/") && !redirect.startsWith("//")) {
    if (isStaffRole(user.role) && redirect.startsWith("/admin")) destination = redirect;
    else if (!isStaffRole(user.role) && redirect.startsWith("/member")) destination = redirect;
    else if (redirect.startsWith("/member/chat")) destination = redirect;
  }

  return destination;
}

export async function buildLoginResponse(
  user: SessionUser,
  options?: { redirect?: string },
): Promise<NextResponse> {
  const destination = await resolveLoginDestination(user, options?.redirect);

  const res = NextResponse.json({
    ok: true,
    user: { email: user.email, name: user.name, role: user.role },
    redirect: destination,
  });
  applySessionCookies(res, user);
  applyRememberedEmailCookie(res, user.email);

  if (!isStaffRole(user.role)) {
    const profile = await getMemberProfile(user.id);
    const needsOnboard =
      (profile && !profile.onboardingComplete) ||
      (!profile && user.id.startsWith("member-"));
    if (needsOnboard) {
      applyNewMemberOnboardingCookie(res, profile?.plan);
    }
    syncMemberGateCookies(res, { userId: user.id, profile });
  }

  return res;
}