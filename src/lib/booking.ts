import { prisma } from "@/lib/prisma";
import { isDemoMode } from "./demo-enrollments";
import { addDemoSmsLog } from "./sms";
import { COACH_CALENDLY_URL } from "./brand";

let demoUsers: any[] = [
  { id: "demo-user-john-steph", email: "john@lemonvoice.com", name: "John & Steph", phone: "(555) 111-2235", dailyReminderTime: "06:30" },
  { id: "demo-user", email: "demo@thetrainstation.co", name: "Alex", phone: "(555) 987-6543", dailyReminderTime: "07:30" },
  { id: "demo-user-john", email: "chad@thetrainstation.co", name: "Chad", phone: "(555) 111-2233", dailyReminderTime: "06:30" },
  { id: "demo-user-stephanie", email: "kaite@thetrainstation.co", name: "Katie", phone: "(555) 111-2234", dailyReminderTime: "06:30" },
];

let demoBookings: any[] = [
  {
    id: "demo-bk-john-jun17",
    memberEmail: "chad@thetrainstation.co",
    memberPhone: "(555) 111-2233",
    adminEmail: "jeremy@thetrainstation.co",
    adminPhone: "(555) 123-4567",
    scheduledAt: "2026-06-17T14:00:00.000Z",
    durationMin: 15,
    zoomUrl: null,
    status: "confirmed",
    notes: "Live check-in — post SMS workout",
    createdAt: "2026-06-14T12:00:00.000Z",
    userId: "demo-user-john",
  },
  {
    id: "demo-bk-steph-jun17",
    memberEmail: "kaite@thetrainstation.co",
    memberPhone: "(555) 111-2234",
    adminEmail: "jeremy@thetrainstation.co",
    adminPhone: "(555) 123-4567",
    scheduledAt: "2026-06-17T15:30:00.000Z",
    durationMin: 15,
    zoomUrl: null,
    status: "confirmed",
    notes: "Live check-in — post SMS workout",
    createdAt: "2026-06-14T12:00:00.000Z",
    userId: "demo-user-stephanie",
  },
  {
    id: "demo-bk-chad-jul3",
    memberEmail: "chad@thetrainstation.co",
    memberPhone: "(555) 111-2233",
    adminEmail: "jeremy@thetrainstation.co",
    adminPhone: "(555) 123-4567",
    scheduledAt: "2026-07-03T18:00:00.000Z",
    durationMin: 30,
    zoomUrl: null,
    zoomHostUrl: null,
    zoomMeetingId: null,
    status: "confirmed",
    notes: "Live coaching check-in",
    createdAt: "2026-07-01T12:00:00.000Z",
    userId: "demo-user-john",
  },
  {
    id: "demo-bk-jordan-jun16",
    memberEmail: "jordan.member@example.com",
    memberPhone: "(555) 222-3344",
    adminEmail: "jeremy@thetrainstation.co",
    adminPhone: "(555) 123-4567",
    scheduledAt: "2026-06-16T18:00:00.000Z",
    durationMin: 30,
    zoomUrl: null,
    status: "confirmed",
    notes: "Form check — upper body push day",
    createdAt: "2026-06-14T12:00:00.000Z",
    userId: "demo-user-2",
  },
];

export type AvailabilitySlot = {
  start: Date;
  end: Date;
  label: string;
};

export async function getAdminContact() {
  if (isDemoMode()) {
    return { 
      id: "demo-contact", 
      email: "jeremy@thetrainstation.co", 
      phone: "(555) 123-4567",
      calendlyUrl: COACH_CALENDLY_URL
    };
  }
  let contact = await prisma.adminContact.findFirst();
  if (!contact) {
    // fallback
    contact = await prisma.adminContact.create({
      data: {
        email: "jeremy@thetrainstation.co",
        phone: "(555) 123-4567",
      },
    });
  }
  return contact;
}

export async function updateAdminContact(email: string, phone?: string, calendlyUrl?: string) {
  if (isDemoMode()) {
    return { id: "demo-contact", email, phone: phone || null, calendlyUrl: calendlyUrl || null };
  }
  const existing = await prisma.adminContact.findFirst();
  if (existing) {
    return prisma.adminContact.update({
      where: { id: existing.id },
      data: { email, phone: phone || null, calendlyUrl: calendlyUrl || null },
    });
  }
  return prisma.adminContact.create({ data: { email, phone: phone || null, calendlyUrl: calendlyUrl || null } });
}

