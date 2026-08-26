import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getUserGamification } from "@/lib/member-gamification-store";
import { getMemberProfile, updateMemberProfile } from "@/lib/member-profiles-store";
import { getLatestMemberBooking } from "@/lib/booking";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const profile = await getMemberProfile(session.id);
  let introBookedAt = profile?.introBookedAt ?? null;

  if (!introBookedAt) {
    const gamification = await getUserGamification(session.id);
    const scheduled = gamification.events.find((e) => e.id === "intake:scheduled");
    if (scheduled) {
      introBookedAt = scheduled.at;
      if (profile) {
        await updateMemberProfile(session.id, { introBookedAt });
      }
    }
  }

  let rescheduleUrl: string | null = null;
  let scheduledAt: string | null = null;
  try {
    const booking = await getLatestMemberBooking(session.id, session.email);
    rescheduleUrl = booking?.calendlyRescheduleUrl?.trim() || null;
    scheduledAt = booking?.scheduledAt
      ? new Date(booking.scheduledAt).toISOString()
      : null;
  } catch {
    /* ignore */
  }

  return NextResponse.json({
    introBookedAt,
    scheduledAt,
    rescheduleUrl,
    coachMeetingRequestedAt: profile?.coachMeetingRequestedAt ?? null,
    coachMeetingRequestNote: profile?.coachMeetingRequestNote ?? null,
    coachIntakeCompleteAt: profile?.coachIntakeCompleteAt ?? null,
  });
}