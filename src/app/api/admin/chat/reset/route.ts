import { NextResponse } from "next/server";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import { clearCoachChat, hydrateCoachChat } from "@/lib/coach-chat";

export const dynamic = "force-dynamic";

async function requireStaff() {
  const session = await getSessionUser();
  if (!session || !isStaffRole(session.role)) return null;
  return session;
}

export async function POST() {
  const session = await requireStaff();
  if (!session) {
    return NextResponse.json({ error: "Coach sign-in required." }, { status: 401 });
  }

  const cleared = await clearCoachChat();
  const store = await hydrateCoachChat();

  return NextResponse.json({
    ok: true,
    cleared,
    threadCount: store.threads.length,
    messageCount: store.messages.length,
  });
}