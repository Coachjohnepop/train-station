#!/usr/bin/env node
/**
 * Seed demo/member-workout-logs.json and demo/member-enrollments.json on blob
 * from committed prisma/*.dev.json (one-time or after local seed edits).
 */
import { readFileSync } from "fs";
import { join } from "path";
import { blobOptions } from "./remove-member-email.mjs";
import { put } from "@vercel/blob";

const ROOT = join(process.cwd(), "prisma");

async function writeJson(path, data) {
  await put(path, JSON.stringify(data, null, 2), {
    ...blobOptions(),
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

const logs = JSON.parse(readFileSync(join(ROOT, "logs.dev.json"), "utf8"));
const enrollments = JSON.parse(readFileSync(join(ROOT, "enrollments.dev.json"), "utf8"));

await writeJson("demo/member-workout-logs.json", logs);
await writeJson("demo/member-enrollments.json", enrollments);

console.log("✓ Seeded blob member progress stores");
console.log(`  logs: ${(logs.workoutLogs || []).length} workout logs`);
console.log(`  enrollments: ${Object.keys(enrollments).length} users`);