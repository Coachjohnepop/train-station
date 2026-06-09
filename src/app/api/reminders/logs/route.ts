import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isDemoMode } from "@/lib/demo-enrollments";
import { getDemoSmsLogs, addDemoSmsLog } from "@/lib/sms";

export async function GET() {
  if (isDemoMode()) {
    return NextResponse.json(getDemoSmsLogs().slice(0, 30));
  }
  const logs = await prisma.smsLog.findMany({
    orderBy: { sentAt: "desc" },
    take: 30,
    include: { user: { select: { email: true } } },
  });
  return NextResponse.json(logs);
}

// For demo, allow other senders (broadcast) to append via the shared store
export async function POST(request: Request) {
  if (!isDemoMode()) return NextResponse.json({ ok: false }, { status: 400 });
  const body = await request.json();
  addDemoSmsLog(body);
  return NextResponse.json({ ok: true });
}
