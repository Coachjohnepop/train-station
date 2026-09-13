#!/usr/bin/env node
/**
 * Full Postgres snapshot to Desktop (includes password hashes — keep offline).
 *
 *   npx tsx scripts/_full-postgres-backup.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import dotenv from "dotenv";
dotenv.config({ path: ".env", quiet: true });
dotenv.config({ path: ".env.go-prod", override: true, quiet: true });

const OUT_DIR =
  process.env.CATALOG_SNAPSHOT_DIR ||
  "/Users/johnpopham/Desktop/Stuff/Lemon Voice/The Train Station/backups";

async function main() {
  const { buildPostgresBackup } = await import("../src/lib/postgres-backup.ts");
  const result = await buildPostgresBackup({ redactSecrets: false });
  mkdirSync(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const file = join(OUT_DIR, `full-${stamp}.json.gz`);
  writeFileSync(file, result.gzip);
  console.log("wrote", file);
  console.log("uncompressed", result.bytesUncompressed);
  console.log("gzip", result.gzip.length);
  console.log("tables", Object.keys(result.tables).length);
  console.log("skipped", result.skipped);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
