import "server-only";

import { xaiApiKey, defaultXaiChatModel } from "@/lib/xai-chat";
import {
  cleanFoodText,
  EMPTY_NUTRIENTS,
  type FoodEstimate,
  type FoodNutrients,
  type FoodParts,
} from "@/lib/food-log";

const NUTRIENT_JSON = `{"calories":number,"proteinG":number,"carbG":number,"fatG":number,"saturatedFatG":number,"fiberG":number,"sugarG":number,"addedSugarG":number,"sodiumMg":number,"cholesterolMg":number,"serving":"","protein":"","starch":"","fat":"","extras":""}`;

const ESTIMATE_PROMPT = `You estimate a home-cooked meal for a coaching app. Split the food into four buckets and estimate the numbers.
Return only JSON:
${NUTRIENT_JSON}
- protein: meats, eggs, fish, dairy protein
- starch: bread, rice, potato, tortilla, oats
- fat: butter, oil, ghee, the cooking fat
- extras: peanut butter, garlic, sauces, jam, honey, vegetables, and drinks (beer, IPA, wine, soda)
- A can of Belching Beaver is 1 pint (16 oz). A pint of IPA is about 280 calories, not zero. A 12 oz beer is about 150, a 12 oz IPA about 210. Put the drink in extras and set calories.
- fiberG, sugarG, addedSugarG, saturatedFatG are grams
- sodiumMg and cholesterolMg are milligrams
- serving is a short amount, such as "2 eggs" 
Use null for a number you cannot estimate. Keep the member's words. Do not invent foods they did not mention.`;

const LABEL_PROMPT = `You read a food photo for a coaching app.
If it is a Nutrition Facts label, copy the printed numbers for one serving. Do not round them into a guess and do not invent a line that is not printed.
If it is a plate or package front with no label, estimate the meal instead.
Return only JSON:
${NUTRIENT_JSON}
- protein: the product name, or the protein foods on the plate
- starch, fat, extras: only what you can see. Leave them empty on a label if they are not separate foods.
- fiberG, sugarG, addedSugarG, saturatedFatG are grams
- sodiumMg and cholesterolMg are milligrams
- serving is the printed serving size, such as "2/3 cup (55g)"
Use null when that line is not on the label.`;

/** Drinks the kitchen guess must not drop. A Belching Beaver can is a pint. */
export function drinkCalories(text: string): number {
  if (!/beer|ipa|\bale\b|lager|stout|porter|pilsner|cider|wine|seltzer/i.test(text)) return 0;
  const count = leadingCount(text);
  const pint = /pint|16\s?oz|belching beaver/i.test(text);
  const ipa = /\bipa\b|double ipa|imperial/i.test(text);
  if (/wine/i.test(text) && !/beer|\bipa\b|\bale\b|lager|stout/i.test(text)) {
    return Math.round(count * 125);
  }
  if (pint && ipa) return Math.round(count * 280);
  if (pint) return Math.round(count * 210);
  if (ipa) return Math.round(count * 210);
  return Math.round(count * 150);
}

