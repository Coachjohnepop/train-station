import fs from "fs";
import path from "path";
import { hydrateJsonStore, persistJsonStore, readLocalJson } from "@/lib/demo-json-blob";

const DEV_FILE = path.join(process.cwd(), "prisma", "user-equipment.dev.json");
const BLOB_PATH = "demo/user-equipment.json";
const SEED_PATH = path.join(process.cwd(), "prisma", "seed-data.json");

export type DemoUserEquipment = {
  equipmentId: string;
  hasAtHome: boolean;
  quantity?: number;
  notes?: string;
};

type EquipmentStore = Record<string, DemoUserEquipment[]>;

let memoryStore: EquipmentStore | null = null;

const DEMO_USER_DEFAULTS: DemoUserEquipment[] = [
  { equipmentId: "eq-bodyweightonly", hasAtHome: true, quantity: 1 },
  { equipmentId: "eq-dumbbellspair", hasAtHome: true, quantity: 1, notes: "Adjustable 5-25lb" },
  { equipmentId: "eq-resistancebands", hasAtHome: true, quantity: 3 },
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
  return [];
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

function loadSeedEquipment(): Array<{ id: string; name: string; category?: string; description?: string }> {
  try {
    const seed = JSON.parse(fs.readFileSync(SEED_PATH, "utf8"));
    return seed.equipment || [];
  } catch {
    return [];
  }
}

export async function getAllEquipmentWithUserStatus(userId?: string) {
  const seedEquipment = loadSeedEquipment();
  const uid = userId || "demo-user";
  const userEq = await getUserEquipment(uid);
  const userMap = new Map(userEq.map((u) => [u.equipmentId, u]));

  return seedEquipment.map((eq) => {
    const userItem = userMap.get(eq.id);
    return {
      ...eq,
      hasAtHome: userItem ? userItem.hasAtHome : false,
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