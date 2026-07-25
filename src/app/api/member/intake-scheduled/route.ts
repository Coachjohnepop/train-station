import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { awardGamificationPoints } from "@/lib/member-gamification-store";
import { ensureMemberProfile, updateMemberProfile } from "@/lib/member-profiles-store";
import { normalizeSignupPlan, signupPlanLabel } from "@/lib/signup-plans";
import { getAccountByUserId } from "@/lib/member-accounts-store";
import { notifyCoachIntakeReady } from "@/lib/coach-member-notify";
import { createBooking, getAdminContact } from "@/lib/booking";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  /** ISO meeting start when known (Calendly payload or app slot). */
  scheduledAt: z.string().datetime().optional().nullable(),
  bookingSource: z.enum(["calendly", "app_slots", "manual"]).optional(),
  phone: z.string().max(40).optional().nullable(),
  calendlyEventUri: z.string().url().optional().nullable(),
});

export async function POST(request: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  const body = parsed.success ? parsed.data : {};

  await ensureMemberProfile({
    userId: session.id,
    email: session.email,
    plan: normalizeSignupPlan(null),
  });

  const bookedAt = new Date().toISOString();
  const meetingIso =
    body.scheduledAt && !Number.isNaN(new Date(body.scheduledAt).getTime())
      ? new Date(body.scheduledAt).toISOString()
      : null;

  const profile = await updateMemberProfile(session.id, {
    introBookedAt: bookedAt,
    coachMeetingRequestedAt: null,
    coachMeetingRequestedBy: null,
    coachMeetingRequestNote: null,
  });

  // Persist a Booking row when we know the meeting time (shows on Admin → Bookings).
  if (meetingIso) {
    try {
      const contact = await getAdminContact();
      await createBooking({
        memberEmail: session.email,
        memberPhone: body.phone || undefined,
        scheduledAt: new Date(meetingIso),
        adminEmail: contact.email,
        adminPhone: contact.phone || undefined,
        userId: session.id,
      });
    } catch (e) {
      console.error("[intake-scheduled] createBooking failed", e);
    }
  }

  const account = await getAccountByUserId(session.id);
  await notifyCoachIntakeReady({
    userId: session.id,
    name: account?.account.name || session.name || "Member",
    email: session.email,
    plan: signupPlanLabel(profile.plan),
    paymentStatus: profile.paymentStatus,
    scheduledAt: meetingIso,
    bookingSource: body.bookingSource || (meetingIso ? "manual" : "calendly"),
    phone: body.phone || account?.account.phone || profile.phone || null,
  });

  const result = await awardGamificationPoints({
    userId: session.id,
    eventId: "intake:scheduled",
    type: "intake_scheduled",
    label: "Booked intro call",
  });

  return NextResponse.json({
    introBookedAt: bookedAt,
    scheduledAt: meetingIso,
    ok: true,
    awarded: result.awarded,
    totalPoints: result.totalPoints,
    pointsEarned: result.pointsEarned,
  });
}
