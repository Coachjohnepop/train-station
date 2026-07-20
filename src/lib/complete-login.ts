import "server-only";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  applyNewMemberOnboardingCookie,
  applySessionCookies,
  syncMemberGateCookies,
  type SessionUser,
} from "@/lib/auth";
import {
  defaultStaffLandingPath,
  isStaffRole,
  normalizeCoachLoginRedirect,
} from "@/lib/staff-access";
import {
  applyEmailHistoryCookies,
  readEmailHistoryFromRequestCookies,
} from "@/lib/email-history-cookies";
import {
  memberCheckoutPath,
  MEMBER_PENDING_PATH,
  memberNeedsApproval,
  memberNeedsPayment,
} from "@/lib/member-gates";
import { isMemberPathExemptFromPaymentGate } from "@/lib/member-route-gates";
import { memberOnboardPath, memberTodayPath } from "@/lib/member-destinations";
import { getMemberProfile } from "@/lib/member-profiles-store";

export async function resolveLoginDestination(
  user: SessionUser,
  redirect?: string,
): Promise<string> {
  let destination = isStaffRole(user.role) ? defaultStaffLandingPath(user.role) : memberTodayPath();

  if (!isStaffRole(user.role)) {
    const profile = await getMemberProfile(user.id);
    const plan = profile?.plan || "explorer";
    const needsOnboard =
      (profile && !profile.onboardingComplete) ||
      (!profile && user.id.startsWith("member-"));
    const needsPayment = memberNeedsPayment(profile, user.id);
    const needsApproval = memberNeedsApproval(profile, user.id);

    if (needsPayment) {
      destination = memberCheckoutPath(plan);
    } else if (needsOnboard) {
      destination = plan
        ? `/member/onboard?plan=${encodeURIComponent(plan)}`
        : memberOnboardPath();
    } else if (needsApproval) {
      destination = MEMBER_PENDING_PATH;
    }

    if (redirect && redirect.startsWith("/") && !redirect.startsWith("//") && redirect.startsWith("/member")) {
      // Never let a deep link skip payment, onboard, or pending gates.
      // Exempt surfaces (checkout, book, chat, account, onboard) stay reachable.
      if (needsPayment && !isMemberPathExemptFromPaymentGate(redirect)) {
        // keep checkout
      } else if (
        needsOnboard &&
        !redirect.startsWith("/member/onboard") &&
        !redirect.startsWith("/member/checkout")
      ) {
        // keep onboard
      } else if (needsApproval && !redirect.startsWith("/member/pending")) {
        // keep pending
      } else {
        destination = redirect;
      }
    }
  } else if (redirect && redirect.startsWith("/") && !redirect.startsWith("//")) {
    if (redirect.startsWith("/admin")) {
      destination = normalizeCoachLoginRedirect(redirect);
    }
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
  const cookieStore = await cookies();
  applyEmailHistoryCookies(
    res,
    user.email,
    readEmailHistoryFromRequestCookies((name) => cookieStore.get(name)),
  );

  if (!isStaffRole(user.role)) {
    const profile = await getMemberProfile(user.id);
    const needsOnboard =
      (profile && !profile.onboardingComplete) ||
      (!profile && user.id.startsWith("member-"));
    const needsPayment = memberNeedsPayment(profile, user.id);
    if (needsOnboard && !needsPayment) {
      applyNewMemberOnboardingCookie(res, profile?.plan);
    }
    syncMemberGateCookies(res, { userId: user.id, profile });
  }

  return res;
}
