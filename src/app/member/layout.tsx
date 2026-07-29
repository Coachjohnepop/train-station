import { headers } from "next/headers";
import { redirect } from "next/navigation";
import MemberShell from "@/components/MemberShell";
import { getMemberDashboard } from "@/lib/member-context";
import { getSessionUser } from "@/lib/auth";
import { isStaffRole } from "@/lib/auth-session";
import { getCurrentUserId } from "@/lib/current-user";
import { resolveDemoUser } from "@/lib/demo-user-directory";
import { getMemberProfile } from "@/lib/member-profiles-store";
import { isCoachIntakeComplete } from "@/lib/member-intake";
import { membershipThemeTierFromPlan } from "@/lib/membership-theme";
import { memberNeedsPaymentAsync } from "@/lib/member-gates";
import { isMemberPathExemptFromPaymentGate } from "@/lib/member-route-gates";
import type { SignupPlan } from "@/lib/signup-plans";

export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [dashboard, session, cookieUid, headerStore] = await Promise.all([
    getMemberDashboard(),
    getSessionUser(),
    getCurrentUserId(),
    headers(),
  ]);
  const tierLabel = dashboard?.access.tierLabel ?? "Coach Class";
  const viewedMember = cookieUid ? resolveDemoUser(cookieUid) : undefined;
  const impersonating =
    session && isStaffRole(session.role) && viewedMember && viewedMember.id !== session.id;

  const name = impersonating
    ? viewedMember.name
    : session?.name || dashboard?.user.name || "Member";
  const email = impersonating
    ? viewedMember.email
    : session?.email || dashboard?.user.email || viewedMember?.email;

  const profileUserId =
    session?.role === "MEMBER"
      ? session.id
      : cookieUid || null;
  const profile = profileUserId ? await getMemberProfile(profileUserId) : null;
  const membershipTier = membershipThemeTierFromPlan(profile?.plan);
  const intakePending =
    !!profileUserId &&
    profileUserId.startsWith("member-") &&
    !isCoachIntakeComplete(profile);
  // Free-week promos unlock training without a paid stamp.
  const paymentGateActive = profileUserId
    ? await memberNeedsPaymentAsync(profile, profileUserId)
    : false;
  const checkoutPlan = (profile?.plan ?? "member") as SignupPlan;

  // Server-side onboard gate (DB), not cookie-only. Incomplete free Explorer
  // must finish the wizard before Today / training.
  if (
    session?.role === "MEMBER" &&
    profileUserId?.startsWith("member-") &&
    (!profile || !profile.onboardingComplete)
  ) {
    const pathname =
      headerStore.get("x-pathname") ||
      headerStore.get("x-invoke-path") ||
      headerStore.get("next-url") ||
      "";
    const pathOnly = pathname.startsWith("http")
      ? new URL(pathname).pathname
      : pathname;
    const onExempt =
      !pathOnly ||
      pathOnly === "/member" ||
      pathOnly.startsWith("/member/onboard") ||
      isMemberPathExemptFromPaymentGate(pathOnly);
    // Exempt includes checkout/account/chat/book/pending/onboard — allow those.
    // Block Today, programs, workout, equipment, live, etc.
    if (!onExempt && pathOnly.startsWith("/member")) {
      const plan = profile?.plan || "explorer";
      redirect(`/member/onboard?plan=${encodeURIComponent(plan)}`);
    }
  }

  return (
    <MemberShell
      tierLabel={tierLabel}
      memberName={name}
      memberEmail={email}
      memberUserId={profileUserId}
      membershipTier={membershipTier}
      intakePending={intakePending}
      paymentGateActive={paymentGateActive}
      checkoutPlan={checkoutPlan}
    >
      {children}
    </MemberShell>
  );
}