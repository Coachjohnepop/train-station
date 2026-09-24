import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { estimateFoodParts } from "@/lib/food-estimate";
import {
  addIsoDays,
  cleanFoodText,
  EMPTY_NUTRIENTS,
  foodPartsFilled,
  mondayOfIso,
  pacificDateIso,
  weekDates,
  weekdayLabel,
  type CalorieThresholds,
  type FoodNutrients,
} from "@/lib/food-log";
import { getMemberProfile } from "@/lib/member-profiles-store";
import { burnForDates } from "@/lib/burn-day";

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
  saturatedFatG: number | null;
  fiberG: number | null;
  sugarG: number | null;
  addedSugarG: number | null;
  sodiumMg: number | null;
  cholesterolMg: number | null;
  serving: string;
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
    saturatedFatG: row.saturatedFatG,
    fiberG: row.fiberG,
    sugarG: row.sugarG,
    addedSugarG: row.addedSugarG,
    sodiumMg: row.sodiumMg,
    cholesterolMg: row.cholesterolMg,
    serving: row.serving,
    source: row.source,
    createdAt: row.createdAt.toISOString(),
  };
}

function readCount(value: unknown, max: number): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > max) return null;
  return Math.round(n);
}

function readNutrients(value: unknown): (FoodNutrients & {
  calories: number;
  proteinG: number | null;
  carbG: number | null;
  fatG: number | null;
}) | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  const calories = readCount(data.calories, 8000);
  if (calories == null) return null;
  return {
    calories,
    proteinG: readCount(data.proteinG, 500),
    carbG: readCount(data.carbG, 500),
    fatG: readCount(data.fatG, 500),
    saturatedFatG: readCount(data.saturatedFatG, 500),
    fiberG: readCount(data.fiberG, 150),
    sugarG: readCount(data.sugarG, 500),
    addedSugarG: readCount(data.addedSugarG, 500),
    sodiumMg: readCount(data.sodiumMg, 20000),
    cholesterolMg: readCount(data.cholesterolMg, 3000),
    serving: cleanFoodText(data.serving, 80),
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
  let burn = null;
  try {
    burn = await burnForDates(userId, days, eatenOn);
  } catch (error) {
    console.warn("[food] burn estimate skipped", error);
  }
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
    burn,
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
  const fromPhoto = readNutrients(body?.nutrients);
  const estimate = fromPhoto
    ? {
        ...parts,
        ...EMPTY_NUTRIENTS,
        ...fromPhoto,
        source: "ai" as const,
      }
    : await estimateFoodParts(parts);
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
      saturatedFatG: estimate.saturatedFatG,
      fiberG: estimate.fiberG,
      sugarG: estimate.sugarG,
      addedSugarG: estimate.addedSugarG,
      sodiumMg: estimate.sodiumMg,
      cholesterolMg: estimate.cholesterolMg,
      serving: estimate.serving,
      source: estimate.source,
    },
  });
  const monday = mondayOfIso(eatenOn);
  return NextResponse.json({ ok: true, entry: rowOut(saved), eatenOn, monday });
}
