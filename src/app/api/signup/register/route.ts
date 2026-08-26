import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
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

const schema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1).max(60),
  lastName: z.string().min(1).max(60),
  phone: z.string().max(30).optional(),
  plan: z.string().max(40).optional(),
  password: z.string().max(128).optional(),
  referralCode: z.string().max(40).optional(),
  week: z.boolean().optional(),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Please fill in email and name." }, { status: 400 });
  }

  const { email, firstName, lastName, phone, plan: rawPlan, password, referralCode, week } =
    parsed.data;
  const weekTrial = Boolean(week);
  // Require an intentional ticket — never silent Free default from empty plan.
  if (!rawPlan?.trim()) {
    return NextResponse.json(
      { error: "Pick a ticket first (Free, Coach Class, or higher)." },
      { status: 400 },
    );
  }
  const plan = normalizeSignupPlan(rawPlan);
  const quoteRequest = isQuoteOffer(plan);
  const referral = referralCode ? await resolveReferralDiscount(referralCode) : null;

  if (requireSignupPassword()) {
    if (!password || password.length < 8) {
      return NextResponse.json(
        { error: "Choose a password with at least 8 characters." },
        { status: 400 },
      );
    }
  }

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

    if (referral?.referralCode) {
      await updateMemberProfile(account.userId, {
        referralCode: referral.referralCode,
        referredByUserId: referral.ownerUserId,
      });
    }

    await enrollUserInProgram("adult", account.userId);

    // Free week is a Coach Class subscription trial (card + authorize the
    // future charge). Do not grant access until Checkout completes.

    const normalizedEmail = email.trim().toLowerCase();
    await addToWaitlist({
      email: normalizedEmail,
      firstName,
      lastName,
      phone: phone || null,
      plan,
      source: "signup-register",
    });
    await notifyNewLead({
      email: normalizedEmail,
      name: account.name,
      phone: phone || null,
      plan,
      source: quoteRequest ? `quote:${plan}` : "signup-register",
      createdAt: account.createdAt,
    });

    // Coach email + in-app Messages (Queue) — separate from lead lead-notify list.
    await notifyCoachNewSignup({
      userId: account.userId,
      name: account.name,
      email: normalizedEmail,
      plan: signupPlanLabel(plan),
      phone: phone || account.phone || null,
      source: quoteRequest ? `quote:${plan}` : "signup",
    });

    if (quoteRequest) {
      await updateMemberProfile(account.userId, {
        paymentNote: `${signupPlanLabel(plan)} — quote requested`,
      });
    }

    const sessionUser = sessionFromStoredAccount(email, account, password || "");
    if (!sessionUser) {
      return NextResponse.json({ error: "Account created but sign-in failed." }, { status: 500 });
    }

    // Paid only — free Explorer goes straight to onboard (never auto-checkout),
    // unless admin requires Free card-on-file → /member/payment-setup.
    // Short trial is Coach Class checkout only (plan=member), not a landing CTA.
    const weekIsCoachTrial = weekTrial && plan === "member";
    const needsCheckout =
      !quoteRequest &&
      ((isPaidSignupPlan(plan) && (await stripeConfiguredForPlan(plan))) ||
        (weekIsCoachTrial && (await stripeConfiguredForPlan("member"))));

    let freeNeedsCard = false;
    if (!needsCheckout && !quoteRequest && plan === "explorer") {
      try {
        const { getGamificationLevers } = await import("@/lib/gamification-config-store");
        const { isStripePaymentsEnabled } = await import("@/lib/member-gates");
        const levers = await getGamificationLevers();
        freeNeedsCard = Boolean(levers.freeRequiresPaymentMethod && isStripePaymentsEnabled());
      } catch {
        freeNeedsCard = false;
      }
    }

    // Paid plans: welcome email fires after Stripe payment (markMemberPaid).
    // Free/quote paths: only send once signup fully succeeded.
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
    // Speaking: intake wizard first, then same 15-min book flow as new members.
    const redirectTo =
      plan === "speaking_fee"
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
      user: { email: sessionUser.email, name: sessionUser.name, role: sessionUser.role },
    });
    applySessionCookies(res, sessionUser);
    const cookieStore = await cookies();
    applyEmailHistoryCookies(
      res,
      normalizedEmail,
      readEmailHistoryFromRequestCookies((name) => cookieStore.get(name)),
    );
    if (needsCheckout) {
      await syncMemberGateCookies(res, { userId: account.userId, profile });
    } else {
      applyNewMemberOnboardingCookie(res, plan);
      await syncMemberGateCookies(res, { userId: account.userId, profile });
    }
    return res;
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Registration failed";
    const status = message.includes("already exists") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}