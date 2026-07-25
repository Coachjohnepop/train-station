import { NextResponse } from "next/server";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import { listSelfRegisteredAccounts } from "@/lib/member-accounts-store";
import { listMemberProfiles } from "@/lib/member-profiles-store";
import { signupPlanLabel } from "@/lib/signup-plans";
import { getMemberCoachPrefsMap } from "@/lib/member-coach-prefs-store";
import { coachingModeFromPrefs } from "@/lib/member-coaching-mode";

export const dynamic = "force-dynamic";

async function requireStaff() {
  const session = await getSessionUser();
  if (!session || !isStaffRole(session.role)) return null;
  return session;
}

export async function GET() {
  const session = await requireStaff();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [accounts, profiles, prefsMap] = await Promise.all([
    listSelfRegisteredAccounts(),
    listMemberProfiles(),
    getMemberCoachPrefsMap(),
  ]);
  const profileByUserId = new Map(profiles.map((p) => [p.userId, p]));

  const members = accounts.map(({ email, account }) => {
    const profile = profileByUserId.get(account.userId) ?? null;
    return {
      userId: account.userId,
      email,
      name: account.name,
      phone: profile?.phone ?? account.phone ?? null,
      plan: profile?.plan ?? "explorer",
      planLabel: signupPlanLabel(profile?.plan ?? "explorer"),
      approvalStatus: profile?.approvalStatus ?? "approved",
      paymentStatus: profile?.paymentStatus ?? "none",
      paymentMethod: profile?.paymentMethod ?? null,
      paymentNote: profile?.paymentNote ?? null,
      staffGrantExpiresAt: profile?.staffGrantExpiresAt ?? null,
      staffGrantedAt: profile?.staffGrantedAt ?? null,
      staffGrantedBy: profile?.staffGrantedBy ?? null,
      onboardingComplete: profile?.onboardingComplete ?? false,
      paidAt: profile?.paidAt ?? null,
      approvedAt: profile?.approvedAt ?? null,
      createdAt: account.createdAt,
      completedAt: profile?.completedAt ?? null,
      coachIntakeCompleteAt: profile?.coachIntakeCompleteAt ?? null,
      introBookedAt: profile?.introBookedAt ?? null,
      coachMeetingRequestedAt: profile?.coachMeetingRequestedAt ?? null,
      coachMeetingRequestNote: profile?.coachMeetingRequestNote ?? null,
      rampStartedAt: profile?.rampStartedAt ?? null,
      coachingMode: coachingModeFromPrefs(prefsMap.get(account.userId), account.userId),
    };
  });

  members.sort((a, b) => {
    const aPending = a.approvalStatus === "pending" ? 0 : 1;
    const bPending = b.approvalStatus === "pending" ? 0 : 1;
    if (aPending !== bPending) return aPending - bPending;
    return b.createdAt.localeCompare(a.createdAt);
  });

  return NextResponse.json({ members });
}