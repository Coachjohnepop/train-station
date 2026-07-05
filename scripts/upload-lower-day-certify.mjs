#!/usr/bin/env node
/**
 * Upload Jeremy Lower Day workout, fix parse/catalog quirks, certify, email export.
 *
 * Usage:
 *   EXPORT_TO=john@thetrainstation.co node scripts/upload-lower-day-certify.mjs
 *   KEEP_WORKOUT=1 node scripts/upload-lower-day-certify.mjs
 */

import { readFileSync } from "node:fs";
import { createCoachClient } from "./lib/coach-auth.mjs";

const BASE = process.env.BASE_URL || "https://www.thetrainstation.co";
const EXPORT_TO = process.env.EXPORT_TO || "john@thetrainstation.co";
const KEEP_WORKOUT = process.env.KEEP_WORKOUT === "1";
const { req, loginCoach } = createCoachClient(BASE);

const RAW_TEXT = `Lower Day 

Warm up bicycle or walk at 3.3 on treadmill at 7.0 incline 
5 mins 

Rest periods are 1:30 min 

Upper body warm up 
Band exercises 
Dumbbell bicep curls 20
Dumbbell shoulder press 20

25 air squats 

leg press 
20 sec hold at bottom of lift 
Then burnout reps immediately 
4 sets 
Stay flexible

Barbell Hip thrust, back on bench hold at top of squeeze
30 sec then immediately burnout reps x 4 sets 

Seated calve raises machine or standing cave raises with weight single leg 
30 sec hold at top of squeeze
Then 15 reps immediately x 4 sets 

Dumbbell Bulgarians split squats 
Hold at bottom of lift 20 sec 
Then burn out reps immediately 
3 sets each leg 

HIIT jump squats to finish
8 rounds on 20sec

Stretch`;

/** Certified export — cleaned plain text for future re-upload. */
const EXPORT_TEXT = `Lower Day

Warm up bicycle or walk at 3.3 on treadmill at 7.0 incline
5 mins
Rest periods are 1:30 min
Upper body warm up
Band exercises

Dumbbell bicep curls
20

Dumbbell shoulder press
20

Air squats
25

Leg press
20 sec hold at bottom of lift
Then burnout reps immediately
4 sets
Stay flexible

Barbell Hip thrust, back on bench hold at top of squeeze
30 sec then immediately burnout reps
4 sets

Seated calve raises machine or standing calf raises with weight single leg
30 sec hold at top of squeeze
Then 15 reps immediately
4 sets

Dumbbell Bulgarians split squats
Hold at bottom of lift 20 sec
Then burn out reps immediately
3 sets each leg

HIIT jump squats to finish
8 rounds on 20sec

Stretch`;

const NOTE_FIXES = [
  {
    match: /leg press/i,
    sets: 4,
    notes:
      "20 sec hold at bottom of lift · Then burnout reps immediately · Stay flexible",
  },
  {
    match: /hip thrust/i,
    sets: 4,
    notes: "30 sec hold at top of squeeze · Then immediately burnout reps",
  },
  {
    match: /calve|calf/i,
    sets: 4,
    notes:
      "30 sec hold at top of squeeze · Then 15 reps immediately · Single leg",
  },
  {
    match: /bulgarian/i,
    sets: 3,
    notes:
      "Hold at bottom of lift 20 sec · Then burn out reps immediately · Each leg",
  },
];

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

function pass(msg, detail = "") {
  console.log(`✅ ${msg}${detail ? ` — ${detail}` : ""}`);
}

function fail(msg, detail = "") {
  console.log(`❌ ${msg}${detail ? ` — ${detail}` : ""}`);
}

