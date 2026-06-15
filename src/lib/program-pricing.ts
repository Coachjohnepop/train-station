import { CATEGORY_LABELS } from "@/lib/program-constants";

export type CatalogProgram = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category?: string;
  tierSlug?: string;
  workoutCount?: number;
  durationWeeks?: number;
};

/** Display pricing for catalog / cart. Stripe will replace preview totals later. */
export function getProgramListPrice(program: CatalogProgram): {
  cents: number;
  label: string;
  futureLabel: string;
} {
  const cat = program.category || "workout";

  if (cat === "eating") {
    return { cents: 0, label: "Coming soon", futureLabel: "$19/mo add-on" };
  }

  if (program.tierSlug === "first_class") {
    return { cents: 2900, label: "Preview — $0", futureLabel: "$29/mo membership" };
  }

  // Starter / coach-tier programs included with membership
  return { cents: 0, label: "Included", futureLabel: "Included with Member plan" };
}

export function formatMoney(cents: number): string {
  if (cents <= 0) return "$0";
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

export function categoryLabel(category?: string): string {
  const cat = category || "workout";
  return CATEGORY_LABELS[cat] || cat;
}

export const CART_STORAGE_KEY = "ts-program-cart";