import { NextResponse } from "next/server";
import { requireMemberAccess } from "@/lib/api-auth";
import {
  buildMemberScoreProgress,
  reconcileGamificationFromProfile,
} from "@/lib/member-gamification-progress";
import { getMemberProfile } from "@/lib/member-profiles-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireMemberAccess();
  if (!auth.ok) return auth.response;

  const gamification = await reconcileGamificationFromProfile(auth.session.id);
  const profile = await getMemberProfile(auth.session.id);
  const progress = buildMemberScoreProgress(gamification, profile);

  return NextResponse.json({
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