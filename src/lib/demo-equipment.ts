import fs from "fs";
import path from "path";

const DEV_FILE = path.join(process.cwd(), "prisma", "user-equipment.dev.json");

export type DemoUserEquipment = {
  equipmentId: string;
  hasAtHome: boolean;
  quantity?: number;
  notes?: string;
};

type EquipmentStore = Record<string, DemoUserEquipment[]>;

function loadEquipmentStore(): EquipmentStore {
  if (fs.existsSync(DEV_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(DEV_FILE, "utf8"));
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as EquipmentStore;
      }
      // legacy: single array -> under demo-user
      if (Array.isArray(parsed)) {
        return { "demo-user": parsed as DemoUserEquipment[] };
      }
    } catch {}
  }
  const initial: DemoUserEquipment[] = [
    { equipmentId: "eq-bodyweightonly", hasAtHome: true, quantity: 1 },
    { equipmentId: "eq-dumbbellspair", hasAtHome: true, quantity: 1, notes: "Adjustable 5-25lb" },
    { equipmentId: "eq-resistancebands", hasAtHome: true, quantity: 3 },
  ];
  const store: EquipmentStore = { "demo-user": initial };
  try {
    fs.writeFileSync(DEV_FILE, JSON.stringify(store, null, 2));
  } catch {}
  return store;
}

function saveEquipmentStore(store: EquipmentStore) {
  try {
    fs.writeFileSync(DEV_FILE, JSON.stringify(store, null, 2));
  } catch {}
}

function getUserEquipment(userId: string): DemoUserEquipment[] {
  const store = loadEquipmentStore();
  const uid = userId || "demo-user";
  let list = store[uid];
  if (!list || list.length === 0) {
    // fallback to demo-user defaults for new joined users in demo mode
    list = store["demo-user"] || [];
  }
  return list || [];
}

function setUserEquipment(userId: string, list: DemoUserEquipment[]) {
  const store = loadEquipmentStore();
  const uid = userId || "demo-user";
  store[uid] = list;
  saveEquipmentStore(store);
}

export function isDemoMode() {
  const url = process.env.DATABASE_URL ?? "";
  return !url || url.includes("dummy.supabase") || url.includes("dummy");
}

export function getDemoUserEquipment(userId?: string): DemoUserEquipment[] {
  return getUserEquipment(userId || "demo-user");
}

export function setDemoUserEquipment(equipmentList: DemoUserEquipment[], userId?: string) {
  setUserEquipment(userId || "demo-user", equipmentList);
}

// Helper to get all equipment with user's hasAtHome status (merged with seed)
const SEED_PATH = path.join(process.cwd(), "prisma", "seed-data.json");

export function getAllEquipmentWithUserStatus(userId?: string) {
  let seedEquipment: any[] = [];
  try {
    const seed = JSON.parse(fs.readFileSync(SEED_PATH, "utf8"));
    seedEquipment = seed.equipment || [];
  } catch {}

  const uid = userId || "demo-user";
  const userEq = getUserEquipment(uid);
  const userMap = new Map(userEq.map(u => [u.equipmentId, u]));

  return seedEquipment.map((eq: any) => {
    const userItem = userMap.get(eq.id);
    return {
      ...eq,
      hasAtHome: userItem ? userItem.hasAtHome : false,
      quantity: userItem?.quantity ?? 1,
      notes: userItem?.notes ?? eq.description ?? "",
    };
  });
}
