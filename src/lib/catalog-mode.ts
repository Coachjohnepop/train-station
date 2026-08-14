import { isDatabaseConfigured, resolveDatabaseUrl } from "@/lib/database-config";

/** True when coach catalog reads/writes demo JSON + Vercel Blob instead of Postgres. */
export function isCoachCatalogDemo(): boolean {
  const url = resolveDatabaseUrl();
  if (!isDatabaseConfigured()) return true;
  return url.includes("dummy");
}

/** Workouts, program days, and exercise lines live in Postgres. No blob catalog. */
export function catalogUsesDatabase(): boolean {
  return !isCoachCatalogDemo();
}

export function catalogStorageLabel(): "demo" | "database" {
  return isCoachCatalogDemo() ? "demo" : "database";
}