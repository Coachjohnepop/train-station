/**
 * Shared signup completion for main tickets AND /byow.
 * Keep both doors on this function so a signup change on main applies to BYOW.
 */
import "server-only";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  applyEmailHistoryCookies,
  readEmailHistoryFromRequestCookies,
} from "@/lib/email-history-cookies";
import {
  applyNewMemberOnboardingCookie,
  applySessionCookies,
  sessionFromStoredAccount,
  syncMemberGateCookies,
} from "@/lib/auth";
import { isPaidSignupPlan, memberCheckoutPath } from "@/lib/member-gates";
import { stripeConfiguredForPlan } from "@/lib/stripe";
import { registerMember } from "@/lib/member-accounts-store";
import { ensureMemberProfile, updateMemberProfile } from "@/lib/member-profiles-store";
import { notifyNewLead } from "@/lib/lead-notify";
import { notifyCoachNewSignup } from "@/lib/coach-member-notify";
import { sendMemberWelcomeEmail } from "@/lib/member-welcome";
import { isQuoteOffer } from "@/lib/product-offers";
import { resolveReferralDiscount } from "@/lib/referral-discounts";
import { normalizeSignupPlan, signupPlanLabel } from "@/lib/signup-plans";
import { addToWaitlist } from "@/lib/waitlist";
import { enrollUserInProgram } from "@/lib/data/user-data";
import { requireSignupPassword } from "@/lib/security-config";

import { BYOW_COOKIE } from "@/lib/byow-access";
import { AFFILIATE_REF_COOKIE } from "@/lib/affiliate/cookies";

export { BYOW_COOKIE };
export const BYOW_SIGNUP_CHANNEL = "byow" as const;

export type SignupChannel = "main" | typeof BYOW_SIGNUP_CHANNEL;

export type CompleteSignupInput = {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  plan?: string;
  password?: string;
  referralCode?: string;
  week?: boolean;
  channel?: SignupChannel;
};

export function applyByowCookie(res: { cookies: { set: (name: string, value: string, opts?: object) => void } }) {
  res.cookies.set(BYOW_COOKIE, "1", {
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
    sameSite: "lax",
  });
}