function leadingCount(text: string): number {
  const match = text.match(/(\d+(?:\.\d+)?)/);
  const n = match ? Number(match[1]) : 1;
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** Used when the AI key is missing or the call fails. Rough kitchen amounts. */
export function roughFoodEstimate(parts: FoodParts): FoodEstimate {
  const protein = parts.protein;
  const starch = parts.starch;
  const fat = parts.fat;
  const extras = parts.extras;
  let calories = 0;
  if (/egg/i.test(protein)) calories += Math.round(leadingCount(protein) * 72);
  else if (protein.trim()) calories += Math.round(leadingCount(protein) * 150);
  if (/bread|sourdough|rice|potato|oat|tortilla/i.test(starch)) {
    calories += Math.round(leadingCount(starch) * 130);
  } else if (starch.trim()) calories += 150;
  if (/butter/i.test(fat)) calories += Math.round((/tbsp|tablespoon/i.test(fat) ? leadingCount(fat) : 1) * 100);
  else if (/oil/i.test(fat)) calories += Math.round((/tbsp|tablespoon/i.test(fat) ? leadingCount(fat) : 1) * 120);
  else if (fat.trim()) calories += 100;
  if (/peanut butter/i.test(extras)) calories += 190;
  if (/garlic/i.test(extras)) calories += 10;
  const drinkText = [protein, starch, fat, extras].filter(Boolean).join(" ");
  const drinks = drinkCalories(drinkText);
  if (drinks > 0) calories += drinks;
  else if (extras.trim() && !/peanut butter|garlic/i.test(extras)) calories += 40;
  return {
    protein,
    starch,
    fat,
    extras,
    calories: Math.max(0, calories),
    proteinG: null,
    carbG: null,
    fatG: null,
    ...EMPTY_NUTRIENTS,
    source: "rough",
  };
}

function parseEstimateJson(raw: string, fallback: FoodParts): FoodEstimate | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
  const calories = Number(data.calories);
  if (!Number.isFinite(calories) || calories < 0 || calories > 8000) return null;
  const grams = (key: string, max = 500) => {
    if (data[key] == null || data[key] === "") return null;
    const n = Number(data[key]);
    if (!Number.isFinite(n) || n < 0 || n > max) return null;
    return Math.round(n);
  };
  const nutrients: FoodNutrients = {
    saturatedFatG: grams("saturatedFatG"),
    fiberG: grams("fiberG", 150),
    sugarG: grams("sugarG"),
    addedSugarG: grams("addedSugarG"),
    sodiumMg: grams("sodiumMg", 20000),
    cholesterolMg: grams("cholesterolMg", 3000),
    serving: cleanFoodText(data.serving, 80),
  };
  return {
    protein: cleanFoodText(data.protein) || fallback.protein,
    starch: cleanFoodText(data.starch) || fallback.starch,
    fat: cleanFoodText(data.fat) || fallback.fat,
    extras: cleanFoodText(data.extras) || fallback.extras,
    calories: Math.round(calories),
    proteinG: grams("proteinG"),
    carbG: grams("carbG"),
    fatG: grams("fatG"),
    ...nutrients,
    source: "ai",
  };
}

async function xaiJson(
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>,
  system = ESTIMATE_PROMPT,
): Promise<string | null> {
  const apiKey = xaiApiKey();
  if (!apiKey) return null;
  const model = defaultXaiChatModel();
  const body: Record<string, unknown> = {
    model,
    temperature: 0.2,
    max_completion_tokens: 700,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content },
    ],
  };
  if (model.startsWith("grok-4.3")) body.reasoning_effort = "none";
  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    return typeof text === "string" ? text : null;
  } catch {
    return null;
  }
}

export async function estimateFoodParts(parts: FoodParts): Promise<FoodEstimate> {
  const fallback = roughFoodEstimate(parts);
  const text = [
    parts.protein && `Protein: ${parts.protein}`,
    parts.starch && `Starch: ${parts.starch}`,
    parts.fat && `Fat or cooking oil: ${parts.fat}`,
    parts.extras && `Also: ${parts.extras}`,
  ]
    .filter(Boolean)
    .join("\n");
  const raw = await xaiJson(text);
  const drinks = drinkCalories([parts.protein, parts.starch, parts.fat, parts.extras].filter(Boolean).join(" "));
  if (!raw) {
    if (drinks > 0 && fallback.calories < drinks) fallback.calories = drinks;
    if (drinks > 0 && !fallback.serving) fallback.serving = /pint|belching beaver/i.test([parts.protein, parts.starch, parts.fat, parts.extras].join(" ")) ? "1 pint" : "";
    return fallback;
  }
  const parsed = parseEstimateJson(raw, parts);
  if (!parsed) return drinks > 0 ? { ...fallback, calories: Math.max(fallback.calories, drinks) } : fallback;
  if (drinks > 0 && parsed.calories < drinks) parsed.calories = drinks;
  if (drinks > 0 && !parsed.serving && /pint|belching beaver/i.test([parts.protein, parts.starch, parts.fat, parts.extras].join(" "))) {
    parsed.serving = "1 pint";
  }
  return parsed;
}

export async function estimateFoodPhoto(dataUrl: string): Promise<FoodEstimate | { error: string }> {
  if (!/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(dataUrl)) {
    return { error: "Use a JPEG, PNG, or WebP photo." };
  }
  if (dataUrl.length > 5_500_000) return { error: "Photo is too large. Try one under 4 MB." };
  const empty: FoodParts = { protein: "", starch: "", fat: "", extras: "" };
  const raw = await xaiJson(
    [
      {
        type: "text",
        text: "Read this photo. If it is a Nutrition Facts label, copy that label. If it is a plate, estimate the meal.",
      },
      { type: "image_url", image_url: { url: dataUrl } },
    ],
    LABEL_PROMPT,
  );
  if (!raw) {
    return { error: "Could not read that photo. Type the meal instead." };
  }
  const parsed = parseEstimateJson(raw, empty);
  if (!parsed) return { error: "Could not read that photo. Type the meal instead." };
  return parsed;
}
