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
  memberNeedsApproval,
  memberNeedsFreePaymentMethodAsync,
  memberNeedsPaymentAsync,
} from "@/lib/member-gates";
import { isMemberPathExemptFromPaymentGate } from "@/lib/member-route-gates";
import { memberTodayPath } from "@/lib/member-destinations";
import { getMemberProfile } from "@/lib/member-profiles-store";
import { resolveMemberAppEntryPath } from "@/lib/member-app-entry-server";

export async function resolveLoginDestination(
  user: SessionUser,
  redirect?: string,
): Promise<string> {
  let destination = isStaffRole(user.role) ? defaultStaffLandingPath(user.role) : memberTodayPath();

  if (!isStaffRole(user.role)) {
    const profile = await getMemberProfile(user.id);
    const needsOnboard =
      (profile && !profile.onboardingComplete) ||
      (!profile && user.id.startsWith("member-"));
    const needsPayment = await memberNeedsPaymentAsync(profile, user.id);
    const needsFreePm = await memberNeedsFreePaymentMethodAsync(profile, user.id);
    const needsApproval = memberNeedsApproval(profile, user.id);

    destination = await resolveMemberAppEntryPath(user.id, profile);

    if (redirect && redirect.startsWith("/") && !redirect.startsWith("//") && redirect.startsWith("/member")) {
      // Never let a deep link skip payment, free card setup, onboard, or pending gates.
      // Exempt surfaces (checkout, book, chat, account, onboard) stay reachable.
      if (needsPayment && !isMemberPathExemptFromPaymentGate(redirect)) {
        // keep checkout
      } else if (
        needsFreePm &&
        !redirect.startsWith("/member/payment-setup") &&
        !isMemberPathExemptFromPaymentGate(redirect)
      ) {
        // keep free payment setup
      } else if (
        needsOnboard &&
        !redirect.startsWith("/member/onboard") &&
        !redirect.startsWith("/member/checkout") &&
        !redirect.startsWith("/member/payment-setup")
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
    const needsPayment = await memberNeedsPaymentAsync(profile, user.id);
    if (needsOnboard && !needsPayment) {
      applyNewMemberOnboardingCookie(res, profile?.plan);
    }
    await syncMemberGateCookies(res, { userId: user.id, profile });
  }

  return res;
}
