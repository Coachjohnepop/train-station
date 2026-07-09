#!/usr/bin/env node
/**
 * Prod smoke: lesson plan → draft → workout editor API persistence.
 *
 *   BASE_URL=https://www.thetrainstation.co node scripts/lesson-plan-editor-prod-test.mjs
 */

import { createCoachClient } from "./lib/coach-auth.mjs";

const BASE = (process.env.BASE_URL || "https://www.thetrainstation.co").replace(/\/$/, "");
const MARKER = process.env.TEST_MARKER || `lp-test-${Date.now()}`;

const PLAN_TEXT = `${MARKER} Lower test day

Leg press
4 sets
10,10,10,10

Romanian deadlift
3 sets
8,8,8`;

const results = [];

function pass(name, detail = "") {
  results.push({ name, ok: true, detail });
  console.log(`✅ ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name, detail = "") {
  results.push({ name, ok: false, detail });
  console.log(`❌ ${name}${detail ? ` — ${detail}` : ""}`);
}

function bust(path) {
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}_t=${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function waitForExercises(req, workoutId, min, maxMs = 20_000) {
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    const g = await req(bust(`/api/workouts/${workoutId}`));
    if (g.res.ok && (g.body?.exercises?.length ?? 0) >= min) return g.body;
    await new Promise((r) => setTimeout(r, 800));
  }
  return null;
}

async function main() {
  console.log(`\nLesson plan editor prod test\nBASE: ${BASE}\nMARKER: ${MARKER}\n`);

  const { req, loginCoach } = createCoachClient(BASE);
  if (!(await loginCoach({ onPass: pass, onFail: fail }))) {
    process.exit(1);
  }

  const day = await req(bust("/admin/day?plan=1"));
  if (day.res.status !== 200) {
    fail("Dashboard plan mode", `status ${day.res.status}`);
  } else {
    const hasNewFlow =
      day.text.includes("Edit workout") ||
      day.text.includes("Grok interprets") ||
      day.text.includes("No separate certify");
    const hasOldCertify =
      day.text.includes("Certify") && day.text.includes("Review");
    if (hasNewFlow && !hasOldCertify) {
      pass("Dashboard UI", "lesson plan → editor flow (no Review/Certify step)");
    } else if (hasOldCertify) {
      fail("Dashboard UI", "still shows old Review/Certify step");
    } else {
      fail("Dashboard UI", "lesson plan builder markers missing");
    }
  }

  const interpret = await req("/api/today/lesson-plan", {
    method: "POST",
    json: { rawText: PLAN_TEXT, includeWarmup: false },
  });
  if (!interpret.res.ok || !interpret.body?.workout?.exercises?.length) {
    fail("Interpret plan", interpret.body?.error || `status ${interpret.res.status}`);
    process.exit(1);
  }
  pass(
    "Interpret plan",
    `${interpret.body.workout.exercises.length} blocks, confidence=${interpret.body.confidence}`,
  );

  const draft = await req("/api/today/lesson-plan/draft", {
    method: "POST",
    json: { rawText: PLAN_TEXT, includeWarmup: false },
  });
  if (!draft.res.ok || !draft.body?.workoutId?.startsWith("sms-w-")) {
    fail("Draft handoff", draft.body?.error || JSON.stringify(draft.body));
    process.exit(1);
  }
  const workoutId = draft.body.workoutId;
  pass("Draft handoff", workoutId);

  const loaded = await waitForExercises(req, workoutId, 2);
  if (!loaded) {
    fail("Load draft workout", "exercises missing after draft");
    process.exit(1);
  }
  pass("Load draft workout", `${loaded.exercises.length} exercises`);

  const renamed = `${MARKER} edited title`;
  const patchName = await req(`/api/workouts/${workoutId}`, {
    method: "PATCH",
    json: { name: renamed },
  });
  if (!patchName.res.ok) {
    fail("Rename workout", patchName.body?.detail || patchName.res.status);
  } else {
    pass("Rename workout", renamed);
  }

  await new Promise((r) => setTimeout(r, 1500));
  const reread = await req(bust(`/api/workouts/${workoutId}`));
  if (!reread.res.ok || reread.body?.name !== renamed) {
    fail(
      "Rename persisted",
      `got "${reread.body?.name ?? "?"}" expected "${renamed}"`,
    );
  } else {
    pass("Rename persisted", "re-read after 1.5s");
  }

  const lib = await req(bust("/api/exercises"));
  const pick =
    Array.isArray(lib.body) && lib.body.length > 0 ? lib.body[0] : null;
  if (!pick?.id) {
    fail("Exercise library", "no exercises to add");
  } else {
    const add = await req(`/api/workouts/${workoutId}/exercises`, {
      method: "POST",
      json: {
        exerciseId: pick.id,
        setScheme: "standard",
        reps: "12",
        sets: 3,
        weightTier: "medium",
        notes: `${MARKER} added block`,
      },
    });
    if (!add.res.ok) {
      fail("Add exercise", add.body?.detail || add.res.status);
    } else {
      pass("Add exercise", pick.name);
    }

    await new Promise((r) => setTimeout(r, 1500));
    const afterAdd = await req(bust(`/api/workouts/${workoutId}`));
    const count = afterAdd.body?.exercises?.length ?? 0;
    const hasNote = (afterAdd.body?.exercises ?? []).some((e) =>
      String(e.notes || "").includes(MARKER),
    );
    if (!afterAdd.res.ok || count < loaded.exercises.length + 1 || !hasNote) {
      fail("Add exercise persisted", `count=${count}, hasNote=${hasNote}`);
    } else {
      pass("Add exercise persisted", `${count} total exercises`);
    }
  }

  const blob = await req("/api/admin/demo-persistence");
  if (blob.res.ok && blob.body?.blobWritable) {
    pass("Blob writable", blob.body.message || "ok");
  } else {
    fail("Blob writable", blob.body?.message || `status ${blob.res.status}`);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${failed.length ? "FAILED" : "PASSED"} — ${results.length} checks, ${failed.length} failures\n`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});