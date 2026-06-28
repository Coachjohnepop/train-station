import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { GAMIFICATION_POINTS } from "@/lib/gamification-types";
import { awardGamificationPoints } from "@/lib/member-gamification-store";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const result = await awardGamificationPoints({
    userId: session.id,
    eventId: "intake:scheduled",
    type: "intake_scheduled",
    label: "Booked intro call",
  });

  return NextResponse.json({
    ok: true,
    awarded: result.awarded,
    totalPoints: result.totalPoints,
    pointsEarned: result.awarded ? GAMIFICATION_POINTS.intake_scheduled : 0,
  });
}