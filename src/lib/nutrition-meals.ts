type NutritionCalorieTier = {
  id: string;
  calories: number;
  label: string;
  sampleDay: string;
};

export const NUTRITION_MEALS = [
  { id: "breakfast", label: "Breakfast ideas" },
  { id: "lunch", label: "Lunch ideas" },
  { id: "dinner", label: "Dinner ideas" },
] as const;

export type NutritionMealId = (typeof NUTRITION_MEALS)[number]["id"];

/** Pull Breakfast/Lunch/Dinner lines out of a calorie-tier sample day. */
export function parseNutritionSampleMeals(
  sampleDay: string,
): Partial<Record<NutritionMealId | "snacks", string>> {
  const text = sampleDay.replace(/\s+/g, " ").trim();
  if (!text) return {};
  const re = /(breakfast|lunch|dinner|snacks)\s*:\s*/gi;
  const marks: { key: string; bodyStart: number; start: number }[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    marks.push({
      key: match[1].toLowerCase(),
      start: match.index,
      bodyStart: match.index + match[0].length,
    });
  }
  const out: Partial<Record<NutritionMealId | "snacks", string>> = {};
  if (marks.length === 0) return out;
  for (let i = 0; i < marks.length; i++) {
    const end = i + 1 < marks.length ? marks[i + 1].start : text.length;
    const body = text
      .slice(marks[i].bodyStart, end)
      .replace(/^[·•,\-\s]+|[·•,\-\s]+$/g, "")
      .trim();
    if (!body) continue;
    const key = marks[i].key as NutritionMealId | "snacks";
    out[key] = body;
  }
  return out;
}

export function nutritionIdeasForMeal(
  tiers: NutritionCalorieTier[],
  meal: NutritionMealId,
): Array<{ id: string; label: string; calories: number; text: string }> {
  const ideas: Array<{ id: string; label: string; calories: number; text: string }> = [];
  for (const tier of tiers) {
    const parsed = parseNutritionSampleMeals(tier.sampleDay);
    const text = parsed[meal]?.trim();
    if (!text) continue;
    ideas.push({
      id: tier.id,
      label: tier.label,
      calories: tier.calories,
      text,
    });
  }
  return ideas;
}
