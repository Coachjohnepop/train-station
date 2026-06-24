import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/api-auth";
import { getDemoSmsLogs } from "@/lib/sms";
import { prisma } from "@/lib/prisma";
import { isDemoMode } from "@/lib/demo-enrollments";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;

  if (isDemoMode()) {
    const logs = await getDemoSmsLogs();
    return NextResponse.json(logs.slice(0, 50));
  }

  const logs = await prisma.smsLog.findMany({
    orderBy: { sentAt: "desc" },
    take: 50,
    include: { user: { select: { email: true, name: true } } },
  });

  return NextResponse.json(logs);
}