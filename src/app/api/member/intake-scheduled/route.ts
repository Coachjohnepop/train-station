import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { GAMIFICATION_POINTS } from "@/lib/gamification-types";
import { awardGamificationPoints } from "@/lib/member-gamification-store";
import { ensureMemberProfile, updateMemberProfile } from "@/lib/member-profiles-store";
import { normalizeSignupPlan } from "@/lib/signup-plans";

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
  await updateMemberProfile(session.id, {
    introBookedAt: bookedAt,
    coachMeetingRequestedAt: null,
    coachMeetingRequestedBy: null,
    coachMeetingRequestNote: null,
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
    pointsEarned: result.awarded ? GAMIFICATION_POINTS.intake_scheduled : 0,
  });
}