export async function completeMemberSignup(input: CompleteSignupInput): Promise<NextResponse> {
  const channel: SignupChannel = input.channel === "byow" ? "byow" : "main";
  const byow = channel === "byow";
  const email = input.email;
  const firstName = input.firstName;
  const lastName = input.lastName;
  const phone = input.phone;
  const password = input.password;
  const cookieRef = (await cookies()).get(AFFILIATE_REF_COOKIE)?.value;
  const referralCode = input.referralCode?.trim() || cookieRef || undefined;
  const weekTrial = Boolean(input.week);

  if (!byow && !input.plan?.trim()) {
    return NextResponse.json(
      { error: "Pick a ticket first (Free, Coach Class, or higher)." },
      { status: 400 },
    );
  }

  if (requireSignupPassword()) {
    if (!password || password.length < 8) {
      return NextResponse.json(
        { error: "Choose a password with at least 8 characters." },
        { status: 400 },
      );
    }
  }

  const plan = byow ? "explorer" : normalizeSignupPlan(input.plan);
  const quoteRequest = !byow && isQuoteOffer(plan);
  const referral = referralCode ? await resolveReferralDiscount(referralCode) : null;

  try {
    const account = await registerMember({
      email,
      firstName,
      lastName,
      phone,
      plan,
      password,
    });

    const profile = await ensureMemberProfile({
      userId: account.userId,
      email: email.trim().toLowerCase(),
      plan,
      phone: phone || account.phone,
    });

    await updateMemberProfile(account.userId, {
      paymentNote: byow ? "byow" : profile.paymentNote,
      onboardingComplete: byow ? true : profile.onboardingComplete,
      completedAt: byow ? new Date().toISOString() : profile.completedAt,
    });

    if (referral?.referralCode) {
      await updateMemberProfile(account.userId, {
        referralCode: referral.referralCode,
        referredByUserId: referral.ownerUserId,
      });
    }

    if (!byow) {
      await enrollUserInProgram("adult", account.userId);
    }

    const normalizedEmail = email.trim().toLowerCase();
    await addToWaitlist({
      email: normalizedEmail,
      firstName,
      lastName,
      phone: phone || null,
      plan,
      source: byow ? "byow-signup" : "signup-register",
    });
    await notifyNewLead({
      email: normalizedEmail,
      name: account.name,
      phone: phone || null,
      plan,
      source: byow ? "byow-signup" : quoteRequest ? `quote:${plan}` : "signup-register",
      createdAt: account.createdAt,
    });

    if (!byow) {
      await notifyCoachNewSignup({
        userId: account.userId,
        name: account.name,
        email: normalizedEmail,
        plan: signupPlanLabel(plan),
        phone: phone || account.phone || null,
        source: quoteRequest ? `quote:${plan}` : "signup",
      });
    }

    if (quoteRequest) {
      await updateMemberProfile(account.userId, {
        paymentNote: `${signupPlanLabel(plan)} — quote requested`,
      });
    }

    const sessionUser = sessionFromStoredAccount(email, account, password || "");
    if (!sessionUser) {
      return NextResponse.json({ error: "Account created but sign-in failed." }, { status: 500 });
    }

    const weekIsCoachTrial = !byow && weekTrial && plan === "member";
    const needsCheckout =
      !byow &&
      !quoteRequest &&
      ((isPaidSignupPlan(plan) && (await stripeConfiguredForPlan(plan))) ||
        (weekIsCoachTrial && (await stripeConfiguredForPlan("member"))));

    let freeNeedsCard = false;
    if (!byow && !needsCheckout && !quoteRequest && plan === "explorer") {
      try {
        const { getGamificationLevers } = await import("@/lib/gamification-config-store");
        const { isStripePaymentsEnabled } = await import("@/lib/member-gates");
        const levers = await getGamificationLevers();
        freeNeedsCard = Boolean(levers.freeRequiresPaymentMethod && isStripePaymentsEnabled());
      } catch {
        freeNeedsCard = false;
      }
    }

    if (!needsCheckout) {
      const welcomeSent = await sendMemberWelcomeEmail({
        email: normalizedEmail,
        name: account.name,
        plan,
        stage: "signup",
      });
      if (welcomeSent) {
        await updateMemberProfile(account.userId, {
          welcomeSignupEmailSentAt: new Date().toISOString(),
        });
      }
    }

    const redirectTo = byow
      ? "/byow"
      : plan === "speaking_fee"
        ? "/member/speaking"
        : quoteRequest || plan === "custom_training"
          ? `/member/quote-received?plan=${encodeURIComponent(plan)}`
          : weekIsCoachTrial
            ? `${memberCheckoutPath("member")}&trial=week`
            : needsCheckout
              ? memberCheckoutPath(plan)
              : freeNeedsCard
                ? "/member/payment-setup"
                : `/member/onboard?plan=${encodeURIComponent(plan)}`;

    const res = NextResponse.json({
      ok: true,
      redirectTo,
      channel,
      user: { email: sessionUser.email, name: sessionUser.name, role: sessionUser.role },
    });
    applySessionCookies(res, sessionUser);
    if (byow) applyByowCookie(res);
    const cookieStore = await cookies();
    applyEmailHistoryCookies(
      res,
      normalizedEmail,
      readEmailHistoryFromRequestCookies((name) => cookieStore.get(name)),
    );
    if (needsCheckout) {
      await syncMemberGateCookies(res, { userId: account.userId, profile });
    } else if (!byow) {
      applyNewMemberOnboardingCookie(res, plan);
      await syncMemberGateCookies(res, { userId: account.userId, profile });
    } else {
      await syncMemberGateCookies(res, { userId: account.userId, profile });
    }
    return res;
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Registration failed";
    const status = message.includes("already exists") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
