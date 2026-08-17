/**
 * Original home-kit checklist — names of what members have, not shop SKUs.
 * Gear sale links stay on /member gear. If the catalog is overwritten with
 * Amazon products, home equipment still falls back to this list.
 */
export type HomeEquipmentDefault = {
  id: string;
  name: string;
  category: string;
};

export const ORIGINAL_HOME_EQUIPMENT: HomeEquipmentDefault[] = [
  { id: "eq-bodyweightonly", name: "Bodyweight only", category: "bodyweight" },
  { id: "eq-dumbbellspair", name: "Dumbbells (pair)", category: "dumbbells" },
  { id: "eqmq4prcy7", name: "Adjustable Dumbbells", category: "dumbbells" },
  { id: "eq-resistancebands", name: "Resistance bands", category: "bands" },
  { id: "eqmq4prcy8", name: "Resistance Bands with Handles", category: "bands" },
  { id: "eq-pullupbar", name: "Pull-up bar", category: "pullup" },
  { id: "eq-bench", name: "Bench", category: "bench" },
  { id: "eq-kettlebell", name: "Kettlebell", category: "kettlebell" },
  { id: "eqmq4prcy9", name: "Stability Ball", category: "accessory" },
];

export const ORIGINAL_HOME_EQUIPMENT_IDS = new Set(
  ORIGINAL_HOME_EQUIPMENT.map((item) => item.id),
);

const BODYWEIGHT_EQUIPMENT_ID = "eq-bodyweightonly";

/** Amazon / shop SKU copy must never appear on the home-kit checklist. */
export function isShopListingCopy(value: string | null | undefined): boolean {
  if (!value) return false;
  const t = value.trim();
  if (!t) return false;
  if (/amazon\.com/i.test(t)) return true;
  if (/^https?:\/\//i.test(t)) return true;
  if (/\basin\b/i.test(t)) return true;
  if (/sports\s*&\s*(?:amp;)?outdoors/i.test(t)) return true;
  if (/hulkfit|nicepeople|versa\s*tube/i.test(t)) return true;
  return false;
}

export function homeEquipmentNote(value: string | null | undefined): string {
  const t = (value || "").trim();
  if (!t || isShopListingCopy(t)) return "";
  return t;
}

export function isHomeEquipmentChecklistItem(item: {
  id: string;
  name: string;
  category?: string | null;
}): boolean {
  if (ORIGINAL_HOME_EQUIPMENT_IDS.has(item.id)) return true;
  const custom = (item.category || "").trim().toLowerCase() === "custom";
  if (!custom) return false;
  return !isShopListingCopy(item.name);
}

export type HomeEquipmentCatalogRow = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  productUrl: string | null;
  imageUrl: string | null;
};

/** Demo / JSON rows may omit fields; normalize before filtering. */
export type HomeEquipmentCatalogInput = {
  id: string;
  name: string;
  category?: string | null;
  description?: string | null;
  productUrl?: string | null;
  imageUrl?: string | null;
};

function normalizeCatalogRow(item: HomeEquipmentCatalogInput): HomeEquipmentCatalogRow {
  return {
    id: item.id,
    name: item.name,
    category: item.category ?? null,
    description: item.description ?? null,
    productUrl: item.productUrl ?? null,
    imageUrl: item.imageUrl ?? null,
  };
}

/** Original named kit + home-only rows. Shop SKUs (product links) stay off this list. */
export function homeEquipmentFromCatalog(
  catalog: HomeEquipmentCatalogInput[],
): HomeEquipmentCatalogRow[] {
  const homeOnly = catalog.map(normalizeCatalogRow).filter((item) => !item.productUrl?.trim());
  const byId = new Map(homeOnly.map((item) => [item.id, item]));

  const merged: HomeEquipmentCatalogRow[] = [];
  for (const seed of ORIGINAL_HOME_EQUIPMENT) {
    const existing = byId.get(seed.id);
    if (existing) {
      merged.push({
        ...existing,
        name: seed.name,
        category: existing.category || seed.category,
        productUrl: null,
        description: homeEquipmentNote(existing.description) || null,
      });
      continue;
    }
    merged.push({
      id: seed.id,
      name: seed.name,
      category: seed.category,
      description: null,
      productUrl: null,
      imageUrl: null,
    });
  }

  for (const item of homeOnly) {
    if (ORIGINAL_HOME_EQUIPMENT_IDS.has(item.id)) continue;
    if (!isHomeEquipmentChecklistItem(item)) continue;
    merged.push({
      ...item,
      productUrl: null,
      description: homeEquipmentNote(item.description) || null,
    });
  }

  return merged.sort((a, b) => {
    if (a.id === BODYWEIGHT_EQUIPMENT_ID) return -1;
    if (b.id === BODYWEIGHT_EQUIPMENT_ID) return 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}
