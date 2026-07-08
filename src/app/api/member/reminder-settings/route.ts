import { NextResponse } from "next/server";
import { isDemoMode, getDemoUserSettings, updateDemoUserSettings } from "@/lib/demo-reminders";
import { getMemberProfile, updateMemberProfile } from "@/lib/member-profiles-store";
import { requireSession } from "@/lib/api-auth";

export async function GET() {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;
  const uid = auth.session.id;

  if (isDemoMode()) {
    const profile = await getMemberProfile(uid);
    if (profile) {
      return NextResponse.json({
        phone: profile.phone,
        dailyReminderTime: profile.dailyReminderTime,
      });
    }
    const settings = getDemoUserSettings(uid);
    return NextResponse.json(settings);
  }

  try {
    const { prisma } = await import("@/lib/prisma");
    const user = await prisma.user.findUnique({
      where: { id: uid },
      select: { phone: true, dailyReminderTime: true },
    });
    if (user) {
      return NextResponse.json({
        phone: user.phone,
        dailyReminderTime: user.dailyReminderTime,
      });
    }
  } catch {
    // fall through
  }

  return NextResponse.json({ phone: null, dailyReminderTime: null });
}

export async function POST(request: Request) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;
  const uid = auth.session.id;

  const body = await request.json();
  const { phone, dailyReminderTime } = body;

  if (isDemoMode()) {
    const profile = await getMemberProfile(uid);
    if (profile) {
      const updated = await updateMemberProfile(uid, {
        phone: phone ?? null,
        dailyReminderTime: dailyReminderTime ?? null,
      });
      return NextResponse.json({
        phone: updated.phone,
        dailyReminderTime: updated.dailyReminderTime,
      });
    }
    const { settings: updated } = await updateDemoUserSettings(uid, {
      phone: phone ?? undefined,
      dailyReminderTime: dailyReminderTime ?? undefined,
    });
    return NextResponse.json(updated);
  }

  try {
    const { prisma } = await import("@/lib/prisma");
    const updated = await prisma.user.update({
      where: { id: uid },
      data: {
        phone: phone ?? null,
        dailyReminderTime: dailyReminderTime ?? null,
      },
      select: { phone: true, dailyReminderTime: true },
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}