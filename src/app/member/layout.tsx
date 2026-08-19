import { cookies, headers } from "next/headers";
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
import {
  memberNeedsFreePaymentMethodAsync,
  memberNeedsPaymentAsync,
} from "@/lib/member-gates";
import {
  isMemberPathExemptFromPaymentGate,
  memberFreePaymentSetupPath,
} from "@/lib/member-route-gates";
import type { SignupPlan } from "@/lib/signup-plans";
import { SITE_SEEN_COOKIE, isFirstTimeOnSite } from "@/lib/site-visit";

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
  const freePmGateActive =
    !!profileUserId &&
    (await memberNeedsFreePaymentMethodAsync(profile, profileUserId));
  const checkoutPlan = (profile?.plan ?? "member") as SignupPlan;

  const pathname =
    headerStore.get("x-pathname") ||
    headerStore.get("x-invoke-path") ||
    headerStore.get("next-url") ||
    "";
  const pathOnly = pathname.startsWith("http")
    ? new URL(pathname).pathname
    : pathname;
  const setupMode =
    pathOnly.startsWith("/member/onboard") ||
    pathOnly.startsWith("/member/speaking") ||
    pathOnly.startsWith("/member/payment-setup") ||
    pathOnly.startsWith("/member/quote-received") ||
    pathOnly.startsWith("/member/checkout");
  const cookieStore = await cookies();
  const firstTimeOnSite = isFirstTimeOnSite(cookieStore.get(SITE_SEEN_COOKIE)?.value);
  // Newbie = first visit to the site, not "setup unfinished".
  // After they finish setup (or come back later) they get the full app.
  const newbieMode = firstTimeOnSite && !profile?.onboardingComplete;

  // Free Explorer card-on-file (admin lever) — before onboard/Today.
  if (
    session?.role === "MEMBER" &&
    profileUserId?.startsWith("member-") &&
    freePmGateActive &&
    pathOnly.startsWith("/member") &&
    !pathOnly.startsWith("/member/payment-setup") &&
    !isMemberPathExemptFromPaymentGate(pathOnly)
  ) {
    redirect(memberFreePaymentSetupPath());
  }

  // Server-side onboard gate (DB), not cookie-only. Incomplete free Explorer
  // must finish the wizard before Today / training.
  if (
    session?.role === "MEMBER" &&
    profileUserId?.startsWith("member-") &&
    !freePmGateActive &&
    (!profile || !profile.onboardingComplete)
  ) {
    const onExempt =
      pathOnly === "/member" ||
      pathOnly.startsWith("/member/onboard") ||
      pathOnly.startsWith("/member/speaking") ||
      isMemberPathExemptFromPaymentGate(pathOnly);
    // Empty pathname: still gate (don't treat "unknown" as exempt).
    // Exempt includes checkout/account/chat/book/pending/onboard/speaking.
    // Block Today, programs, workout, equipment, live, etc.
    if (!onExempt && (!pathOnly || pathOnly.startsWith("/member"))) {
      const plan = profile?.plan || "explorer";
      if (plan === "speaking_fee") {
        redirect("/member/speaking");
      }
      redirect(`/member/onboard?plan=${encodeURIComponent(plan)}`);
    }
  }

  if (
    session?.role === "MEMBER" &&
    profileUserId?.startsWith("member-") &&
    profile?.onboardingComplete &&
    profile.coachIntakeCompleteAt &&
    !pathOnly.startsWith("/member/measurements") &&
    pathOnly !== "/member/book" &&
    pathOnly !== "/member/chat" &&
    pathOnly !== "/member/account" &&
    !pathOnly.startsWith("/member/checkout")
  ) {
    const { listUserMeasurements } = await import("@/lib/measurements-store");
    const { memberNeedsFirstTapeMeasurements } = await import(
      "@/lib/member-measurement-schedule"
    );
    const checkIns = await listUserMeasurements(profileUserId, 1);
    if (
      memberNeedsFirstTapeMeasurements({
        onboardingComplete: true,
        coachIntakeCompleteAt: profile.coachIntakeCompleteAt,
        hasCheckIn: checkIns.length > 0,
      })
    ) {
      redirect("/member/measurements?first=1");
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
      setupMode={setupMode}
      newbieMode={newbieMode}
    >
      {children}
    </MemberShell>
  );
}