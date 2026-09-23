/** Pacific calendar date, YYYY-MM-DD. */
export function pacificDateIso(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function addIsoDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  return utc.toISOString().slice(0, 10);
}

/** Monday of the week that contains this Pacific date. */
export function mondayOfIso(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  const dow = utc.getUTCDay();
  const back = dow === 0 ? 6 : dow - 1;
  return addIsoDays(iso, -back);
}

export function weekDates(iso: string): string[] {
  const monday = mondayOfIso(iso);
  return Array.from({ length: 7 }, (_, i) => addIsoDays(monday, i));
}

export function weekdayLabel(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export type FoodParts = {
  protein: string;
  starch: string;
  fat: string;
  extras: string;
};

export type FoodNutrients = {
  saturatedFatG: number | null;
  fiberG: number | null;
  sugarG: number | null;
  addedSugarG: number | null;
  sodiumMg: number | null;
  cholesterolMg: number | null;
  serving: string;
};

export const EMPTY_NUTRIENTS: FoodNutrients = {
  saturatedFatG: null,
  fiberG: null,
  sugarG: null,
  addedSugarG: null,
  sodiumMg: null,
  cholesterolMg: null,
  serving: "",
};

export type FoodEstimate = FoodParts &
  FoodNutrients & {
    calories: number;
    proteinG: number | null;
    carbG: number | null;
    fatG: number | null;
    source: "ai" | "rough";
  };

export function sumFoodNutrient<K extends keyof FoodNutrients>(
  rows: FoodNutrients[],
  key: K,
): number {
  if (key === "serving") return 0;
  return rows.reduce((sum, row) => {
    const value = row[key];
    return sum + (typeof value === "number" ? value : 0);
  }, 0);
}

export function cleanFoodText(value: unknown, max = 400): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

export function foodPartsFilled(parts: FoodParts): boolean {
  return Boolean(parts.protein || parts.starch || parts.fat || parts.extras);
}

export type CalorieThresholds = {
  min: number;
  rangeMax: number;
  hardMax: number;
};

/** All three set, and minimum < range top < hard total. */
export function calorieThresholdsAreSet(
  min: number | null | undefined,
  rangeMax: number | null | undefined,
  hardMax: number | null | undefined,
): boolean {
  return (
    typeof min === "number" &&
    typeof rangeMax === "number" &&
    typeof hardMax === "number" &&
    Number.isFinite(min) &&
    Number.isFinite(rangeMax) &&
    Number.isFinite(hardMax) &&
    min < rangeMax &&
    rangeMax < hardMax
  );
}

/** A saved meal that leaves the day over the hard total, including later meals the same day. */
export function shouldFlashHardCalorieAlert(
  beforeCalories: number,
  afterCalories: number,
  thresholds: CalorieThresholds | null,
): boolean {
  if (!thresholds || !(afterCalories > beforeCalories)) return false;
  return calorieBand(afterCalories, thresholds) === "hard";
}

/** Gold outline, emerald range, deep orange, then red past the hard total. */
export function calorieBand(
  calories: number,
  thresholds: CalorieThresholds | null,
): "low" | "range" | "over" | "hard" | null {
  if (!thresholds) return null;
  if (calories < thresholds.min) return "low";
  if (calories <= thresholds.rangeMax) return "range";
  if (calories <= thresholds.hardMax) return "over";
  return "hard";
}
