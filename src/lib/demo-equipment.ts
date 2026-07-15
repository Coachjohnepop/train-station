import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { hydrateJsonStore, persistJsonStore, readLocalJson } from "@/lib/demo-json-blob";

const DEV_FILE = path.join(process.cwd(), "prisma", "user-equipment.dev.json");
const BLOB_PATH = "demo/user-equipment.json";
const CATALOG_DEV_FILE = path.join(process.cwd(), "prisma", "equipment-catalog.dev.json");
const CATALOG_BLOB_PATH = "demo/equipment-catalog.json";
const SEED_PATH = path.join(process.cwd(), "prisma", "seed-data.json");

export type DemoEquipmentCatalogItem = {
  id: string;
  name: string;
  category?: string | null;
  description?: string | null;
  productUrl?: string | null;
  imageUrl?: string | null;
  createdAt?: string;
};

export type DemoUserEquipment = {
  equipmentId: string;
  hasAtHome: boolean;
  quantity?: number;
  notes?: string;
};

type EquipmentStore = Record<string, DemoUserEquipment[]>;

let memoryStore: EquipmentStore | null = null;

const BODYWEIGHT_EQUIPMENT_ID = "eq-bodyweightonly";

const DEMO_USER_DEFAULTS: DemoUserEquipment[] = [
  { equipmentId: BODYWEIGHT_EQUIPMENT_ID, hasAtHome: true, quantity: 1 },
  { equipmentId: "eq-dumbbellspair", hasAtHome: true, quantity: 1, notes: "Adjustable 5-25lb" },
  { equipmentId: "eq-resistancebands", hasAtHome: true, quantity: 3 },
];

/** Real members with no saved gear yet — bodyweight assumed unless they uncheck it. */
const NEW_MEMBER_EQUIPMENT_DEFAULTS: DemoUserEquipment[] = [
  { equipmentId: BODYWEIGHT_EQUIPMENT_ID, hasAtHome: true, quantity: 1 },
];

function seedStoreFromDisk(): EquipmentStore {
  const fromDisk = readLocalJson<EquipmentStore>(DEV_FILE);
  if (fromDisk && typeof fromDisk === "object" && !Array.isArray(fromDisk)) {
    return fromDisk;
  }
  if (Array.isArray(fromDisk)) {
    return { "demo-user": fromDisk as DemoUserEquipment[] };
  }
  return { "demo-user": DEMO_USER_DEFAULTS };
}

async function loadEquipmentStore(): Promise<EquipmentStore> {
  const hydrated = await hydrateJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    memory: memoryStore,
    setMemory: (v) => {
      memoryStore = v as EquipmentStore;
    },
    fallback: seedStoreFromDisk,
  });
  memoryStore = hydrated as EquipmentStore;
  return memoryStore;
}

async function saveEquipmentStore(store: EquipmentStore): Promise<void> {
  await persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    data: store,
    setMemory: (v) => {
      memoryStore = v as EquipmentStore;
    },
  });
}

function shouldUseDemoDefaults(userId: string): boolean {
  return userId === "demo-user" || userId.startsWith("demo-user-");
}

async function getUserEquipment(userId: string): Promise<DemoUserEquipment[]> {
  const store = await loadEquipmentStore();
  const uid = userId || "demo-user";
  const list = store[uid];
  if (list && list.length > 0) return list;
  if (shouldUseDemoDefaults(uid)) {
    return store["demo-user"]?.length ? store["demo-user"] : DEMO_USER_DEFAULTS;
  }
  return NEW_MEMBER_EQUIPMENT_DEFAULTS;
}

export function isDemoMode() {
  const url = process.env.DATABASE_URL ?? "";
  return !url || url.includes("dummy.supabase") || url.includes("dummy");
}

export async function getDemoUserEquipment(userId?: string): Promise<DemoUserEquipment[]> {
  return getUserEquipment(userId || "demo-user");
}

export async function setDemoUserEquipment(equipmentList: DemoUserEquipment[], userId?: string) {
  const store = await loadEquipmentStore();
  const uid = userId || "demo-user";
  store[uid] = equipmentList;
  await saveEquipmentStore(store);
}

function loadSeedEquipment(): DemoEquipmentCatalogItem[] {
  try {
    const seed = JSON.parse(fs.readFileSync(SEED_PATH, "utf8"));
    return seed.equipment || [];
  } catch {
    return [];
  }
}

type CatalogStore = {
  items: DemoEquipmentCatalogItem[];
  deletedIds: string[];
};

let catalogMemory: CatalogStore | null = null;

function emptyCatalogStore(): CatalogStore {
  return { items: [], deletedIds: [] };
}

function normalizeCatalogStore(raw: unknown): CatalogStore {
  if (Array.isArray(raw)) {
    return { items: raw as DemoEquipmentCatalogItem[], deletedIds: [] };
  }
  if (raw && typeof raw === "object") {
    const obj = raw as Partial<CatalogStore>;
    return {
      items: Array.isArray(obj.items) ? obj.items : [],
      deletedIds: Array.isArray(obj.deletedIds) ? obj.deletedIds : [],
    };
  }
  return emptyCatalogStore();
}

