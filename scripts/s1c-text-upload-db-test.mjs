#!/usr/bin/env node
/**
 * Text upload → Postgres workout persistence + certify export.
 *
 * Usage:
 *   BASE_URL=https://www.thetrainstation.co npm run test:s1c
 */

import { createCoachClient } from "./lib/coach-auth.mjs";

const BASE = process.env.BASE_URL || "https://www.thetrainstation.co";
const MARKER = `S1C-${Date.now()}`;
const { req, loginCoach } = createCoachClient(BASE);
const results = [];

function pass(name, detail = "") {
  results.push({ ok: true });
  console.log(`✅ ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name, detail = "") {
  results.push({ ok: false });
  console.log(`❌ ${name}${detail ? ` — ${detail}` : ""}`);
}

const workoutText = `${MARKER} Upper Smoke

Warm up 3 min row

Temp push-up test
10,10,10

Band pull-apart
15,15,15`;

async function main() {
  console.log(`\nS1c text upload DB test\nBASE: ${BASE}\n`);

  if (!(await loginCoach({ onPass: pass, onFail: fail }))) {
    process.exit(1);
  }

  const persistence = await req("/api/admin/demo-persistence");
  if (!persistence.res.ok || persistence.body?.demoMode) {
    fail("Database mode", persistence.body?.demoMode ? "still demo" : `${persistence.res.status}`);
    process.exit(1);
  }
  pass("Database mode", "text upload writes to Postgres");

  const build = await req("/api/text-upload/build", {
    method: "POST",
    json: { mode: "workout", rawText: workoutText, workoutName: `${MARKER} Workout` },
  });
  if (!build.res.ok || !build.body?.workoutId) {
    fail("Build workout from text", build.body?.error || build.res.status);
    process.exit(1);
  }
  const workoutId = build.body.workoutId;
  pass("Build workout from text", workoutId);

  const detail = await req(`/api/workouts/${workoutId}`);
  if (
    !detail.res.ok ||
    !detail.body?.exercises?.length ||
    detail.body.description !== "Created from text upload"
  ) {
    fail("Workout persisted in library", `${detail.body?.exercises?.length ?? 0} exercises`);
    process.exit(1);
  }
  pass("Workout persisted in library", `${detail.body.exercises.length} exercises`);

  const exportText = workoutText.trim();
  const certify = await req(`/api/workouts/${workoutId}`, {
    method: "PATCH",
    json: { exportText, certifiedAt: new Date().toISOString() },
  });
  if (!certify.res.ok || !certify.body?.certifiedAt || !certify.body?.exportText) {
    fail("Certify workout export", certify.res.status);
    process.exit(1);
  }
  pass("Certify workout export", "exportText saved");

  const reload = await req(`/api/workouts/${workoutId}`);
  if (reload.body?.exportText?.includes(MARKER) && reload.body?.certifiedAt) {
    pass("Certified export survives refresh");
  } else {
    fail("Certified export survives refresh");
  }

  const cleanup = await req(`/api/workouts/${workoutId}`, { method: "DELETE" });
  if (cleanup.res.status === 204) pass("Cleanup temp workout");
  else fail("Cleanup temp workout", cleanup.res.status);

  const ok = results.filter((r) => r.ok).length;
  console.log(`\n---\n${ok}/${results.length} passed\n`);
  process.exit(ok === results.length ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});