import { NextResponse } from "next/server";
import { z } from "zod";
import {
  applyNewMemberOnboardingCookie,
  applySessionCookies,
  authenticateCredentials,
} from "@/lib/auth";
import { registerMember } from "@/lib/member-accounts-store";
import { ensureMemberProfile } from "@/lib/member-profiles-store";
import { notifyNewLead } from "@/lib/lead-notify";
import { normalizeSignupPlan } from "@/lib/signup-plans";
import { addToWaitlist } from "@/lib/waitlist";

const schema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1).max(60),
  lastName: z.string().min(1).max(60),
  phone: z.string().max(30).optional(),
  plan: z.string().max(40).optional(),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Please fill in email and name." }, { status: 400 });
  }

  const { email, firstName, lastName, phone, plan: rawPlan } = parsed.data;
  const plan = normalizeSignupPlan(rawPlan);

  try {
    const account = await registerMember({
      email,
      firstName,
      lastName,
      phone,
      plan,
    });

    await ensureMemberProfile({
      userId: account.userId,
      email: email.trim().toLowerCase(),
      plan,
      phone: phone || account.phone,
    });

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

    const sessionUser = await authenticateCredentials(email, "");
    if (!sessionUser) {
      return NextResponse.json({ error: "Account created but sign-in failed." }, { status: 500 });
    }

    const redirectTo = `/member/onboard?plan=${encodeURIComponent(plan)}`;
    const res = NextResponse.json({
      ok: true,
      redirectTo,
      user: { email: sessionUser.email, name: sessionUser.name, role: sessionUser.role },
    });
    applySessionCookies(res, sessionUser);
    applyNewMemberOnboardingCookie(res);
    return res;
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Registration failed";
    const status = message.includes("already exists") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}