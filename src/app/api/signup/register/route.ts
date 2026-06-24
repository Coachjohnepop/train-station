import { NextResponse } from "next/server";
import { z } from "zod";
import {
  applyNewMemberOnboardingCookie,
  applySessionCookies,
  authenticateCredentials,
  syncMemberGateCookies,
} from "@/lib/auth";
import { memberCheckoutPath } from "@/lib/member-gates";
import { stripeConfiguredForPlan } from "@/lib/stripe";
import { registerMember } from "@/lib/member-accounts-store";
import { ensureMemberProfile, updateMemberProfile } from "@/lib/member-profiles-store";
import { notifyNewLead } from "@/lib/lead-notify";
import { sendMemberWelcomeEmail } from "@/lib/member-welcome";
import { normalizeSignupPlan } from "@/lib/signup-plans";
import { addToWaitlist } from "@/lib/waitlist";
import { enrollDemo } from "@/lib/demo-enrollments";
import { requireSignupPassword } from "@/lib/security-config";

const schema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1).max(60),
  lastName: z.string().min(1).max(60),
  phone: z.string().max(30).optional(),
  plan: z.string().max(40).optional(),
  password: z.string().max(128).optional(),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Please fill in email and name." }, { status: 400 });
  }

  const { email, firstName, lastName, phone, plan: rawPlan, password } = parsed.data;
  const plan = normalizeSignupPlan(rawPlan);

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

    enrollDemo("adult", account.userId);

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
      source: "signup-register",
      createdAt: account.createdAt,
    });

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

    const sessionUser = await authenticateCredentials(email, password || "");
    if (!sessionUser) {
      return NextResponse.json({ error: "Account created but sign-in failed." }, { status: 500 });
    }

    const needsCheckout = stripeConfiguredForPlan(plan);
    const redirectTo = needsCheckout
      ? memberCheckoutPath(plan)
      : `/member/onboard?plan=${encodeURIComponent(plan)}`;
    const res = NextResponse.json({
      ok: true,
      redirectTo,
      user: { email: sessionUser.email, name: sessionUser.name, role: sessionUser.role },
    });
    applySessionCookies(res, sessionUser);
    if (needsCheckout) {
      syncMemberGateCookies(res, { userId: account.userId, profile });
    } else {
      applyNewMemberOnboardingCookie(res, plan);
      syncMemberGateCookies(res, { userId: account.userId, profile });
    }
    return res;
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Registration failed";
    const status = message.includes("already exists") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}