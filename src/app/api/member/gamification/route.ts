import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getUserGamification } from "@/lib/member-gamification-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const gamification = await getUserGamification(session.id);
  return NextResponse.json({
    totalPoints: gamification.totalPoints,
    eventCount: gamification.events.length,
  });
}