import { NextResponse } from "next/server";
import { requireMemberAccess } from "@/lib/api-auth";
import { getGamificationPointsConfig } from "@/lib/gamification-config";
import { getGamificationLevers } from "@/lib/gamification-config-store";
import { buildMemberScoreProgress } from "@/lib/member-gamification-progress";
import { getUserGamification } from "@/lib/member-gamification-store";
import { getMemberProfile } from "@/lib/member-profiles-store";
import { currentSeasonKey, seasonWindow } from "@/lib/gamification-season";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireMemberAccess();
  if (!auth.ok) return auth.response;

  const [gamification, profile, pointValues, levers] = await Promise.all([
    getUserGamification(auth.session.id),
    getMemberProfile(auth.session.id),
    getGamificationPointsConfig(),
    getGamificationLevers(),
  ]);
  const seasonDays = levers.seasonDays || 28;
  const seasonKey = currentSeasonKey(seasonDays);
  const { start, end } = seasonWindow(seasonKey, seasonDays);
  const startMs = start.getTime();
  const endMs = end.getTime();
  const seasonEvents = gamification.events.filter((e) => {
    const t = Date.parse(e.at);
    return Number.isFinite(t) && t >= startMs && t < endMs;
  });
  const seasonPoints = seasonEvents.reduce((sum, e) => sum + e.points, 0);
  const seasonView = {
    ...gamification,
    events: seasonEvents,
    totalPoints: seasonPoints,
  };
  const progress = buildMemberScoreProgress(seasonView, profile, pointValues, {
    seasonDays,
    seasonEndsAt: end.toISOString(),
  });

  return NextResponse.json({
    pointValues,
    totalPoints: seasonPoints,
    lifetimePoints: gamification.totalPoints,
    seasonKey,
    seasonDays,
    seasonStartsAt: start.toISOString(),
    seasonEndsAt: end.toISOString(),
    eventCount: seasonEvents.length,
    events: seasonEvents.map((e) => ({
      id: e.id,
      type: e.type,
      points: e.points,
      label: e.label,
      at: e.at,
    })),
    progress,
  });
}