#!/usr/bin/env node
/**
 * PR-0 — blob migration config defaults and env overrides.
 *
 * Usage:
 *   node scripts/blob-migration-config-test.mjs
 */

import assert from "node:assert/strict";

const ORIGINAL_ENV = { ...process.env };

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL_ENV);
}

async function loadModule() {
  const mod = await import("../src/lib/blob-migration-config.ts");
  return mod;
}

function setDemoMode() {
  process.env.DATABASE_URL = "dummy";
}

function setProdMode() {
  process.env.DATABASE_URL =
    "postgresql://postgres:password@db.example.supabase.co:6543/postgres?pgbouncer=true";
}

async function run() {
  let passed = 0;
  let failed = 0;

  function ok(name) {
    passed++;
    console.log(`✅ ${name}`);
  }

  function fail(name, err) {
    failed++;
    console.log(`❌ ${name}${err ? ` — ${err}` : ""}`);
  }

  try {
    restoreEnv();
    setProdMode();
    delete process.env.BLOB_MIGRATION_MEMBER_PROFILES_READ;
    delete process.env.BLOB_MIGRATION_MEMBER_PROFILES_WRITE;

    const prod = await loadModule();
    assert.equal(prod.readMode("member-profiles"), "blob");
    assert.equal(prod.writeMode("member-profiles"), "blob");
    ok("prod defaults to blob read/write");

    process.env.BLOB_MIGRATION_MEMBER_PROFILES_READ = "db_with_blob_fallback";
    process.env.BLOB_MIGRATION_MEMBER_PROFILES_WRITE = "dual";
    const overridden = await loadModule();
    assert.equal(overridden.readMode("member-profiles"), "db_with_blob_fallback");
    assert.equal(overridden.writeMode("member-profiles"), "dual");
    assert.equal(overridden.readsFromDatabase("member-profiles"), true);
    assert.equal(overridden.writesToDatabase("member-profiles"), true);
    assert.equal(overridden.writesToBlob("member-profiles"), true);
    assert.equal(overridden.blobReadFallbackEnabled("member-profiles"), true);
    ok("env overrides apply in prod mode");

    restoreEnv();
    setDemoMode();
    process.env.BLOB_MIGRATION_MEMBER_PROFILES_READ = "db";
    process.env.BLOB_MIGRATION_MEMBER_PROFILES_WRITE = "db";
    const demo = await loadModule();
    assert.equal(demo.readMode("member-profiles"), "blob");
    assert.equal(demo.writeMode("member-profiles"), "blob");
    assert.equal(demo.readsFromDatabase("member-profiles"), false);
    ok("demo mode ignores migration env overrides");

    const status = demo.getBlobMigrationStatus();
    assert.equal(status.length, demo.BLOB_STORE_KEYS.length);
    assert.ok(status.every((row) => row.read === "blob" && row.write === "blob"));
    ok("getBlobMigrationStatus returns all stores");

    const parity = await import("../src/lib/blob-migration-parity.ts");
    const report = parity.compareBlobAndDbSnapshots("member-profiles", { a: 1 }, { a: 1 });
    assert.equal(report.matched, true);
    const bad = parity.compareBlobAndDbSnapshots("member-profiles", { a: 1 }, { a: 2 });
    assert.equal(bad.matched, false);
    assert.ok(bad.mismatches.length > 0);
    ok("parity compare detects mismatches");
  } catch (err) {
    fail("blob migration config tests", err instanceof Error ? err.message : String(err));
  } finally {
    restoreEnv();
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run();