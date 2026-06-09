import { NextResponse } from "next/server";
import { isDemoMode, getDemoUserSettings, updateDemoUserSettings } from "@/lib/demo-reminders";

export async function GET() {
  if (isDemoMode()) {
    const settings = getDemoUserSettings("demo-user");
    return NextResponse.json(settings);
  }

  // TODO: real auth + prisma for logged in member
  return NextResponse.json({ error: "Real DB not implemented yet" }, { status: 501 });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { phone, dailyReminderTime } = body;

  if (isDemoMode()) {
    const updated = updateDemoUserSettings("demo-user", {
      phone: phone ?? undefined,
      dailyReminderTime: dailyReminderTime ?? undefined,
    });
    return NextResponse.json(updated);
  }

  // TODO: real path
  return NextResponse.json({ error: "Real DB not implemented yet" }, { status: 501 });
}
