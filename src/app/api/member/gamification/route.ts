import { NextResponse } from "next/server";
import { requireMemberAccess } from "@/lib/api-auth";
import { getUserGamification } from "@/lib/member-gamification-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireMemberAccess();
  if (!auth.ok) return auth.response;

  const gamification = await getUserGamification(auth.session.id);
  return NextResponse.json({
    totalPoints: gamification.totalPoints,
    eventCount: gamification.events.length,
  });
}