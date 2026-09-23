import "server-only";

import { xaiApiKey, defaultXaiChatModel } from "@/lib/xai-chat";
import {
  cleanFoodText,
  type FoodEstimate,
  type FoodParts,
} from "@/lib/food-log";

const ESTIMATE_PROMPT = `You estimate a home-cooked meal for a coaching app. Split the food into four buckets and estimate calories.
Return only JSON:
{"calories":number,"proteinG":number,"carbG":number,"fatG":number,"protein":"","starch":"","fat":"","extras":""}
- protein: meats, eggs, fish, dairy protein
- starch: bread, rice, potato, tortilla, oats
- fat: butter, oil, ghee, the cooking fat
- extras: peanut butter, garlic, sauces, jam, honey, vegetables that are not the main protein or starch
Keep the member's words. Do not invent foods they did not mention. Calories are an estimate for the amounts given.`;

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
  if (extras.trim() && !/peanut butter|garlic/i.test(extras)) calories += 40;
  return {
    protein,
    starch,
    fat,
    extras,
    calories: Math.max(0, calories),
    proteinG: null,
    carbG: null,
    fatG: null,
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
  const grams = (key: string) => {
    const n = Number(data[key]);
    if (!Number.isFinite(n) || n < 0 || n > 500) return null;
    return Math.round(n);
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
    source: "ai",
  };
}

async function xaiJson(
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>,
): Promise<string | null> {
  const apiKey = xaiApiKey();
  if (!apiKey) return null;
  const model = defaultXaiChatModel();
  const body: Record<string, unknown> = {
    model,
    temperature: 0.2,
    max_completion_tokens: 500,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: ESTIMATE_PROMPT },
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
  if (!raw) return fallback;
  return parseEstimateJson(raw, parts) ?? fallback;
}

export async function estimateFoodPhoto(dataUrl: string): Promise<FoodEstimate | { error: string }> {
  if (!/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(dataUrl)) {
    return { error: "Use a JPEG, PNG, or WebP photo." };
  }
  if (dataUrl.length > 5_500_000) return { error: "Photo is too large. Try one under 4 MB." };
  const empty: FoodParts = { protein: "", starch: "", fat: "", extras: "" };
  const raw = await xaiJson([
    {
      type: "text",
      text: "Read this plate. Split it into protein, starch, cooking fat, and extras, then estimate calories.",
    },
    { type: "image_url", image_url: { url: dataUrl } },
  ]);
  if (!raw) {
    return { error: "Could not read that photo. Type the meal instead." };
  }
  const parsed = parseEstimateJson(raw, empty);
  if (!parsed) return { error: "Could not read that photo. Type the meal instead." };
  return parsed;
}
