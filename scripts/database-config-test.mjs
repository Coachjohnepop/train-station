#!/usr/bin/env node
/**
 * database-config — skip dummy DATABASE_URL when POSTGRES_PRISMA_URL is real.
 */
import assert from "node:assert/strict";

const ORIGINAL = { ...process.env };

function restore() {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL)) delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL);
}

async function run() {
  try {
    process.env.DATABASE_URL = "postgresql://postgres:pass@db.dummy.supabase.co:6543/postgres";
    process.env.POSTGRES_PRISMA_URL =
      "postgresql://postgres:real@db.real.supabase.co:6543/postgres?pgbouncer=true";
    delete process.env.POSTGRES_URL;

    const mod = await import("../src/lib/database-config.ts");
    assert.equal(mod.resolveDatabaseUrl().includes("db.real.supabase.co"), true);
    assert.equal(mod.isDatabaseConfigured(), true);
    console.log("✅ resolveDatabaseUrl prefers real POSTGRES_PRISMA_URL over dummy DATABASE_URL");
  } finally {
    restore();
  }
}

run().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});