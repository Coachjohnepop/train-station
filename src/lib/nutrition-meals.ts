type NutritionCalorieTier = {
  id: string;
  calories: number;
  label: string;
  sampleDay: string;
};

export type NutritionDesk = {
  pageTitle: string;
  breakfastLabel: string;
  lunchLabel: string;
  dinnerLabel: string;
  advisoryTitle: string;
  advisoryBody: string;
  advisoryCta: string;
  disclaimer: string;
  calendlyUrl: string | null;
};

export const DEFAULT_NUTRITION_DESK: NutritionDesk = {
  pageTitle: "Nutrition",
  breakfastLabel: "Breakfast ideas",
  lunchLabel: "Lunch ideas",
  dinnerLabel: "Dinner ideas",
  advisoryTitle: "Custom meal planning",
  advisoryBody:
    "Book a nutrition appointment with Coach Jeremy on Calendly. He will build a personal menu around your goals and schedule. This is coaching — not medical advice or meal delivery.",
  advisoryCta: "Book a nutrition appointment",
  disclaimer:
    "These are starting points — not medical advice. Talk with Coach Jeremy on your nutrition appointment if you want a plan tailored to you.",
  calendlyUrl: null,
};

export const NUTRITION_MEALS = [
  { id: "breakfast", label: DEFAULT_NUTRITION_DESK.breakfastLabel },
  { id: "lunch", label: DEFAULT_NUTRITION_DESK.lunchLabel },
  { id: "dinner", label: DEFAULT_NUTRITION_DESK.dinnerLabel },
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

export function nutritionMealNav(desk: NutritionDesk = DEFAULT_NUTRITION_DESK) {
  return [
    { id: "breakfast" as const, label: desk.breakfastLabel || DEFAULT_NUTRITION_DESK.breakfastLabel },
    { id: "lunch" as const, label: desk.lunchLabel || DEFAULT_NUTRITION_DESK.lunchLabel },
    { id: "dinner" as const, label: desk.dinnerLabel || DEFAULT_NUTRITION_DESK.dinnerLabel },
  ];
}

export function normalizeNutritionDesk(raw: unknown): NutritionDesk {
  const d = raw && typeof raw === "object" ? (raw as Partial<NutritionDesk>) : {};
  const url =
    typeof d.calendlyUrl === "string" && d.calendlyUrl.trim()
      ? d.calendlyUrl.trim()
      : null;
  return {
    pageTitle:
      typeof d.pageTitle === "string" && d.pageTitle.trim()
        ? d.pageTitle.trim()
        : DEFAULT_NUTRITION_DESK.pageTitle,
    breakfastLabel:
      typeof d.breakfastLabel === "string" && d.breakfastLabel.trim()
        ? d.breakfastLabel.trim()
        : DEFAULT_NUTRITION_DESK.breakfastLabel,
    lunchLabel:
      typeof d.lunchLabel === "string" && d.lunchLabel.trim()
        ? d.lunchLabel.trim()
        : DEFAULT_NUTRITION_DESK.lunchLabel,
    dinnerLabel:
      typeof d.dinnerLabel === "string" && d.dinnerLabel.trim()
        ? d.dinnerLabel.trim()
        : DEFAULT_NUTRITION_DESK.dinnerLabel,
    advisoryTitle:
      typeof d.advisoryTitle === "string" && d.advisoryTitle.trim()
        ? d.advisoryTitle.trim()
        : DEFAULT_NUTRITION_DESK.advisoryTitle,
    advisoryBody:
      typeof d.advisoryBody === "string" && d.advisoryBody.trim()
        ? d.advisoryBody.trim()
        : DEFAULT_NUTRITION_DESK.advisoryBody,
    advisoryCta:
      typeof d.advisoryCta === "string" && d.advisoryCta.trim()
        ? d.advisoryCta.trim()
        : DEFAULT_NUTRITION_DESK.advisoryCta,
    disclaimer:
      typeof d.disclaimer === "string" && d.disclaimer.trim()
        ? d.disclaimer.trim()
        : DEFAULT_NUTRITION_DESK.disclaimer,
    calendlyUrl: url && isNutritionCalendlyUrl(url) ? url : null,
  };
}

export function isNutritionCalendlyUrl(raw: string): boolean {
  const t = raw.trim();
  if (!t) return true;
  try {
    const u = new URL(t);
    return u.protocol === "https:" && /(^|\.)calendly\.com$/i.test(u.hostname);
  } catch {
    return false;
  }
}