async function sendExportEmail({ workoutName, workoutId, exportText }) {
  const apiKey = loadEnvKey("RESEND_API_KEY");
  const from =
    loadEnvKey("LEAD_NOTIFY_FROM") ||
    "Train Station Leads <leads@send.buyecodelight.com>";

  if (!apiKey) {
    fail("Email export", "RESEND_API_KEY missing");
    return false;
  }

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
      subject: `Certified workout export — ${workoutName}`,
      text: [
        "Train Station — Lower Day certified export",
        "",
        `Workout: ${workoutName}`,
        `ID: ${workoutId}`,
        `Admin: https://www.thetrainstation.co/admin/workouts/${workoutId}`,
        "",
        "Use this plain-text format for future uploads:",
        "",
        "──────── certified export ────────",
        "",
        exportText,
        "",
        "──────── end export ────────",
      ].join("\n"),
    }),
  });

  if (!res.ok) {
    fail("Email export", `${res.status} ${(await res.text()).slice(0, 200)}`);
    return false;
  }
  pass("Email export sent", EXPORT_TO);
  return true;
}

async function main() {
  console.log(`\nLower Day upload + certify\nBASE: ${BASE}\n`);

  if (!(await loginCoach({ onPass: pass, onFail: fail }))) process.exit(1);

  const parse = await req("/api/text-upload/parse", {
    method: "POST",
    json: { mode: "workout", rawText: RAW_TEXT },
  });
  if (!parse.res.ok) {
    fail("Parse preview", parse.res.status);
    process.exit(1);
  }
  const blocks = parse.body?.workout?.exercises?.length ?? 0;
  pass("Parse preview", `${blocks} blocks — "${parse.body?.workout?.title}"`);

  const build = await req("/api/text-upload/build", {
    method: "POST",
    json: { mode: "workout", rawText: RAW_TEXT, workoutName: "Lower Day" },
  });
  if (!build.res.ok || !build.body?.workoutId) {
    fail("Upload to Postgres", build.body?.error || build.res.status);
    process.exit(1);
  }
  const workoutId = build.body.workoutId;
  pass("Upload to Postgres", workoutId);

  let workout = (await req(`/api/workouts/${workoutId}`)).body;
  if (!workout?.exercises?.length) {
    fail("Workout in library", "no exercises");
    process.exit(1);
  }

  console.log("\nUploaded exercises:");
  for (const item of workout.exercises) {
    console.log(
      `  • ${item.exercise?.name} — sets ${item.sets ?? "?"} · reps ${item.reps ?? "—"}`,
    );
  }

  let fixes = 0;
  for (const fix of NOTE_FIXES) {
    const item = workout.exercises.find((row) =>
      fix.match.test(row.exercise?.name || ""),
    );
    if (!item) continue;
    const needsPatch =
      item.sets !== fix.sets ||
      (item.notes || "") !== fix.notes ||
      !item.reps ||
      item.reps === "—";
    if (!needsPatch) continue;
    const patch = await req(`/api/workouts/${workoutId}/exercises`, {
      method: "PATCH",
      json: {
        itemId: item.id,
        sets: fix.sets,
        notes: fix.notes,
        reps: item.reps && item.reps !== "—" ? item.reps : "burnout",
      },
    });
    if (patch.res.ok) {
      fixes += 1;
      pass("Fixed prescription", item.exercise.name);
    } else {
      fail("Fix prescription", item.exercise?.name);
    }
  }
  if (fixes === 0) pass("Prescriptions", "no fixes needed");

  workout = (await req(`/api/workouts/${workoutId}`)).body;

  const certify = await req(`/api/workouts/${workoutId}`, {
    method: "PATCH",
    json: {
      exportText: EXPORT_TEXT,
      certifiedAt: new Date().toISOString(),
    },
  });
  if (!certify.res.ok || !certify.body?.certifiedAt) {
    fail("Certify workout", certify.res.status);
    process.exit(1);
  }
  pass("Certify workout", "exportText saved");

  const reload = (await req(`/api/workouts/${workoutId}`)).body;
  if (reload.exportText?.includes("Lower Day") && reload.certifiedAt) {
    pass("Export persisted", `${reload.exportText.length} chars`);
  } else {
    fail("Export persisted");
    process.exit(1);
  }

  await sendExportEmail({
    workoutName: reload.name,
    workoutId,
    exportText: reload.exportText,
  });

  if (!KEEP_WORKOUT) {
    pass("Workout kept in library", workoutId);
  }

  console.log("\nDone.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});