import { NextResponse } from "next/server";
import { requireMemberAccess } from "@/lib/api-auth";
import { GAMIFICATION_EVENT_LABELS } from "@/lib/gamification-types";
import { awardGamificationPoints } from "@/lib/member-gamification-store";
import { localTodayIso } from "@/lib/program-calendar";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireMemberAccess();
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as {
    workoutId?: string;
    sessionDate?: string;
    programSlug?: string | null;
  };
  const workoutId = String(body.workoutId || "today").slice(0, 80);
  const sessionDate = /^\d{4}-\d{2}-\d{2}$/.test(String(body.sessionDate || ""))
    ? String(body.sessionDate)
    : localTodayIso();

  const result = await awardGamificationPoints({
    userId: auth.session.id,
    eventId: `set-logged:${sessionDate}:${workoutId}`,
    type: "set_logged",
    label: GAMIFICATION_EVENT_LABELS.set_logged,
    programSlug: body.programSlug ?? null,
  });

  return NextResponse.json(result);
}
