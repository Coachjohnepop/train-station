#!/usr/bin/env node
/**
 * Point Adult W1/W2 at the personal week flow:
 *   D1 Upper · D2 Lower · D3 Fasted Cardio · D4 Upper · D5 Lower
 *   D6 Active Recovery Stretch · D7 Rest and Meal Prep
 *
 *   npx tsx scripts/ensure-adult-week-flow.mjs
 *   DRY_RUN=1 npx tsx scripts/ensure-adult-week-flow.mjs
 */
import dotenv from "dotenv";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.go-prod", override: true });

const { ensureAdultWeekFlow } = await import("../src/lib/seed-adult-week-flow.ts");

const result = await ensureAdultWeekFlow({ weeks: [1, 2] });
console.log("Adult week flow", result);
process.exit(0);
