import {
  hydrateDemoUserSettings,
  readDemoUserSettingsSync,
  updateDemoUserSettings as persistDemoUserSettings,
  type DemoUserSettings,
} from "@/lib/demo-user-settings-store";

export type { DemoUserSettings };
export { hydrateDemoUserSettings };

export function isDemoMode() {
  const url = process.env.DATABASE_URL ?? "";
  return !url || url.includes("dummy.supabase") || url.includes("dummy");
}

/** Sync read after hydrateDemoUserSettings() has run in the request. */
export function getDemoUserSettings(userId: string = "demo-user"): DemoUserSettings {
  return readDemoUserSettingsSync(userId);
}

export async function updateDemoUserSettings(
  userId: string,
  updates: Partial<DemoUserSettings>,
) {
  return persistDemoUserSettings(userId, updates);
}