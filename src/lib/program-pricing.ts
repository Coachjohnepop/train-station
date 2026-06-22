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
  catalogStatus?: "live" | "coming_soon" | "hidden";
};

/** Display pricing for catalog / cart. Stripe will replace preview totals later. */
export function getProgramListPrice(program: CatalogProgram): {
  cents: number;
  label: string;
  futureLabel: string;
} {
  const cat = program.category || "workout";

  if (program.catalogStatus === "coming_soon" || cat === "eating") {
    return { cents: 0, label: "Coming soon", futureLabel: "$19/mo add-on" };
  }

  if (program.tierSlug === "first_class") {
    return { cents: 5000, label: "Preview — $0", futureLabel: "$50/mo membership" };
  }

  // Starter / coach-tier programs included with membership
  return { cents: 0, label: "Included", futureLabel: "Included with Coach Class" };
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