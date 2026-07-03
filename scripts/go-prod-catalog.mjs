#!/usr/bin/env node
/**
 * Go-live: migrate Postgres schema + import blob catalog + verify.
 *
 * Requires real DATABASE_URL + DIRECT_URL in env (or .env).
 *
 * Usage:
 *   npm run go-prod:catalog
 *   DATABASE_URL=... DIRECT_URL=... npm run go-prod:catalog
 */

import { spawnSync } from "node:child_process";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.vercel.prod" });
dotenv.config({ path: ".env.local" });
// Supabase / Vercel production vars must win over local dummy DATABASE_URL.
dotenv.config({ path: ".env.vercel.production", override: true });

function resolveUrl() {
  const postgres =
    process.env.POSTGRES_PRISMA_URL ?? process.env.POSTGRES_URL ?? "";
  const database = process.env.DATABASE_URL ?? "";
  if (postgres) return postgres;
  if (database && !database.includes("dummy")) return database;
  return "";
}

function resolveDirect(fallback) {
  const direct = process.env.DIRECT_URL ?? "";
  if (direct && !direct.includes("dummy")) return direct;
  return process.env.POSTGRES_URL_NON_POOLING ?? fallback;
}

const url = resolveUrl();
const direct = resolveDirect(url);

function fail(msg) {
  console.error(`\n❌ ${msg}`);
  process.exit(1);
}

if (!url || url.includes("dummy")) {
  fail("DATABASE_URL must be a real Postgres URL (not dummy). Run: vercel env pull .env.vercel.production");
}

console.log("\nGo-live catalog migration\n");
console.log(
  `DB host: ${url.replace(/postgres(ql)?:\/\/[^@]+@/, "postgres://***@").split("?")[0]}\n`,
);

const childEnv = { ...process.env, DATABASE_URL: url, DIRECT_URL: direct };

function run(cmd, args) {
  console.log(`→ ${cmd} ${args.join(" ")}`);
  const res = spawnSync(cmd, args, {
    stdio: "inherit",
    env: childEnv,
  });
  if (res.status !== 0) fail(`${cmd} exited ${res.status}`);
}

// Fresh Supabase via Vercel: use db push (legacy migrations contain SQLite types).
run("npx", ["prisma", "db", "push", "--accept-data-loss"]);
run("npm", ["run", "db:import-catalog"]);
run("npm", ["run", "db:import-enrollments"]);
run("npm", ["run", "db:import-logs"]);

console.log("\n✅ Schema migrated, catalog + enrollments + logs imported.\n");
console.log("Next: redeploy production (git push main or vercel deploy --prod)\n");
console.log("Then verify: BASE_URL=https://www.thetrainstation.co COACH_PASSWORD=… npm run test:s2e\n");