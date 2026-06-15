import { NextResponse } from "next/server";
import { z } from "zod";
import { createBooking, getBookings, getAdminContact, updateBookingStatus, getAvailableSlots } from "@/lib/booking";
import { prisma } from "@/lib/prisma";

function isDemoMode() {
  const url = process.env.DATABASE_URL ?? "";
  return !url || url.includes("dummy.supabase") || url.includes("dummy");
}

let demoContact = { email: "jeremy@thetrainstation.co", phone: "(555) 123-4567" };
let demoSlots: any[] = [];

const createSchema = z.object({
  memberEmail: z.string().email(),
  memberPhone: z.string().optional(),
  scheduledAt: z.string().datetime(), // ISO
  userId: z.string().optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("slots") === "true") {
    if (isDemoMode()) {
      // generate simple slots for demo
      if (demoSlots.length === 0) {
        const base = new Date();
        for (let d = 1; d <= 7; d++) {
          const day = new Date(base.getTime() + d * 86400000);
          if (day.getDay() === 0 || day.getDay() === 6) continue;
          for (let h = 9; h < 17; h++) {
            const start = new Date(day);
            start.setHours(h, 0, 0, 0);
            const end = new Date(start.getTime() + 15 * 60000);
            demoSlots.push({
              start: start.toISOString(),
              end: end.toISOString(),
              label: start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
            });
          }
        }
      }
      return NextResponse.json(demoSlots);
    }
    const slots = await getAvailableSlots();
    return NextResponse.json(slots);
  }
  const bookings = await getBookings();
  return NextResponse.json(bookings);
}

export async function POST(request: Request) {
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

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
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }
  const { id, ...data } = parsed.data;

  if (isDemoMode()) {
    const bookings = await getBookings();
    const b = bookings.find((bk: any) => bk.id === id);
    if (!b) return NextResponse.json({ detail: "Not found (demo)" }, { status: 404 });
    const updated = await updateBookingStatus(id, data.status || b.status, data.zoomUrl);
    if (data.reminderTime || data.memberPhone) {
      await (await import("@/lib/booking")).setUserReminder(
        b.memberEmail,
        data.memberPhone || b.memberPhone,
        data.reminderTime || "08:00"
      );
    }
    return NextResponse.json(updated);
  }

  const updated = await updateBookingStatus(id, data.status || "pending", data.zoomUrl);
  if (data.notes) {
    await prisma.booking.update({ where: { id }, data: { notes: data.notes } });
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


