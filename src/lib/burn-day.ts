import "server-only";

import { prisma } from "@/lib/prisma";
import { pacificDateIso } from "@/lib/food-log";
import {
  estimateActivityBurn,
  estimateWorkoutBurn,
  workoutMinutes,
} from "@/lib/burn-estimate";

export type BurnLine = {
  id: string;
  label: string;
  calories: number;
  kind: "activity" | "workout";
};

const FALLBACK_LBS = 170;

function pacificKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function readWeight(raw: string | null | undefined): { weightLbs: number; assumedWeight: boolean } {
  const value = Number(String(raw ?? "").replace(/[^\d.]/g, ""));
  if (Number.isFinite(value) && value >= 70 && value <= 500) {
    return { weightLbs: value, assumedWeight: false };
  }
  return { weightLbs: FALLBACK_LBS, assumedWeight: true };
}

export async function burnForDates(userId: string, dates: string[], focusDate: string) {
  const profile = await prisma.memberProfile.findUnique({
    where: { userId },
    select: { weightLbs: true },
  });
  const { weightLbs, assumedWeight } = readWeight(profile?.weightLbs);
  const start = new Date(`${dates[0]}T00:00:00-08:00`);
  start.setUTCDate(start.getUTCDate() - 1);
  const end = new Date(`${dates[dates.length - 1]}T00:00:00-08:00`);
  end.setUTCDate(end.getUTCDate() + 2);

  const [activities, workouts] = await Promise.all([
    prisma.activityEntry.findMany({
      where: { userId, loggedOn: { in: dates } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.workoutLog.findMany({
      where: { userId, performedAt: { gte: start, lt: end }, completed: true },
      include: {
        workout: {
          select: {
            name: true,
            exercises: { select: { setCount: true, sets: true, restBetweenSetsSec: true } },
          },
        },
      },
    }),
  ]);

  const byDate = new Map<string, BurnLine[]>();
  for (const date of dates) byDate.set(date, []);

  for (const row of activities) {
    const calories = estimateActivityBurn(row.text, weightLbs);
    if (calories == null || calories <= 0) continue;
    byDate.get(row.loggedOn)?.push({
      id: row.id,
      label: row.text,
      calories,
      kind: "activity",
    });
  }

  for (const row of workouts) {
    const date = pacificKey(row.performedAt);
    const bucket = byDate.get(date);
    if (!bucket) continue;
    const minutes = workoutMinutes(row.workout.exercises);
    const calories = estimateWorkoutBurn({
      name: row.workout.name,
      weightLbs,
      minutes,
      progress: row.progress,
    });
    if (calories <= 0) continue;
    bucket.push({
      id: row.id,
      label: row.workout.name,
      calories,
      kind: "workout",
    });
  }

  const todayLines = byDate.get(focusDate) ?? [];
  const weekCalories = [...byDate.values()]
    .flat()
    .reduce((sum, line) => sum + line.calories, 0);

  return {
    weightLbs,
    assumedWeight,
    todayCalories: todayLines.reduce((sum, line) => sum + line.calories, 0),
    weekCalories,
    lines: todayLines,
    asOf: pacificDateIso(),
  };
}
