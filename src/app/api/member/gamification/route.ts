import { NextResponse } from "next/server";
import { requireMemberAccess } from "@/lib/api-auth";
import { getGamificationPointsConfig } from "@/lib/gamification-config";
import { buildMemberScoreProgress } from "@/lib/member-gamification-progress";
import { getUserGamification } from "@/lib/member-gamification-store";
import { getMemberProfile } from "@/lib/member-profiles-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireMemberAccess();
  if (!auth.ok) return auth.response;

  const [gamification, profile, pointValues] = await Promise.all([
    getUserGamification(auth.session.id),
    getMemberProfile(auth.session.id),
    getGamificationPointsConfig(),
  ]);
  const progress = buildMemberScoreProgress(gamification, profile, pointValues);

  return NextResponse.json({
    pointValues,
    totalPoints: gamification.totalPoints,
    eventCount: gamification.events.length,
    events: gamification.events.map((e) => ({
      id: e.id,
      type: e.type,
      points: e.points,
      label: e.label,
      at: e.at,
    })),
    progress,
  });
}