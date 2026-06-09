import fs from "fs";
import path from "path";

const DEV_FILE = path.join(process.cwd(), "prisma", "user-settings.dev.json");

export type DemoUserSettings = {
  phone: string | null;
  dailyReminderTime: string | null; // "HH:MM" format
};

function loadDemoUserSettings(): Record<string, DemoUserSettings> {
  if (fs.existsSync(DEV_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(DEV_FILE, "utf8"));
    } catch {}
  }
  const initial: Record<string, DemoUserSettings> = {
    "demo-user": {
      phone: "(555) 987-6543",
      dailyReminderTime: "07:30",
    },
  };
  try {
    fs.writeFileSync(DEV_FILE, JSON.stringify(initial, null, 2));
  } catch {}
  return initial;
}

function saveDemoUserSettings(data: Record<string, DemoUserSettings>) {
  try {
    fs.writeFileSync(DEV_FILE, JSON.stringify(data, null, 2));
  } catch {}
}

export function isDemoMode() {
  const url = process.env.DATABASE_URL ?? "";
  return !url || url.includes("dummy.supabase") || url.includes("dummy");
}

export function getDemoUserSettings(userId: string = "demo-user"): DemoUserSettings {
  const all = loadDemoUserSettings();
  return all[userId] || { phone: null, dailyReminderTime: null };
}

export function updateDemoUserSettings(
  userId: string,
  updates: Partial<DemoUserSettings>
) {
  const all = loadDemoUserSettings();
  const current = all[userId] || { phone: null, dailyReminderTime: null };
  const updated = { ...current, ...updates };
  all[userId] = updated;
  saveDemoUserSettings(all);
  return updated;
}
