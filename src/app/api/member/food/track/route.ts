import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { pacificDateIso } from "@/lib/food-log";
import {
  completeFoodTrackDay,
  loadFoodTrackDashboard,
  startFoodTrackDay,
} from "@/lib/food-track-store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const action = body?.action === "complete" ? "complete" : "start";
  const eatenOn =
    typeof body?.eatenOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.eatenOn)
      ? body.eatenOn
      : pacificDateIso();
  const today = pacificDateIso();
  if (action === "start" && eatenOn !== today) {
    return NextResponse.json({ error: "Start tracking today." }, { status: 400 });
  }

  try {
    if (action === "complete") {
      const { award } = await completeFoodTrackDay(session.id, eatenOn);
      const track = await loadFoodTrackDashboard(session.id, today);
      return NextResponse.json({
        ok: true,
        track,
        pointsEarned: award.pointsEarned,
        totalPoints: award.totalPoints,
        awarded: award.awarded,
      });
    }
    await startFoodTrackDay(session.id, eatenOn);
    const track = await loadFoodTrackDashboard(session.id, today);
    return NextResponse.json({ ok: true, track });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update that track day.";
    const status = message.includes("Log something") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
