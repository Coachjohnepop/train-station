#!/usr/bin/env node
/**
 * Read-only prod check: CoachZoomOAuth isolation + multi-coach readiness notes.
 *
 *   npx tsx scripts/zoom-multi-coach-isolation-check.mjs
 *   BASE_URL=https://www.thetrainstation.co npx tsx scripts/zoom-multi-coach-isolation-check.mjs
 *
 * Loads DATABASE_URL from .env.vercel.live.check / .env if present.
 */
import dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { createPgPool } from "../src/lib/pg-connection.ts";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.go-prod", override: true });
dotenv.config({ path: ".env.vercel.live.check", override: true });

const BASE = (process.env.BASE_URL || "https://www.thetrainstation.co").replace(/\/$/, "");

async function main() {
  console.log(`\nZoom multi-coach isolation check → ${BASE}\n`);

  const pool = createPgPool(process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL);
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const rows = await prisma.$queryRawUnsafe(`
    SELECT id, "zoomUserId", email, "displayName", "connectedAt", "connectedByEmail", "updatedAt",
           CASE WHEN "refreshToken" IS NOT NULL AND length("refreshToken") > 0 THEN true ELSE false END as has_token
    FROM "CoachZoomOAuth"
    ORDER BY "updatedAt" DESC
  `);

  console.log("CoachZoomOAuth rows:", JSON.stringify(rows, null, 2));

  const byId = new Map(rows.map((r) => [String(r.id).toLowerCase(), r]));
  const jeremy = byId.get("jeremy@thetrainstation.co");
  const john = byId.get("john@thetrainstation.co");
  const legacy = byId.get("coach");

  let ok = true;

  if (legacy?.has_token) {
    console.log("⚠️  Legacy singleton id=coach still has a token — multi-coach prefers per-email rows.");
  } else {
    console.log("✅ No active legacy singleton (id=coach) with token");
  }

  if (jeremy?.has_token) {
    console.log("✅ Jeremy row present with refresh token");
  } else {
    console.log("⚠️  Jeremy row missing or no token — he should Connect under his login");
    ok = false;
  }

  if (john?.has_token) {
    console.log("✅ John row present with refresh token (second coach connected)");
  } else {
    console.log("ℹ️  John has no CoachZoomOAuth row yet — expected until he Connects as john@…");
  }

  // Isolation invariant: each row id should equal connectedByEmail (normalized)
  for (const r of rows) {
    const id = String(r.id).toLowerCase();
    const by = String(r.connectedByEmail || "").toLowerCase();
    if (id === "coach") continue;
    if (by && id !== by) {
      console.log(`⚠️  Mismatch id=${id} connectedByEmail=${by}`);
      ok = false;
    }
  }

  console.log(`
Isolation model (code):
  • save  → upsert where id = lower(coach login email)
  • disconnect → delete only that coach’s id / connectedByEmail
  • John Connect cannot overwrite id=jeremy@thetrainstation.co

Ops checklist: JEREMY_ADMIN_MANUAL.md → "Checklist: add coach 2…n (Zoom)"
`);

  await prisma.$disconnect();
  await pool.end();
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
