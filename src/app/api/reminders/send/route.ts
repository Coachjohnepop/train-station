import { NextResponse } from "next/server";
import { sendDailyReminders } from "@/lib/booking";
import { isDemoMode } from "@/lib/demo-enrollments";
import { addDemoSmsLog } from "@/lib/sms";

export async function POST() {
  // In real app this would be protected + called by cron/scheduler
  if (isDemoMode()) {
    // simulate for demo users that have reminder set (set via booking interview)
    const entry = addDemoSmsLog({
      userId: "demo-user",
      phone: "(555) 987-6543",
      message: "Good morning! Time for your Day 5 activities in Adult. Start here: http://localhost:3000/member/workout?program=adult",
      source: "reminder",
    });
    const logs = [
      {
        user: "demo@thetrainstation.co",
        phone: "(555) 987-6543",
        message: "Good morning! Time for your Day 5 activities in Adult. Start here: http://localhost:3000/member/workout?program=adult",
        sentAt: entry.sentAt,
      },
    ];
    return NextResponse.json({ sent: logs.length, logs });
  }

  const logs = await sendDailyReminders();
  return NextResponse.json({ sent: logs.length, logs });
}
