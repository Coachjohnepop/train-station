export type GroceryCatalogFood = {
  id: string;
  name: string;
  aliases: string;
  whyGood: string;
  whyAvoid: string;
};

export type GroceryMatch = {
  food: GroceryCatalogFood;
  score: number;
};

const UNIT_RE =
  /\b(\d+[\/.]?\d*)\s*(lbs?|pounds?|oz|ounces?|kg|g|grams?|count|ct|pk|pack|bags?|boxes?|cans?|jars?|bottles?|gal|qt|pt|ml|l)\b/gi;
const FILLER_RE =
  /\b(organic|fresh|frozen|store brand|great value|family pack|value pack|boneless|skinless)\b/gi;

export function normalizeGroceryLabel(raw: string): string {
  return raw
    .toLowerCase()
    .replace(UNIT_RE, " ")
    .replace(FILLER_RE, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseGroceryPaste(raw: string): string[] {
  const parts = raw
    .split(/[\n,;]+/)
    .map((s) => s.replace(/^[\s\-•]+/, "").replace(/^\d+[.)]\s+/, "").trim())
    .filter((s) => s.length >= 2);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const key = normalizeGroceryLabel(p);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(p.trim());
  }
  return out.slice(0, 80);
}

function aliasList(food: GroceryCatalogFood): string[] {
  const extra = food.aliases
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return [food.name, ...extra];
}

function wholePhraseScore(haystack: string, needle: string): number {
  const n = normalizeGroceryLabel(needle);
  const h = haystack;
  if (!n || !h) return 0;
  if (h === n) return 100 + n.length;
  const bounded = new RegExp(`(?:^| )${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?: |$)`);
  if (bounded.test(h)) return 70 + n.length;
  if (n.length >= 5 && h.includes(n)) return 40 + n.length;
  return 0;
}

export function matchApprovedGrocery(
  label: string,
  catalog: GroceryCatalogFood[],
): GroceryMatch | null {
  const hay = normalizeGroceryLabel(label);
  if (!hay) return null;
  let best: GroceryMatch | null = null;
  for (const food of catalog) {
    for (const alias of aliasList(food)) {
      const score = wholePhraseScore(hay, alias);
      if (score > 0 && (!best || score > best.score)) {
        best = { food, score };
      }
    }
  }
  return best && best.score >= 40 ? best : null;
}

export function formatSwapNote(food: GroceryCatalogFood, original: string): string {
  const from = original.trim();
  const same =
    normalizeGroceryLabel(from) === normalizeGroceryLabel(food.name);
  const head = same
    ? `${food.name} is on Jeremy’s list.`
    : `${from} → ${food.name}.`;
  return `${head} Why it’s in: ${food.whyGood} Why the usual version is out: ${food.whyAvoid}`;
}

export function offListNote(original: string): string {
  return `${original.trim()} is not on Jeremy’s 3-month cleanse list. Leave it. Bacon, sausage, ribeye, pork belly, 80/20, and extra-fatty cuts stay off until after goal weight — then a desire meal maybe once a month.`;
}
