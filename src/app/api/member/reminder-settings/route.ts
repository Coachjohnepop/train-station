import { NextResponse } from "next/server";
import { isDemoMode, getDemoUserSettings, updateDemoUserSettings } from "@/lib/demo-reminders";
import { resolveUserId } from "@/lib/current-user";
import { getMemberProfile, updateMemberProfile } from "@/lib/member-profiles-store";

export async function GET() {
  const uid = await resolveUserId();

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

  // TODO: real auth + prisma for logged in member
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
  const body = await request.json();
  const { phone, dailyReminderTime } = body;
  const uid = await resolveUserId();

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

  // TODO: real path
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
