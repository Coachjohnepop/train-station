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
  { id: "eq-resistancebands", name: "Resistance bands", category: "bands" },
  { id: "eq-pullupbar", name: "Pull-up bar", category: "pullup" },
  { id: "eq-bench", name: "Bench", category: "bench" },
  { id: "eq-kettlebell", name: "Kettlebell", category: "kettlebell" },
  { id: "eqmq4prcy7", name: "Adjustable Dumbbells", category: "dumbbells" },
  { id: "eqmq4prcy8", name: "Resistance Bands with Handles", category: "bands" },
  { id: "eqmq4prcy9", name: "Stability Ball", category: "accessory" },
  { id: "eqmq4prcya", name: "Pull-up Bar / Doorway Bar", category: "pullup" },
  { id: "eqmq4prcyb", name: "Bench or Sturdy Chair", category: "bench" },
];

export const ORIGINAL_HOME_EQUIPMENT_IDS = new Set(
  ORIGINAL_HOME_EQUIPMENT.map((item) => item.id),
);

const BODYWEIGHT_EQUIPMENT_ID = "eq-bodyweightonly";

export type HomeEquipmentCatalogRow = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  productUrl: string | null;
  imageUrl: string | null;
};

/** Original named kit + home-only rows. Shop SKUs (product links) stay off this list. */
export function homeEquipmentFromCatalog(
  catalog: HomeEquipmentCatalogRow[],
): HomeEquipmentCatalogRow[] {
  const homeOnly = catalog.filter((item) => !item.productUrl?.trim());
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
    merged.push({ ...item, productUrl: null });
  }

  return merged.sort((a, b) => {
    if (a.id === BODYWEIGHT_EQUIPMENT_ID) return -1;
    if (b.id === BODYWEIGHT_EQUIPMENT_ID) return 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}
