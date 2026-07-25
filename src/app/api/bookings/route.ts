import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createBooking,
  getBookings,
  getAdminContact,
  updateBookingStatus,
  getAvailableSlots,
} from "@/lib/booking";
import { prisma } from "@/lib/prisma";
import { requireSession, requireStaff } from "@/lib/api-auth";
import { isStaffRole } from "@/lib/staff-access";

function isDemoMode() {
  const url = process.env.DATABASE_URL ?? "";
  return !url || url.includes("dummy.supabase") || url.includes("dummy");
}

let demoContact = { email: "jeremy@thetrainstation.co", phone: "(555) 123-4567" };

const createSchema = z.object({
  memberEmail: z.string().email(),
  memberPhone: z.string().optional(),
  scheduledAt: z.string().datetime(), // ISO
  userId: z.string().optional(),
});

export async function GET(request: Request) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  if (url.searchParams.get("slots") === "true") {
    const slots = await getAvailableSlots();
    return NextResponse.json(
      slots.map((s) => ({
        start: s.start.toISOString(),
        end: s.end.toISOString(),
      })),
    );
  }

  if (!isStaffRole(auth.session.role)) {
    return NextResponse.json({ error: "Staff access required." }, { status: 403 });
  }
  const bookings = await getBookings();
  return NextResponse.json(bookings);
}

export async function POST(request: Request) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const memberEmail = data.memberEmail.trim().toLowerCase();
  const sessionEmail = auth.session.email?.trim().toLowerCase();
  if (!isStaffRole(auth.session.role)) {
    if (!sessionEmail || memberEmail !== sessionEmail) {
      return NextResponse.json(
        { error: "You can only book using your own email." },
        { status: 403 },
      );
    }
    data.userId = auth.session.id;
  }

  const contact = await getAdminContact();
  const booking = await createBooking({
    memberEmail: data.memberEmail,
    memberPhone: data.memberPhone,
    scheduledAt: new Date(data.scheduledAt),
    adminEmail: contact.email,
    adminPhone: contact.phone || undefined,
    userId: data.userId,
    // zoomUrl left for admin to fill
  });

  // Coach alert: new call request with the chosen calendar time.
  try {
    const { notifyCoachIntakeReady } = await import("@/lib/coach-member-notify");
    const { ensureMemberProfile, updateMemberProfile } = await import(
      "@/lib/member-profiles-store"
    );
    const { signupPlanLabel, normalizeSignupPlan } = await import("@/lib/signup-plans");
    const userId = data.userId || auth.session.id;
    const profile = await ensureMemberProfile({
      userId,
      email: data.memberEmail,
      plan: normalizeSignupPlan(null),
    });
    if (!profile.introBookedAt) {
      await updateMemberProfile(userId, { introBookedAt: new Date().toISOString() });
    }
    await notifyCoachIntakeReady({
      userId,
      name: auth.session.name || data.memberEmail,
      email: data.memberEmail,
      plan: signupPlanLabel(profile.plan),
      paymentStatus: profile.paymentStatus,
      scheduledAt: data.scheduledAt,
      bookingSource: "app_slots",
      phone: data.memberPhone || profile.phone || null,
    });
  } catch (e) {
    console.error("[bookings] coach notify failed", e);
  }

  return NextResponse.json(booking, { status: 201 });
}

const updateSchema = z.object({
  id: z.string(),
  status: z.string().optional(),
  zoomUrl: z.string().optional(),
  notes: z.string().optional(),
  reminderTime: z.string().optional(), // e.g. "07:30" set during interview
  memberPhone: z.string().optional(),
});

export async function PATCH(request: Request) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;

  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }
  const { id, ...data } = parsed.data;

  if (isDemoMode()) {
    const bookings = await getBookings();
    const b = bookings.find((bk: any) => bk.id === id);
    if (!b) return NextResponse.json({ detail: "Not found (demo)" }, { status: 404 });
    const nextStatus = data.status || b.status;
    const updated = await updateBookingStatus(id, nextStatus, data.zoomUrl, data.notes);
    if (nextStatus === "confirmed" && !data.zoomUrl && !updated?.zoomUrl) {
      try {
        const { ensureBookingZoomLink } = await import("@/lib/booking");
        await ensureBookingZoomLink(id);
      } catch {
        /* manual fallback */
      }
    }
    if (data.reminderTime || data.memberPhone) {
      await (await import("@/lib/booking")).setUserReminder(
        b.memberEmail,
        data.memberPhone || b.memberPhone,
        data.reminderTime || "08:00"
      );
    }
    return NextResponse.json(updated);
  }

  const nextStatus = data.status || "pending";
  const updated = await updateBookingStatus(id, nextStatus, data.zoomUrl, data.notes);
  if (
    nextStatus === "confirmed" &&
    !data.zoomUrl &&
    !updated?.zoomUrl
  ) {
    try {
      const { ensureBookingZoomLink } = await import("@/lib/booking");
      await ensureBookingZoomLink(id);
    } catch {
      /* coach can create manually */
    }
  }
  if (data.reminderTime || data.memberPhone) {
    const b = await prisma.booking.findUnique({ where: { id } });
    if (b) {
      await (await import("@/lib/booking")).setUserReminder(
        b.memberEmail,
        data.memberPhone || b.memberPhone,
        data.reminderTime || "08:00"
      );
    }
  }
  return NextResponse.json(updated);
}


