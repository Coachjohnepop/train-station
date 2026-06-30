import MemberShell from "@/components/MemberShell";
import { getMemberDashboard } from "@/lib/member-context";
import { getSessionUser } from "@/lib/auth";
import { isStaffRole } from "@/lib/auth-session";
import { getCurrentUserId } from "@/lib/current-user";
import { resolveDemoUser } from "@/lib/demo-user-directory";
import { getMemberProfile } from "@/lib/member-profiles-store";
import { isCoachIntakeComplete } from "@/lib/member-intake";
import { membershipThemeTierFromPlan } from "@/lib/membership-theme";
import { memberNeedsPayment } from "@/lib/member-gates";
import type { SignupPlan } from "@/lib/signup-plans";

export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [dashboard, session, cookieUid] = await Promise.all([
    getMemberDashboard(),
    getSessionUser(),
    getCurrentUserId(),
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
  const paymentGateActive = profileUserId
    ? memberNeedsPayment(profile, profileUserId)
    : false;
  const checkoutPlan = (profile?.plan ?? "member") as SignupPlan;

  return (
    <MemberShell
      tierLabel={tierLabel}
      memberName={name}
      memberEmail={email}
      membershipTier={membershipTier}
      intakePending={intakePending}
      paymentGateActive={paymentGateActive}
      checkoutPlan={checkoutPlan}
    >
      {children}
    </MemberShell>
  );
}