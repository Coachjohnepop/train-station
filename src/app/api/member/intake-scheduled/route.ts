import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { awardGamificationPoints } from "@/lib/member-gamification-store";
import { ensureMemberProfile, updateMemberProfile } from "@/lib/member-profiles-store";
import { normalizeSignupPlan, signupPlanLabel } from "@/lib/signup-plans";
import { getAccountByUserId } from "@/lib/member-accounts-store";
import { notifyCoachIntakeReady } from "@/lib/coach-member-notify";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  await ensureMemberProfile({
    userId: session.id,
    email: session.email,
    plan: normalizeSignupPlan(null),
  });

  const bookedAt = new Date().toISOString();
  const profile = await updateMemberProfile(session.id, {
    introBookedAt: bookedAt,
    coachMeetingRequestedAt: null,
    coachMeetingRequestedBy: null,
    coachMeetingRequestNote: null,
  });

  const account = await getAccountByUserId(session.id);
  await notifyCoachIntakeReady({
    userId: session.id,
    name: account?.account.name || session.name || "Member",
    email: session.email,
    plan: signupPlanLabel(profile.plan),
    paymentStatus: profile.paymentStatus,
  });

  const result = await awardGamificationPoints({
    userId: session.id,
    eventId: "intake:scheduled",
    type: "intake_scheduled",
    label: "Booked intro call",
  });

  return NextResponse.json({
    introBookedAt: bookedAt,
    ok: true,
    awarded: result.awarded,
    totalPoints: result.totalPoints,
    pointsEarned: result.pointsEarned,
  });
}