function mergeEquipmentCatalogs(store: CatalogStore): DemoEquipmentCatalogItem[] {
  const deleted = new Set(store.deletedIds);
  const byId = new Map<string, DemoEquipmentCatalogItem>();
  for (const item of loadSeedEquipment()) {
    if (item?.id && !deleted.has(item.id)) byId.set(item.id, { ...item });
  }
  for (const item of store.items) {
    if (item?.id) byId.set(item.id, { ...item });
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

async function loadEquipmentCatalogStore(): Promise<DemoEquipmentCatalogItem[]> {
  const hydrated = await hydrateJsonStore({
    blobPath: CATALOG_BLOB_PATH,
    localPath: CATALOG_DEV_FILE,
    memory: catalogMemory,
    setMemory: (value) => {
      catalogMemory = normalizeCatalogStore(value);
    },
    fallback: emptyCatalogStore,
  });
  catalogMemory = normalizeCatalogStore(hydrated);
  return mergeEquipmentCatalogs(catalogMemory);
}

async function saveEquipmentCatalogStore(store: CatalogStore): Promise<void> {
  catalogMemory = store;
  await persistJsonStore({
    blobPath: CATALOG_BLOB_PATH,
    localPath: CATALOG_DEV_FILE,
    data: store,
    setMemory: (value) => {
      catalogMemory = normalizeCatalogStore(value);
    },
  });
}

function currentCatalogStore(): CatalogStore {
  return catalogMemory ?? emptyCatalogStore();
}

export async function listDemoEquipmentCatalog(): Promise<DemoEquipmentCatalogItem[]> {
  return loadEquipmentCatalogStore();
}

export async function createDemoEquipmentItem(data: {
  name: string;
  category?: string | null;
  description?: string | null;
  productUrl?: string | null;
  imageUrl?: string | null;
}): Promise<DemoEquipmentCatalogItem> {
  const catalog = await loadEquipmentCatalogStore();
  const name = data.name.trim();
  if (catalog.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
    throw new Error("Equipment with that name already exists");
  }

  const created: DemoEquipmentCatalogItem = {
    id: `eq-${randomUUID().slice(0, 8)}`,
    name,
    category: data.category ?? null,
    description: data.description ?? null,
    productUrl: data.productUrl ?? null,
    imageUrl: data.imageUrl ?? null,
    createdAt: new Date().toISOString(),
  };

  const store = currentCatalogStore();
  store.items.push(created);
  await saveEquipmentCatalogStore(store);
  return created;
}

export async function updateDemoEquipmentItem(
  id: string,
  data: {
    name?: string;
    category?: string | null;
    description?: string | null;
    productUrl?: string | null;
    imageUrl?: string | null;
  },
): Promise<DemoEquipmentCatalogItem> {
  const catalog = await loadEquipmentCatalogStore();
  const existing = catalog.find((item) => item.id === id);
  if (!existing) throw new Error("Equipment not found");

  const nextName = data.name?.trim() ?? existing.name;
  if (
    catalog.some(
      (item) => item.id !== id && item.name.toLowerCase() === nextName.toLowerCase(),
    )
  ) {
    throw new Error("Equipment with that name already exists");
  }

  const updated: DemoEquipmentCatalogItem = {
    ...existing,
    name: nextName,
    category: data.category === undefined ? existing.category ?? null : data.category,
    description:
      data.description === undefined ? existing.description ?? null : data.description,
    productUrl:
      data.productUrl === undefined ? existing.productUrl ?? null : data.productUrl,
    imageUrl: data.imageUrl === undefined ? existing.imageUrl ?? null : data.imageUrl,
  };

  const store = currentCatalogStore();
  const index = store.items.findIndex((item) => item.id === id);
  if (index >= 0) {
    store.items[index] = updated;
  } else {
    store.items.push(updated);
  }
  await saveEquipmentCatalogStore(store);
  return updated;
}

export async function deleteDemoEquipmentItem(id: string): Promise<void> {
  const catalog = await loadEquipmentCatalogStore();
  if (!catalog.some((item) => item.id === id)) {
    throw new Error("Equipment not found");
  }

  const store = currentCatalogStore();
  store.items = store.items.filter((item) => item.id !== id);
  if (!store.deletedIds.includes(id)) store.deletedIds.push(id);
  await saveEquipmentCatalogStore(store);
}

export async function getAllEquipmentWithUserStatus(userId?: string) {
  const visibleCatalog = await loadEquipmentCatalogStore();
  const uid = userId || "demo-user";
  const userEq = await getUserEquipment(uid);
  const userMap = new Map(userEq.map((u) => [u.equipmentId, u]));

  return visibleCatalog.map((eq) => {
    const userItem = userMap.get(eq.id);
    return {
      ...eq,
      hasAtHome: userItem
        ? userItem.hasAtHome
        : eq.id === BODYWEIGHT_EQUIPMENT_ID,
      quantity: userItem?.quantity ?? 1,
      notes: userItem?.notes ?? eq.description ?? "",
    };
  });
}

/** Normalize client payload (uses `id` or `equipmentId`). */
export function normalizeEquipmentUpdates(
  updates: Array<{
    id?: string;
    equipmentId?: string;
    hasAtHome?: boolean;
    quantity?: number;
    notes?: string;
  }>,
): DemoUserEquipment[] {
  const out: DemoUserEquipment[] = [];
  for (const u of updates) {
    const equipmentId = u.equipmentId || u.id;
    if (!equipmentId) continue;
    out.push({
      equipmentId,
      hasAtHome: !!u.hasAtHome,
      quantity: u.quantity ?? 1,
      notes: u.notes,
    });
  }
  return out;
}