export async function getAvailabilities() {
  if (isDemoMode()) {
    return [
      { id: "d1", weekday: 1, startHour: 9, startMinute: 0, endHour: 17, endMinute: 0, slotDurationMin: 15, isActive: true },
      { id: "d2", weekday: 2, startHour: 9, startMinute: 0, endHour: 17, endMinute: 0, slotDurationMin: 15, isActive: true },
    ];
  }
  return prisma.adminAvailability.findMany({
    where: { isActive: true },
    orderBy: { weekday: "asc" },
  });
}

export async function setAvailabilities(slots: Array<{ weekday: number; startHour: number; startMinute: number; endHour: number; endMinute: number }>) {
  if (isDemoMode()) {
    return;
  }
  // naive: delete all, recreate
  await prisma.adminAvailability.deleteMany();
  for (const s of slots) {
    await prisma.adminAvailability.create({
      data: {
        weekday: s.weekday,
        startHour: s.startHour,
        startMinute: s.startMinute,
        endHour: s.endHour,
        endMinute: s.endMinute,
        slotDurationMin: 15,
      },
    });
  }
}

// Generate available 15-min slots for next N days based on admin avail
export async function getAvailableSlots(daysAhead = 14): Promise<AvailabilitySlot[]> {
  const avails = await getAvailabilities();
  if (avails.length === 0) return [];

  const slots: AvailabilitySlot[] = [];
  const now = new Date();

  for (let d = 0; d < daysAhead; d++) {
    const date = new Date(now);
    date.setDate(date.getDate() + d);
    date.setHours(0, 0, 0, 0);

    const weekday = date.getDay();
    const dayAvails = avails.filter((a) => a.weekday === weekday);

    for (const avail of dayAvails) {
      let start = new Date(date);
      start.setHours(avail.startHour, avail.startMinute, 0, 0);

      const endOfAvail = new Date(date);
      endOfAvail.setHours(avail.endHour, avail.endMinute, 0, 0);

      while (start < endOfAvail) {
        const slotEnd = new Date(start.getTime() + avail.slotDurationMin * 60000);
        if (slotEnd > endOfAvail) break;

        // don't offer past slots
        if (start > now) {
          const label = start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
          slots.push({ start, end: slotEnd, label });
        }
        start = slotEnd;
      }
    }
  }

  return slots;
}

export async function createBooking(data: {
  memberEmail: string;
  memberPhone?: string;
  scheduledAt: Date;
  durationMin?: number;
  adminEmail: string;
  adminPhone?: string;
  zoomUrl?: string;
  userId?: string;
}) {
  if (isDemoMode()) {
    // find or create demo user
    let du = demoUsers.find((u: any) => u.email === data.memberEmail);
    if (!du) {
      du = {
        id: "demo-u-" + Date.now(),
        email: data.memberEmail,
        name: data.memberEmail.split("@")[0],
        phone: data.memberPhone || null,
        dailyReminderTime: null,
      };
      demoUsers.push(du);
    } else if (data.memberPhone) {
      du.phone = data.memberPhone;
    }
    const booking = {
      id: "demo-bk-" + Date.now(),
      memberEmail: data.memberEmail,
      memberPhone: data.memberPhone || null,
      adminEmail: data.adminEmail,
      adminPhone: data.adminPhone || null,
      scheduledAt: data.scheduledAt.toISOString(),
      durationMin: data.durationMin || 15,
      zoomUrl: data.zoomUrl || null,
      status: "pending",
      createdAt: new Date().toISOString(),
      userId: du.id,
    };
    demoBookings.push(booking);
    return booking;
  }

  // Link to existing user by email if present, and set phone
  let userId = data.userId;
  if (!userId) {
    const existingUser = await prisma.user.findUnique({ where: { email: data.memberEmail } });
    if (existingUser) {
      userId = existingUser.id;
      if (data.memberPhone && !existingUser.phone) {
        await prisma.user.update({
          where: { id: existingUser.id },
          data: { phone: data.memberPhone },
        });
      }
    }
  }
  return prisma.booking.create({
    data: {
      memberEmail: data.memberEmail,
      memberPhone: data.memberPhone || null,
      scheduledAt: data.scheduledAt,
      durationMin: data.durationMin || 15,
      adminEmail: data.adminEmail,
      adminPhone: data.adminPhone || null,
      zoomUrl: data.zoomUrl || null,
      status: "pending",
      userId: userId || null,
    },
  });
}

