#!/usr/bin/env node
/**
 * Data-room snapshot of storage / migration health (M&A Phase A).
 *
 * Uses logged-out public-ish endpoint when available, or inject prod env and
 * call the same helpers offline.
 *
 *   # From prod HTTP (no secrets; may be open — prefer staff session later):
 *   npx tsx scripts/snapshot-demo-persistence-prod.mjs --url https://www.thetrainstation.co
 *
 *   # From Vercel production env (DB truth):
 *   # hide local .env* then:
 *   vercel env run --environment production -- npx tsx scripts/snapshot-demo-persistence-prod.mjs --local
 */
import fs from "fs";
import path from "path";

const urlFlag = (() => {
  const i = process.argv.indexOf("--url");
  return i >= 0 ? process.argv[i + 1] : null;
})();
const local = process.argv.includes("--local");

async function fromHttp(base) {
  const res = await fetch(`${base.replace(/\/$/, "")}/api/admin/demo-persistence`, {
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  return { httpStatus: res.status, body };
}

async function fromLocalHelpers() {
  const { migrationPersistenceSnapshot, demoPersistenceHealth } = await import(
    "../src/lib/demo-persistence.ts"
  );
  const { isCoachCatalogDemo } = await import("../src/lib/catalog-mode.ts");
  const snapshot = migrationPersistenceSnapshot();
  if (!isCoachCatalogDemo()) {
    return {
      demoMode: false,
      durable: snapshot.databaseConfigured,
      catalogStorage: "database",
      ...snapshot,
      message: snapshot.databaseConfigured
        ? "Catalog and workouts save to Postgres."
        : "Postgres is not configured.",
    };
  }
  return {
    demoMode: true,
    catalogStorage: "demo",
    ...snapshot,
    ...(await demoPersistenceHealth()),
  };
}

async function main() {
  let payload;
  if (local) {
    payload = { source: "local-helpers", capturedAt: new Date().toISOString(), ...(await fromLocalHelpers()) };
  } else {
    const base = urlFlag || process.env.NEXT_PUBLIC_APP_URL || "https://www.thetrainstation.co";
    const { httpStatus, body } = await fromHttp(base);
    payload = {
      source: "http",
      base,
      httpStatus,
      capturedAt: new Date().toISOString(),
      ...body,
    };
  }

  const outDir = path.join(process.cwd(), "exports");
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = path.join(outDir, `demo-persistence-${stamp}.json`);
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
  console.log("Wrote", outPath);
  console.log(
    JSON.stringify(
      {
        demoMode: payload.demoMode,
        durable: payload.durable ?? payload.databaseConfigured,
        catalogStorage: payload.catalogStorage,
        databaseConfigured: payload.databaseConfigured ?? payload.migration?.databaseConfigured,
        httpStatus: payload.httpStatus,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
