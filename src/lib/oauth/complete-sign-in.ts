import "server-only";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { normalizeAccountEmail } from "@/lib/account-email";
import {
  applyNewMemberOnboardingCookie,
  applySessionCookies,
  isStaffRole,
  syncMemberGateCookies,
  type SessionUser,
} from "@/lib/auth";
import { resolveLoginDestination } from "@/lib/complete-login";
import {
  applyEmailHistoryCookies,
  readEmailHistoryFromRequestCookies,
} from "@/lib/email-history-cookies";
import { enrollDemo } from "@/lib/demo-enrollments";
import { notifyNewLead } from "@/lib/lead-notify";
import { memberCheckoutPath } from "@/lib/member-gates";
import { appBaseUrl } from "@/lib/oauth/config";
import { getAllSignInAccounts, registerMember, upsertSignInAccount } from "@/lib/member-accounts-store";
import { ensureMemberProfile, updateMemberProfile } from "@/lib/member-profiles-store";
import { getOAuthIdentity, linkOAuthIdentity } from "@/lib/oauth-identity-store";
import type { OAuthProfile } from "@/lib/oauth/types";
import { sendMemberWelcomeEmail } from "@/lib/member-welcome";
import { isQuoteOffer } from "@/lib/product-offers";
import { normalizeSignupPlan, signupPlanLabel } from "@/lib/signup-plans";
import { stripeConfiguredForPlan } from "@/lib/stripe";
import { addToWaitlist } from "@/lib/waitlist";

function sessionFromAccount(
  email: string,
  account: { userId: string; role: SessionUser["role"]; name?: string },
  fallbackName: string,
): SessionUser {
  return {
    id: account.userId,
    email,
    name: account.name?.trim() || fallbackName || "Member",
    role: account.role,
  };
}

export async function completeOAuthSignIn(
  profile: OAuthProfile,
  options: { redirect?: string; plan?: string },
): Promise<NextResponse> {
  const normalizedEmail = normalizeAccountEmail(profile.email);
  if (!normalizedEmail) {
    return oauthErrorRedirect("missing_email");
  }

  const linked = await getOAuthIdentity(profile.provider, profile.providerUserId);
  let sessionUser: SessionUser | null = null;

  if (linked) {
    sessionUser = await sessionForUserId(linked.userId, normalizedEmail, profile.name);
  }

  if (!sessionUser) {
    const accounts = await getAllSignInAccounts({ preferFresh: true });
    const existing = accounts[normalizedEmail];
    if (existing) {
      sessionUser = sessionFromAccount(normalizedEmail, existing, profile.name);
      await linkOAuthIdentity({
        provider: profile.provider,
        providerUserId: profile.providerUserId,
        userId: existing.userId,
        email: normalizedEmail,
      });
      if (profile.name && profile.name !== existing.name) {
        await upsertSignInAccount({
          email: normalizedEmail,
          userId: existing.userId,
          role: existing.role,
          name: profile.name,
        });
      }
    }
  }

  if (!sessionUser) {
    return provisionNewOAuthMember(profile, normalizedEmail, options.plan);
  }

  return redirectWithSession(sessionUser, options.redirect);
}