export async function getBookings() {
  if (isDemoMode()) {
    return demoBookings.map((b: any) => {
      const du = demoUsers.find((u: any) => u.email === b.memberEmail);
      return { ...b, user: du ? { name: du.name, email: du.email, phone: du.phone, dailyReminderTime: du.dailyReminderTime } : null };
    });
  }
  return prisma.booking.findMany({
    orderBy: { scheduledAt: "desc" },
    include: { user: { select: { name: true, email: true, phone: true, dailyReminderTime: true } } },
  });
}

export type BookingZoomFields = {
  zoomUrl?: string | null;
  zoomHostUrl?: string | null;
  zoomMeetingId?: string | null;
};

export async function updateBookingStatus(
  id: string,
  status: string,
  zoomUrl?: string,
  notes?: string,
  zoomExtra?: BookingZoomFields,
) {
  if (isDemoMode()) {
    const b = demoBookings.find((bk: any) => bk.id === id);
    if (b) {
      b.status = status;
      if (zoomUrl !== undefined) b.zoomUrl = zoomUrl;
      if (notes !== undefined) b.notes = notes;
      if (zoomExtra?.zoomHostUrl !== undefined) b.zoomHostUrl = zoomExtra.zoomHostUrl;
      if (zoomExtra?.zoomMeetingId !== undefined) b.zoomMeetingId = zoomExtra.zoomMeetingId;
    }
    return b || { id, status, zoomUrl: zoomUrl || null };
  }
  return prisma.booking.update({
    where: { id },
    data: {
      status,
      zoomUrl: zoomUrl ?? zoomExtra?.zoomUrl ?? undefined,
      zoomHostUrl: zoomExtra?.zoomHostUrl ?? undefined,
      zoomMeetingId: zoomExtra?.zoomMeetingId ?? undefined,
      notes: notes ?? undefined,
    },
  });
}

export async function attachZoomToBooking(
  id: string,
  zoom: { meetingId: string; joinUrl: string; hostUrl: string },
) {
  if (isDemoMode()) {
    const b = demoBookings.find((bk: any) => bk.id === id);
    if (!b) return null;
    b.zoomUrl = zoom.joinUrl;
    b.zoomHostUrl = zoom.hostUrl;
    b.zoomMeetingId = zoom.meetingId;
    if (b.status === "pending") b.status = "confirmed";
    return b;
  }
  return prisma.booking.update({
    where: { id },
    data: {
      zoomUrl: zoom.joinUrl,
      zoomHostUrl: zoom.hostUrl,
      zoomMeetingId: zoom.meetingId,
      status: "confirmed",
    },
  });
}

export async function getBookingById(id: string) {
  if (isDemoMode()) {
    const b = demoBookings.find((bk: any) => bk.id === id);
    if (!b) return null;
    const du = demoUsers.find((u: any) => u.email === b.memberEmail);
    return { ...b, user: du ? { name: du.name, email: du.email, phone: du.phone } : null };
  }
  return prisma.booking.findUnique({
    where: { id },
    include: { user: { select: { name: true, email: true, phone: true } } },
  });
}

export type MemberLiveSession = {
  id: string;
  scheduledAt: string;
  durationMin: number;
  title: string;
  status: string;
  zoomUrl: string | null;
  canJoin: boolean;
  startsInMin: number | null;
};

export async function getMemberLiveSessions(input: {
  memberEmail: string;
  userId?: string | null;
}): Promise<MemberLiveSession[]> {
  const bookings = await getBookings();
  const now = Date.now();
  const joinWindowMs = 15 * 60 * 1000;

  return bookings
    .filter((b: any) => {
      const emailMatch = b.memberEmail?.toLowerCase() === input.memberEmail.toLowerCase();
      const userMatch = input.userId && b.userId === input.userId;
      if (!emailMatch && !userMatch) return false;
      if (b.status === "cancelled" || b.status === "completed") return false;
      const start = new Date(b.scheduledAt).getTime();
      const end = start + (b.durationMin || 15) * 60_000;
      return end >= now - joinWindowMs;
    })
    .sort(
      (a: any, b: any) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
    )
    .map((b: any) => {
      const start = new Date(b.scheduledAt).getTime();
      const startsInMin = Math.round((start - now) / 60_000);
      const canJoin = startsInMin <= 15 && startsInMin >= -(b.durationMin || 15);
      return {
        id: b.id,
        scheduledAt: b.scheduledAt,
        durationMin: b.durationMin || 15,
        title: b.notes || "Live coaching session",
        status: b.status,
        zoomUrl: b.zoomUrl || null,
        canJoin,
        startsInMin,
      };
    });
}

