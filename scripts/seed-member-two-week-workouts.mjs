#!/usr/bin/env node
/**
 * Seed demo workout logs + enrollment for a member across two program weeks.
 *
 * Usage:
 *   node scripts/seed-member-two-week-workouts.mjs member-8888cb23-f25
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const ROOT = join(process.cwd(), "prisma");
const USER_ID = process.argv[2]?.trim() || "member-8888cb23-f25";

const ADULT_WEEK_WORKOUTS = [
  // Week 1
  ["new-w-1782218533238", "2026-06-22T18:00:00.000Z"],
  ["cmpzkks91001l95rzheuz6vkw", "2026-06-23T18:00:00.000Z"],
  ["cmpzkksjf002a95rzjvmo70ms", "2026-06-24T18:00:00.000Z"],
  ["cmpzkkskt002e95rzrk2vgaj3", "2026-06-25T18:00:00.000Z"],
  ["cmpzkksoo002p95rz7407826d", "2026-06-26T18:00:00.000Z"],
  ["cmpzklxt5008i95rzevusgiq7", "2026-06-27T18:00:00.000Z"],
  // Week 2 (optional ahead-of-today logs for review — skip today W1D7)
];

function readJson(file) {
  return JSON.parse(readFileSync(join(ROOT, file), "utf8"));
}

function writeJson(file, data) {
  writeFileSync(join(ROOT, file), `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

const enrollments = readJson("enrollments.dev.json");
enrollments[USER_ID] = {
  adult: { currentWeek: 1, currentDay: 7 },
};

const logs = readJson("logs.dev.json");
const existing = (logs.workoutLogs || []).filter((l) => l.userId !== USER_ID);
const seeded = ADULT_WEEK_WORKOUTS.map(([workoutId, performedAt], idx) => ({
  id: `log-${USER_ID}-w1d${idx + 1}`,
  userId: USER_ID,
  workoutId,
  performedAt,
  completed: true,
  progress: 100,
}));

logs.workoutLogs = [...existing, ...seeded];
logs.performances = logs.performances || [];

writeJson("enrollments.dev.json", enrollments);
writeJson("logs.dev.json", logs);

console.log(`✓ Seeded ${seeded.length} workout logs for ${USER_ID}`);
console.log(`  Enrollment: adult W1D7`);
console.log("  Past days W1D1–W1D6 marked complete on the day wheel.");