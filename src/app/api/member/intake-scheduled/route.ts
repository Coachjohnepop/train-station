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
  calendlyInviteeUri: z.string().url().optional().nullable(),
  calendlyRescheduleUrl: z.string().url().optional().nullable(),
  calendlyCancelUrl: z.string().url().optional().nullable(),
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
  let meetingIso =
    body.scheduledAt && !Number.isNaN(new Date(body.scheduledAt).getTime())
      ? new Date(body.scheduledAt).toISOString()
      : null;

  const { enrichCalendlyLinks } = await import("@/lib/calendly-invitee");
  const calendly = await enrichCalendlyLinks({
    inviteeUri: body.calendlyInviteeUri,
    eventUri: body.calendlyEventUri,
    rescheduleUrl: body.calendlyRescheduleUrl,
    cancelUrl: body.calendlyCancelUrl,
    scheduledAt: meetingIso,
    email: session.email,
  });
  if (!meetingIso && calendly.startTime) meetingIso = calendly.startTime;

  const profile = await updateMemberProfile(session.id, {
    introBookedAt: bookedAt,
    coachMeetingRequestedAt: null,
    coachMeetingRequestedBy: null,
    coachMeetingRequestNote: null,
  });

  // Persist a Booking row when we know the meeting time (shows on Admin → Bookings).
  // If Calendly webhook already recorded this invitee, skip create + skip duplicate coach notify.
  let skipCoachNotify = false;
  if (body.calendlyInviteeUri) {
    try {
      const { findBookingByCalendlyInviteeUri } = await import("@/lib/booking");
      const existing = await findBookingByCalendlyInviteeUri(body.calendlyInviteeUri);
      if (existing) skipCoachNotify = true;
    } catch {
      /* ignore */
    }
  }

  if ((meetingIso || calendly.inviteeUri) && !skipCoachNotify) {
    try {
      const contact = await getAdminContact();
      const { calendlyInviteeNoteMarker } = await import("@/lib/booking");
      const notes = [
        body.bookingSource === "calendly" ? "Calendly embed" : null,
        calendly.inviteeUri ? calendlyInviteeNoteMarker(calendly.inviteeUri) : null,
        calendly.eventUri ? `event:${calendly.eventUri}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      await createBooking({
        memberEmail: session.email,
        memberPhone: body.phone || undefined,
        scheduledAt: new Date(meetingIso || bookedAt),
        adminEmail: contact.email,
        adminPhone: contact.phone || undefined,
        userId: session.id,
        notes: notes || null,
        calendlyInviteeUri: calendly.inviteeUri,
        calendlyEventUri: calendly.eventUri,
        calendlyRescheduleUrl: calendly.rescheduleUrl,
        calendlyCancelUrl: calendly.cancelUrl,
      });
    } catch (e) {
      console.error("[intake-scheduled] createBooking failed", e);
    }
  } else if (skipCoachNotify && calendly.rescheduleUrl && body.calendlyInviteeUri) {
    try {
      const { findBookingByCalendlyInviteeUri, patchBookingCalendly } = await import(
        "@/lib/booking"
      );
      const existing = await findBookingByCalendlyInviteeUri(body.calendlyInviteeUri);
      if (existing) {
        await patchBookingCalendly(existing.id, {
          calendlyRescheduleUrl: calendly.rescheduleUrl,
          calendlyCancelUrl: calendly.cancelUrl,
          calendlyEventUri: calendly.eventUri,
        });
      }
    } catch (e) {
      console.warn("[intake-scheduled] patch calendly links failed", e);
    }
  }

  const account = await getAccountByUserId(session.id);
  if (!skipCoachNotify) {
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
  }

  const result = await awardGamificationPoints({
    userId: session.id,
    eventId: "intake:scheduled",
    type: "intake_scheduled",
    label: "Booked intro call",
  });

  try {
    const { sendMemberIntroBookedEmail } = await import("@/lib/member-booking-email");
    await sendMemberIntroBookedEmail({
      email: session.email,
      name: account?.account.name || session.name,
      scheduledAt: meetingIso,
      rescheduleUrl: calendly.rescheduleUrl,
      userId: session.id,
    });
  } catch (e) {
    console.warn("[intake-scheduled] member booking email failed", e);
  }

  return NextResponse.json({
    introBookedAt: bookedAt,
    scheduledAt: meetingIso,
    rescheduleUrl: calendly.rescheduleUrl,
    ok: true,
    awarded: result.awarded,
    totalPoints: result.totalPoints,
    pointsEarned: result.pointsEarned,
  });
}