export async function ensureBookingZoomLink(bookingId: string) {
  const { createZoomMeeting } = await import("@/lib/zoom");
  const booking = await getBookingById(bookingId);
  if (!booking) return { error: "Booking not found." as const };
  if (booking.zoomUrl && booking.zoomHostUrl) {
    return {
      booking,
      zoom: {
        meetingId: booking.zoomMeetingId || "",
        joinUrl: booking.zoomUrl,
        hostUrl: booking.zoomHostUrl,
        reused: true,
      },
    };
  }

  const memberLabel = booking.user?.name || booking.memberEmail.split("@")[0];
  const zoom = await createZoomMeeting({
    bookingId: booking.id,
    topic: `Train Station — ${memberLabel}`,
    scheduledAt: new Date(booking.scheduledAt),
    durationMin: booking.durationMin || 15,
  });

  const updated = await attachZoomToBooking(booking.id, zoom);
  return { booking: updated, zoom, reused: false };
}

export async function setUserReminder(email: string, phone: string | null, reminderTime: string) {
  if (isDemoMode()) {
    let du = demoUsers.find((u: any) => u.email === email);
    if (!du) {
      du = { id: "demo-u-" + Date.now(), email, name: email.split("@")[0], phone: phone || null, dailyReminderTime: reminderTime };
      demoUsers.push(du);
    } else {
      if (phone) du.phone = phone;
      du.dailyReminderTime = reminderTime;
    }
    return du;
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    // create minimal user if not exists (for demo)
    return prisma.user.create({
      data: {
        email,
        phone: phone || null,
        dailyReminderTime: reminderTime,
        name: email.split("@")[0],
      },
    });
  }
  return prisma.user.update({
    where: { email },
    data: {
      phone: phone || user.phone,
      dailyReminderTime: reminderTime,
    },
  });
}

export async function sendDailyReminders() {
  const { getHubRecipients, messageHubActive, sendHubNotification, hubMemberChatUrl } =
    await import("@/lib/message-hub");

  if (isDemoMode()) {
    const recipients = await getHubRecipients();
    const du = recipients.find((u) => u.dailyReminderTime) || recipients[0];
    if (!du) return [];

    const { memberProgramWorkoutPath } = await import("@/lib/member-program-workout");
    const path = await memberProgramWorkoutPath("adult", du.id);
    const link = `${process.env.NEXT_PUBLIC_APP_URL || "https://www.thetrainstation.co"}${path}`;
    const message = `Good morning! Time for your workout in Adult. Start here: ${link}`;

    if (messageHubActive()) {
      const result = await sendHubNotification({
        recipient: du,
        message,
        source: "reminder",
        subject: "Your workout reminder — The Train Station",
        deepLink: hubMemberChatUrl(),
      });
      return [{ user: du.email, phone: du.phone || du.email, message, sentAt: result.sentAt }];
    }

    const entry = await addDemoSmsLog({
      userId: du.id,
      phone: du.phone || du.email,
      message,
      source: "reminder",
    });
    return [{ user: du.email, phone: du.phone, message, sentAt: entry.sentAt }];
  }

  const users = await prisma.user.findMany({
    where: {
      dailyReminderTime: { not: null },
      phone: { not: null },
    },
    include: {
      enrollments: {
        include: { program: true },
      },
    },
  });

  const logs: any[] = [];
  const now = new Date();

  for (const user of users) {
    if (!user.phone || !user.dailyReminderTime) continue;

    // For demo, always "send" today's reminder; in real would check current time matches user's reminderTime
    const enrollment = user.enrollments[0]; // assume primary
    if (!enrollment) continue;

    // Build link to today's workout - use current enrollment day or find today's program day
    // For simplicity, link to workout page with program; the app can resolve current day
    const link = `/member/workout?program=${enrollment.program.slug}`;

    const message = `Good morning! Time for your Day ${enrollment.currentDay} activities in ${enrollment.program.name}. Start here: ${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}${link}`;

    const log = await prisma.smsLog.create({
      data: {
        userId: user.id,
        phone: user.phone,
        message,
      },
    });
    logs.push({ user: user.email, phone: user.phone, message, sentAt: log.sentAt });
  }

  return logs;
}
