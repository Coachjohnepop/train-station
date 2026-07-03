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

dotenv.config({ path: ".env.vercel.production" });
dotenv.config({ path: ".env.vercel.prod" });
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const url = process.env.DATABASE_URL ?? "";
const direct = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "";

function fail(msg) {
  console.error(`\n❌ ${msg}`);
  process.exit(1);
}

if (!url || url.includes("dummy")) {
  fail("DATABASE_URL must be a real Postgres URL (not dummy). Run: vercel env pull .env.vercel.production");
}

console.log("\nGo-live catalog migration\n");
console.log(`DB host: ${url.replace(/postgresql:\/\/[^@]+@/, "postgresql://***@").split("?")[0]}\n`);

function run(cmd, args) {
  console.log(`→ ${cmd} ${args.join(" ")}`);
  const res = spawnSync(cmd, args, {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: direct },
  });
  if (res.status !== 0) fail(`${cmd} exited ${res.status}`);
}

run("npx", ["prisma", "migrate", "deploy"]);
run("npm", ["run", "db:import-catalog"]);

console.log("\n✅ Schema migrated and catalog imported.\n");
console.log("Next: redeploy production (git push main or vercel deploy --prod)\n");
console.log("Then verify: BASE_URL=https://www.thetrainstation.co COACH_PASSWORD=… npm run test:s2e\n");