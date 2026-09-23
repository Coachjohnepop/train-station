import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pacificDateIso } from "@/lib/food-log";
import { divisionForPlan } from "@/lib/gamification-levers";
import { recomputeUserSeasonScore } from "@/lib/gamification-season";
import { getMemberProfile } from "@/lib/member-profiles-store";

export const dynamic = "force-dynamic";

const DAY_POINTS = 5;

function clean(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, 240);
}

export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const loggedOn = pacificDateIso();
  const rows = await prisma.activityEntry.findMany({
    where: { userId: session.id, loggedOn },
    orderBy: { createdAt: "asc" },
  });
  const awarded = await prisma.gamificationEvent.findUnique({
    where: { id: `activity:${session.id}:${loggedOn}` },
    select: { id: true },
  });
  return NextResponse.json({
    loggedOn,
    pointsToday: awarded ? DAY_POINTS : 0,
    entries: rows.map((row) => ({
      id: row.id,
      text: row.text,
      createdAt: row.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const text = clean(body?.text);
  if (text.length < 3) {
    return NextResponse.json({ error: "Say what you did." }, { status: 400 });
  }
  const loggedOn = pacificDateIso();
  const entry = await prisma.activityEntry.create({
    data: { userId: session.id, loggedOn, text },
  });

  const eventId = `activity:${session.id}:${loggedOn}`;
  const already = await prisma.gamificationEvent.findUnique({
    where: { id: eventId },
    select: { id: true },
  });
  let pointsEarned = 0;
  if (!already) {
    await prisma.gamificationEvent.create({
      data: {
        id: eventId,
        userId: session.id,
        type: "activity_day",
        points: DAY_POINTS,
        label: "Day activity",
        at: new Date(),
      },
    });
    pointsEarned = DAY_POINTS;
    try {
      const profile = await getMemberProfile(session.id);
      await recomputeUserSeasonScore(session.id, divisionForPlan(profile?.plan));
    } catch {
      /* score row can catch up on the next award */
    }
  }

  const total = await prisma.gamificationEvent.aggregate({
    where: { userId: session.id },
    _sum: { points: true },
  });

  return NextResponse.json({
    ok: true,
    pointsEarned,
    dayPoints: DAY_POINTS,
    totalPoints: total._sum.points ?? 0,
    entry: { id: entry.id, text: entry.text, createdAt: entry.createdAt.toISOString() },
  });
}
