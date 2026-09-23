import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { estimateFoodParts } from "@/lib/food-estimate";
import {
  addIsoDays,
  cleanFoodText,
  foodPartsFilled,
  mondayOfIso,
  pacificDateIso,
  weekDates,
  weekdayLabel,
  type CalorieThresholds,
} from "@/lib/food-log";
import { getMemberProfile } from "@/lib/member-profiles-store";

export const dynamic = "force-dynamic";

async function memberId() {
  const session = await getSessionUser();
  if (!session) return null;
  return session.id;
}

function rowOut(row: {
  id: string;
  eatenOn: string;
  protein: string;
  starch: string;
  fat: string;
  extras: string;
  calories: number;
  proteinG: number | null;
  carbG: number | null;
  fatG: number | null;
  source: string;
  createdAt: Date;
}) {
  return {
    id: row.id,
    eatenOn: row.eatenOn,
    protein: row.protein,
    starch: row.starch,
    fat: row.fat,
    extras: row.extras,
    calories: row.calories,
    proteinG: row.proteinG,
    carbG: row.carbG,
    fatG: row.fatG,
    source: row.source,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function GET(request: Request) {
  const userId = await memberId();
  if (!userId) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const url = new URL(request.url);
  const eatenOn = url.searchParams.get("date") || pacificDateIso();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eatenOn)) {
    return NextResponse.json({ error: "Bad date." }, { status: 400 });
  }
  const days = weekDates(eatenOn);
  const rows = await prisma.foodEntry.findMany({
    where: { userId, eatenOn: { gte: days[0], lte: days[6] } },
    orderBy: [{ eatenOn: "asc" }, { createdAt: "asc" }],
  });
  const byDay = days.map((date) => {
    const entries = rows.filter((row) => row.eatenOn === date).map(rowOut);
    return {
      date,
      label: weekdayLabel(date),
      calories: entries.reduce((sum, row) => sum + row.calories, 0),
      entries,
    };
  });
  const today = byDay.find((day) => day.date === eatenOn) ?? byDay[0];
  const profile = await getMemberProfile(userId);
  const thresholds: CalorieThresholds | null =
    profile?.calorieMin != null &&
    profile.calorieRangeMax != null &&
    profile.calorieHardMax != null
      ? {
          min: profile.calorieMin,
          rangeMax: profile.calorieRangeMax,
          hardMax: profile.calorieHardMax,
        }
      : null;
  return NextResponse.json({
    eatenOn,
    monday: days[0],
    sunday: addIsoDays(days[0], 6),
    dayCalories: today?.calories ?? 0,
    weekCalories: byDay.reduce((sum, day) => sum + day.calories, 0),
    thresholds,
    days: byDay,
  });
}

export async function POST(request: Request) {
  const userId = await memberId();
  if (!userId) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parts = {
    protein: cleanFoodText(body?.protein),
    starch: cleanFoodText(body?.starch),
    fat: cleanFoodText(body?.fat),
    extras: cleanFoodText(body?.extras),
  };
  if (!foodPartsFilled(parts)) {
    return NextResponse.json({ error: "Add at least one food." }, { status: 400 });
  }
  const eatenOn =
    typeof body?.eatenOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.eatenOn)
      ? body.eatenOn
      : pacificDateIso();
  const estimate = await estimateFoodParts(parts);
  const saved = await prisma.foodEntry.create({
    data: {
      userId,
      eatenOn,
      protein: estimate.protein,
      starch: estimate.starch,
      fat: estimate.fat,
      extras: estimate.extras,
      calories: estimate.calories,
      proteinG: estimate.proteinG,
      carbG: estimate.carbG,
      fatG: estimate.fatG,
      source: estimate.source,
    },
  });
  const monday = mondayOfIso(eatenOn);
  return NextResponse.json({ ok: true, entry: rowOut(saved), eatenOn, monday });
}