async function provisionNewOAuthMember(
  profile: OAuthProfile,
  normalizedEmail: string,
  rawPlan?: string,
): Promise<NextResponse> {
  const plan = normalizeSignupPlan(rawPlan);
  const account = await registerMember({
    email: normalizedEmail,
    firstName: profile.firstName || "Member",
    lastName: profile.lastName || "",
    plan,
  });

  const memberProfile = await ensureMemberProfile({
    userId: account.userId,
    email: normalizedEmail,
    plan,
    phone: account.phone,
  });

  await enrollDemo("adult", account.userId);
  await addToWaitlist({
    email: normalizedEmail,
    firstName: profile.firstName || "Member",
    lastName: profile.lastName || "",
    phone: null,
    plan,
    source: `oauth:${profile.provider}`,
  });
  await notifyNewLead({
    email: normalizedEmail,
    name: profile.name || account.name,
    phone: null,
    plan,
    source: `oauth:${profile.provider}`,
    createdAt: account.createdAt,
  });

  const quoteRequest = isQuoteOffer(plan);
  const needsCheckout = !quoteRequest && (await stripeConfiguredForPlan(plan));

  if (!needsCheckout) {
    const welcomeSent = await sendMemberWelcomeEmail({
      email: normalizedEmail,
      name: profile.name || account.name,
      plan,
      stage: "signup",
    });
    if (welcomeSent) {
      await updateMemberProfile(account.userId, {
        welcomeSignupEmailSentAt: new Date().toISOString(),
      });
    }
  }

  if (quoteRequest) {
    await updateMemberProfile(account.userId, {
      paymentNote: `${signupPlanLabel(plan)} — quote requested`,
    });
  }

  await linkOAuthIdentity({
    provider: profile.provider,
    providerUserId: profile.providerUserId,
    userId: account.userId,
    email: normalizedEmail,
  });

  if (profile.name && profile.name !== account.name) {
    await upsertSignInAccount({
      email: normalizedEmail,
      userId: account.userId,
      role: account.role,
      name: profile.name,
    });
  }

  const sessionUser = sessionFromAccount(normalizedEmail, account, profile.name);
  const redirectTo = quoteRequest
    ? `/member/quote-received?plan=${encodeURIComponent(plan)}`
    : needsCheckout
      ? memberCheckoutPath(plan)
      : `/member/onboard?plan=${encodeURIComponent(plan)}`;

  const res = NextResponse.redirect(new URL(redirectTo, appBaseUrl()));
  applySessionCookies(res, sessionUser);
  const cookieStore = await cookies();
  applyEmailHistoryCookies(
    res,
    normalizedEmail,
    readEmailHistoryFromRequestCookies((name) => cookieStore.get(name)),
  );
  if (needsCheckout) {
    syncMemberGateCookies(res, { userId: account.userId, profile: memberProfile });
  } else {
    applyNewMemberOnboardingCookie(res, plan);
    syncMemberGateCookies(res, { userId: account.userId, profile: memberProfile });
  }
  return res;
}

async function redirectWithSession(
  sessionUser: SessionUser,
  redirect?: string,
): Promise<NextResponse> {
  const destination = await resolveLoginDestination(sessionUser, redirect);
  const res = NextResponse.redirect(new URL(destination, appBaseUrl()));
  applySessionCookies(res, sessionUser);
  const cookieStore = await cookies();
  applyEmailHistoryCookies(
    res,
    sessionUser.email,
    readEmailHistoryFromRequestCookies((name) => cookieStore.get(name)),
  );

  if (!isStaffRole(sessionUser.role)) {
    const { getMemberProfile } = await import("@/lib/member-profiles-store");
    const { memberNeedsPayment } = await import("@/lib/member-gates");
    const profile = await getMemberProfile(sessionUser.id);
    const needsOnboard =
      (profile && !profile.onboardingComplete) || sessionUser.id.startsWith("member-");
    const needsPayment = memberNeedsPayment(profile, sessionUser.id);
    if (needsOnboard && !needsPayment) {
      applyNewMemberOnboardingCookie(res, profile?.plan);
    }
    syncMemberGateCookies(res, { userId: sessionUser.id, profile });
  }

  return res;
}

async function sessionForUserId(
  userId: string,
  email: string,
  fallbackName: string,
): Promise<SessionUser | null> {
  const accounts = await getAllSignInAccounts({ preferFresh: true });
  for (const [accountEmail, account] of Object.entries(accounts)) {
    if (account.userId === userId) {
      return sessionFromAccount(normalizeAccountEmail(accountEmail) || email, account, fallbackName);
    }
  }
  return null;
}

function oauthErrorRedirect(code: string): NextResponse {
  const url = new URL("/login", appBaseUrl());
  url.searchParams.set("oauthError", code);
  return NextResponse.redirect(url);
}