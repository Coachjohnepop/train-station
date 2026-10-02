import {
  WEEKDAY_NAMES_MON,
  weekdayIndexMon0,
  weekdayLabel,
  weekdayShort,
} from "@/lib/food-log";

/** Two full eating-and-drinking days fill the 28-day nutrition cycle. */
export const FOOD_TRACK_DAYS_PER_CYCLE = 2;

export type FoodTrackMeal = {
  id: string;
  calories: number;
  protein: string;
  starch: string;
  fat: string;
  extras: string;
};

export type FoodTrackDayRow = {
  eatenOn: string;
  startedAt: string;
  completedAt: string | null;
  calories: number;
  entryCount: number;
  meals: FoodTrackMeal[];
};

export type FoodTrackWeekday = {
  name: string;
  logged: boolean;
};

export type FoodTrackDashboard = {
  goal: number;
  completedCount: number;
  remaining: number;
  todayIso: string;
  todayStarted: boolean;
  todayCompleted: boolean;
  lastTwo: Array<FoodTrackDayRow & { label: string; weekday: string }>;
  weekdays: FoodTrackWeekday[];
};

export function buildFoodTrackDashboard(input: {
  todayIso: string;
  days: FoodTrackDayRow[];
}): FoodTrackDashboard {
  const completed = input.days.filter((day) => Boolean(day.completedAt));
  const completedCount = completed.length;
  const remaining = Math.max(0, FOOD_TRACK_DAYS_PER_CYCLE - completedCount);
  const today = input.days.find((day) => day.eatenOn === input.todayIso) ?? null;
  const lastTwo = [...input.days]
    .sort((a, b) => {
      const aLogged = a.entryCount > 0 ? 1 : 0;
      const bLogged = b.entryCount > 0 ? 1 : 0;
      if (aLogged !== bLogged) return bLogged - aLogged;
      return b.eatenOn.localeCompare(a.eatenOn);
    })
    .slice(0, FOOD_TRACK_DAYS_PER_CYCLE)
    .map((day) => ({
      ...day,
      meals: day.meals ?? [],
      label: weekdayLabel(day.eatenOn),
      weekday: weekdayShort(day.eatenOn),
    }));
  const loggedWeekdays = new Set(
    input.days.filter((day) => day.entryCount > 0).map((day) => weekdayIndexMon0(day.eatenOn)),
  );
  const weekdays = WEEKDAY_NAMES_MON.map((name, index) => ({
    name,
    logged: loggedWeekdays.has(index),
  }));
  return {
    goal: FOOD_TRACK_DAYS_PER_CYCLE,
    completedCount,
    remaining,
    todayIso: input.todayIso,
    todayStarted: Boolean(today),
    todayCompleted: Boolean(today?.completedAt),
    lastTwo,
    weekdays,
  };
}
