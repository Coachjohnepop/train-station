import { NextResponse } from "next/server";
import { normalizeAccountEmail } from "@/lib/account-email";
import {
  applyNewMemberOnboardingCookie,
  applySessionCookies,
  authenticateCredentials,
  isStaffRole,
} from "@/lib/auth";
import { getMemberProfile } from "@/lib/member-profiles-store";
import { isInvitedAccountEmail } from "@/lib/invited-accounts";
import { applyRememberedEmailCookie } from "@/lib/remembered-email";

export async function POST(request: Request) {
  const body = await request.json();
  const email = String(body.email || "");
  const password = String(body.password || "");
  const redirect = typeof body.redirect === "string" ? body.redirect : "";

  const normalized = normalizeAccountEmail(email);
  if (!(await isInvitedAccountEmail(normalized))) {
    return NextResponse.json(
      {
        error: "No account found. Create one from the home page ticket picker.",
        code: "not_invited",
        signupUrl: `/signup?email=${encodeURIComponent(normalized)}`,
      },
      { status: 403 },
    );
  }

  const user = await authenticateCredentials(email, password);
  if (!user) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  let destination = isStaffRole(user.role) ? "/admin" : "/member";

  if (!isStaffRole(user.role)) {
    const profile = await getMemberProfile(user.id);
    const needsOnboard =
      (profile && !profile.onboardingComplete) ||
      (!profile && user.id.startsWith("member-"));
    if (needsOnboard) {
      const plan = profile?.plan || "explorer";
      destination = `/member/onboard?plan=${encodeURIComponent(plan)}`;
    }
  }

  if (redirect && redirect.startsWith("/") && !redirect.startsWith("//")) {
    if (isStaffRole(user.role) && redirect.startsWith("/admin")) destination = redirect;
    else if (!isStaffRole(user.role) && redirect.startsWith("/member")) destination = redirect;
    else if (redirect.startsWith("/member/chat")) destination = redirect;
  }

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
      applyNewMemberOnboardingCookie(res);
    }
  }

  return res;
}