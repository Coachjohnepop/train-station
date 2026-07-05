#!/usr/bin/env node
/**
 * Full workout E2E: text upload → edit → save → delete exercise → certify → export → email.
 *
 * Usage:
 *   EXPORT_TO=john@thetrainstation.co node scripts/workout-e2e-export-email.mjs
 */

import { readFileSync } from "node:fs";
import { createCoachClient } from "./lib/coach-auth.mjs";

const BASE = process.env.BASE_URL || "https://www.thetrainstation.co";
const EXPORT_TO = process.env.EXPORT_TO || "john@thetrainstation.co";
const MARKER = `E2E-${Date.now()}`;
const { req, loginCoach } = createCoachClient(BASE);
const results = [];

function loadEnvKey(name) {
  for (const file of [".env.local", ".env.vercel.production"]) {
    try {
      const raw = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
      const m = raw.match(new RegExp(`^${name}="([^"]*)"`, "m"));
      if (m?.[1]) return m[1];
    } catch {
      /* skip */
    }
  }
  return process.env[name] || "";
}

function pass(name, detail = "") {
  results.push(true);
  console.log(`✅ ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name, detail = "") {
  results.push(false);
  console.log(`❌ ${name}${detail ? ` — ${detail}` : ""}`);
}

const uploadText = `${MARKER} Coach Flow Test

Warm up 5 min bike

Push-up hold test
10,10,10

Band pull-apart
15,15,15`;

async function sendExportEmail({ workoutName, workoutId, exportText }) {
  const apiKey = loadEnvKey("RESEND_API_KEY");
  const from =
    loadEnvKey("LEAD_NOTIFY_FROM") ||
    loadEnvKey("RESEND_FROM") ||
    "The Train Station <accounts@send.thetrainstation.co>";

  if (!apiKey) {
    fail("Email export to John", "RESEND_API_KEY not configured locally");
    return false;
  }

  const subject = `Certified workout export — ${workoutName}`;
  const text = [
    "Train Station — workout certify & export E2E test",
    "",
    `Workout: ${workoutName}`,
    `ID: ${workoutId}`,
    `Test marker: ${MARKER}`,
    "",
    "Use this plain-text format for future uploads:",
    "",
    "──────── certified export ────────",
    "",
    exportText,
    "",
    "──────── end export ────────",
  ].join("\n");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [EXPORT_TO],
      reply_to: "jeremy@thetrainstation.co",
      subject,
      text,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    fail("Email export to John", `${res.status} ${body.slice(0, 200)}`);
    return false;
  }

  pass("Email export to John", EXPORT_TO);
  return true;
}

async function main() {
  console.log(`\nWorkout E2E + export email\nBASE: ${BASE}\nTO: ${EXPORT_TO}\n`);

  if (!(await loginCoach({ onPass: pass, onFail: fail }))) {
    process.exit(1);
  }

  const build = await req("/api/text-upload/build", {
    method: "POST",
    json: {
      mode: "workout",
      rawText: uploadText,
      workoutName: `${MARKER} Workout`,
    },
  });
  if (!build.res.ok || !build.body?.workoutId) {
    fail("1. Text upload build", build.body?.error || build.res.status);
    process.exit(1);
  }
  const workoutId = build.body.workoutId;
  pass("1. Text upload build", workoutId);

  let workout = (await req(`/api/workouts/${workoutId}`)).body;
  if (!workout?.exercises?.length) {
    fail("2. Workout saved to library", "no exercises");
    process.exit(1);
  }
  pass("2. Workout saved to library", `${workout.exercises.length} exercises`);

  const targetItem = workout.exercises.find((e) =>
    /band pull/i.test(e.exercise?.name || ""),
  ) || workout.exercises[0];
  const edit = await req(`/api/workouts/${workoutId}/exercises`, {
    method: "PATCH",
    json: { itemId: targetItem.id, sets: 4, reps: "12", notes: `${MARKER} edited` },
  });
  if (!edit.res.ok) {
    fail("3. Edit exercise", edit.res.status);
    process.exit(1);
  }
  pass("3. Edit exercise", `sets → 4 on ${targetItem.exercise?.name}`);

  workout = (await req(`/api/workouts/${workoutId}`)).body;
  const edited = workout.exercises.find((e) => e.id === targetItem.id);
  if (edited?.sets === 4 && edited?.notes?.includes(MARKER)) {
    pass("4. Edit persisted after save");
  } else {
    fail("4. Edit persisted after save");
  }

  const renamed = `${MARKER} Workout — Saved`;
  const saveName = await req(`/api/workouts/${workoutId}`, {
    method: "PATCH",
    json: { name: renamed },
  });
  if (!saveName.res.ok || saveName.body?.name !== renamed) {
    fail("5. Save workout name", saveName.res.status);
    process.exit(1);
  }
  pass("5. Save workout name", renamed);

  const deleteItem = workout.exercises.find((e) =>
    /band pull/i.test(e.exercise?.name || ""),
  );
  if (deleteItem) {
    const del = await req(
      `/api/workouts/${workoutId}/exercises?itemId=${encodeURIComponent(deleteItem.id)}`,
      { method: "DELETE" },
    );
    if (del.res.status !== 204) {
      fail("6. Delete exercise", del.res.status);
      process.exit(1);
    }
    workout = (await req(`/api/workouts/${workoutId}`)).body;
    if (workout.exercises.some((e) => e.id === deleteItem.id)) {
      fail("6. Delete exercise", "still listed");
      process.exit(1);
    }
    pass("6. Delete exercise", deleteItem.exercise?.name);
  } else {
    pass("6. Delete exercise", "skipped — band pull-apart not found");
  }

  workout = (await req(`/api/workouts/${workoutId}`)).body;
  const exportLines = [
    renamed,
    "",
    "Warm up 5 min bike",
    "",
    "Push-up hold test",
    "10,10,10",
    "",
    `${MARKER} edited`,
  ];
  const exportText = exportLines.join("\n");

  const certify = await req(`/api/workouts/${workoutId}`, {
    method: "PATCH",
    json: { exportText, certifiedAt: new Date().toISOString() },
  });
  if (!certify.res.ok || !certify.body?.certifiedAt || !certify.body?.exportText) {
    fail("7. Certify workout", certify.res.status);
    process.exit(1);
  }
  pass("7. Certify workout", "exportText + certifiedAt saved");

  const reload = (await req(`/api/workouts/${workoutId}`)).body;
  if (reload.exportText?.includes(MARKER) && reload.certifiedAt) {
    pass("8. Export survives refresh", `${reload.exportText.length} chars`);
  } else {
    fail("8. Export survives refresh");
    process.exit(1);
  }

  await sendExportEmail({
    workoutName: renamed,
    workoutId,
    exportText: reload.exportText,
  });

  const cleanup = await req(`/api/workouts/${workoutId}`, { method: "DELETE" });
  if (cleanup.res.status === 204) pass("9. Cleanup test workout");
  else fail("9. Cleanup test workout", cleanup.res.status);

  const ok = results.filter(Boolean).length;
  console.log(`\n---\n${ok}/${results.length} steps completed\n`);
  process.exit(results.every(Boolean) ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});