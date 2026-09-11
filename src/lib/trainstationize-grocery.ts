import "server-only";

import {
  formatSwapNote,
  matchApprovedGrocery,
  offListNote,
  type GroceryCatalogFood,
} from "@/lib/approved-grocery-match";
import { xaiChatCompletion } from "@/lib/xai-chat";

export type TrainstationizePlan = {
  itemId: string;
  original: string;
  label: string;
  approvedFoodId: string | null;
  swapNote: string;
  source: "table" | "grok" | "off-list";
};

function parseGrokRows(
  content: string,
  catalog: GroceryCatalogFood[],
): Map<string, { approvedFoodId: string | null; label: string; why: string }> {
  const out = new Map<string, { approvedFoodId: string | null; label: string; why: string }>();
  try {
    const json = JSON.parse(content) as {
      swaps?: Array<{
        original?: string;
        approvedFoodId?: string | null;
        label?: string;
        why?: string;
      }>;
    };
    const byId = new Map(catalog.map((f) => [f.id, f]));
    for (const row of json.swaps ?? []) {
      const original = String(row.original || "").trim();
      if (!original) continue;
      const food = row.approvedFoodId ? byId.get(String(row.approvedFoodId)) : null;
      out.set(original.toLowerCase(), {
        approvedFoodId: food?.id ?? null,
        label: food?.name || String(row.label || original),
        why: String(row.why || "").trim(),
      });
    }
  } catch {
    /* ignore bad JSON */
  }
  return out;
}

export async function planTrainstationize(
  items: Array<{ id: string; label: string; originalLabel: string }>,
  catalog: GroceryCatalogFood[],
): Promise<TrainstationizePlan[]> {
  const plans: TrainstationizePlan[] = [];
  const unmatched: Array<{ id: string; original: string }> = [];

  for (const item of items) {
    const original = item.originalLabel || item.label;
    const hit = matchApprovedGrocery(original, catalog) ?? matchApprovedGrocery(item.label, catalog);
    if (hit) {
      plans.push({
        itemId: item.id,
        original,
        label: hit.food.name,
        approvedFoodId: hit.food.id,
        swapNote: formatSwapNote(hit.food, original),
        source: "table",
      });
    } else {
      unmatched.push({ id: item.id, original });
    }
  }

  if (unmatched.length === 0) return plans;

  const catalogBrief = catalog
    .map((f) => `${f.id} | ${f.name} | ${f.aliases}`)
    .join("\n");
  const grok = await xaiChatCompletion(
    [
      {
        role: "system",
        content:
          "You map grocery items onto Jeremy's Train Station cleanse list. " +
          "Keto carbs (almost none). Low-fat proteins only. Bacon, turkey bacon, sausage, ribeye, pork belly, 80/20 beef, and extra-fatty cuts are NEVER approved. " +
          "Reply JSON: {\"swaps\":[{\"original\":\"...\",\"approvedFoodId\":\"id or null\",\"label\":\"approved name or original\",\"why\":\"one or two sentences\"}]}. " +
          "approvedFoodId MUST be one of the catalog ids or null. Do not invent foods.",
      },
      {
        role: "user",
        content: `Catalog:\n${catalogBrief}\n\nItems:\n${unmatched.map((u) => u.original).join("\n")}`,
      },
    ],
    { responseFormat: { type: "json_object" }, maxTokens: 1200, temperature: 0.1 },
  );

  const grokMap =
    "content" in grok ? parseGrokRows(grok.content, catalog) : new Map();

  for (const u of unmatched) {
    const g = grokMap.get(u.original.toLowerCase());
    if (g?.approvedFoodId) {
      const food = catalog.find((f) => f.id === g.approvedFoodId)!;
      plans.push({
        itemId: u.id,
        original: u.original,
        label: food.name,
        approvedFoodId: food.id,
        swapNote: g.why ? `${u.original} → ${food.name}. ${g.why}` : formatSwapNote(food, u.original),
        source: "grok",
      });
    } else {
      plans.push({
        itemId: u.id,
        original: u.original,
        label: u.original,
        approvedFoodId: null,
        swapNote: g?.why || offListNote(u.original),
        source: "off-list",
      });
    }
  }

  return plans;
}
