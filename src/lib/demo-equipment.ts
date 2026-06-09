import fs from "fs";
import path from "path";

const DEV_FILE = path.join(process.cwd(), "prisma", "user-equipment.dev.json");

export type DemoUserEquipment = {
  equipmentId: string;
  hasAtHome: boolean;
  quantity?: number;
  notes?: string;
};

function loadDemoUserEquipment(): DemoUserEquipment[] {
  if (fs.existsSync(DEV_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(DEV_FILE, "utf8"));
    } catch {}
  }
  // default from seed
  const initial: DemoUserEquipment[] = [
    { equipmentId: "eq-bodyweightonly", hasAtHome: true, quantity: 1 },
    { equipmentId: "eq-dumbbellspair", hasAtHome: true, quantity: 1, notes: "Adjustable 5-25lb" },
    { equipmentId: "eq-resistancebands", hasAtHome: true, quantity: 3 },
  ];
  try {
    fs.writeFileSync(DEV_FILE, JSON.stringify(initial, null, 2));
  } catch {}
  return initial;
}

function saveDemoUserEquipment(data: DemoUserEquipment[]) {
  try {
    fs.writeFileSync(DEV_FILE, JSON.stringify(data, null, 2));
  } catch {}
}

export function isDemoMode() {
  const url = process.env.DATABASE_URL ?? "";
  return !url || url.includes("dummy.supabase") || url.includes("dummy");
}

export function getDemoUserEquipment(): DemoUserEquipment[] {
  return loadDemoUserEquipment();
}

export function setDemoUserEquipment(equipmentList: DemoUserEquipment[]) {
  saveDemoUserEquipment(equipmentList);
}

// Helper to get all equipment with user's hasAtHome status (merged with seed)
const SEED_PATH = path.join(process.cwd(), "prisma", "seed-data.json");

export function getAllEquipmentWithUserStatus() {
  let seedEquipment: any[] = [];
  try {
    const seed = JSON.parse(fs.readFileSync(SEED_PATH, "utf8"));
    seedEquipment = seed.equipment || [];
  } catch {}

  const userEq = loadDemoUserEquipment();
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
