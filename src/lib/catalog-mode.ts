import { isDatabaseConfigured } from "@/lib/database-config";

/** True when coach catalog reads/writes demo JSON + Vercel Blob instead of Postgres. */
export function isCoachCatalogDemo(): boolean {
  const url = process.env.DATABASE_URL ?? "";
  if (!isDatabaseConfigured()) return true;
  return url.includes("dummy");
}

export function catalogStorageLabel(): "demo" | "database" {
  return isCoachCatalogDemo() ? "demo" : "database";
}