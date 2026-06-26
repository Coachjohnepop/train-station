import MemberShell from "@/components/MemberShell";
import { getMemberDashboard } from "@/lib/member-context";
import { getSessionUser } from "@/lib/auth";
import { isStaffRole } from "@/lib/auth-session";
import { getCurrentUserId } from "@/lib/current-user";
import { resolveDemoUser } from "@/lib/demo-user-directory";
import { getMemberProfile } from "@/lib/member-profiles-store";
import { membershipThemeTierFromPlan } from "@/lib/membership-theme";

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
  const access = dashboard?.access ?? {
    tier: "coach" as const,
    isPreview: true,
    tierLabel: "Coach Class",
    canAccessProgram: () => true,
    canAccessFeature: () => true,
  };
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
    cookieUid || (session?.role === "MEMBER" ? session.id : null);
  const profile = profileUserId ? await getMemberProfile(profileUserId) : null;
  const membershipTier = membershipThemeTierFromPlan(profile?.plan);

  return (
    <MemberShell
      access={access}
      memberName={name}
      memberEmail={email}
      membershipTier={membershipTier}
    >
      {children}
    </MemberShell>
  );
}