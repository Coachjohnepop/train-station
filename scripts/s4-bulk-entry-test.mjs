#!/usr/bin/env node
/**
 * Sprint 4 — bulk text upload + seed export smoke test.
 * Usage: BASE_URL=https://www.thetrainstation.co npm run test:s4
 */

import { createCoachClient } from "./lib/coach-auth.mjs";

const BASE = process.env.BASE_URL || "https://www.thetrainstation.co";
const MARKER = `S4-${Date.now()}`;

const { req, loginCoach } = createCoachClient(BASE);
const results = [];

function pass(n, d = "") {
  results.push({ ok: true });
  console.log(`✅ ${n}${d ? ` — ${d}` : ""}`);
}
function fail(n, d = "") {
  results.push({ ok: false });
  console.log(`❌ ${n}${d ? ` — ${d}` : ""}`);
}

async function main() {
  console.log(`\nS4 bulk entry test\nBASE: ${BASE}\n`);

  if (!(await loginCoach({ onPass: pass, onFail: fail }))) {
    process.exit(1);
  }

  const weekText =
    "Day 1 Gym: Day 1 Upper Body Workout (Gym)\nDay 2 Gym: Day 2 Lower Body Workout (Gym)";

  let { res, body } = await req("/api/text-upload/parse", {
    method: "POST",
    json: { mode: "program-week", rawText: weekText },
  });
  if (res.ok && body?.slots?.length >= 2) pass("Parse program week", `${body.slots.length} slots`);
  else fail("Parse program week", `${res.status}`);

  const { body: programs } = await req("/api/programs");
  const adult = Array.isArray(programs) ? programs.find((p) => p.slug === "adult") : null;
  if (!adult) {
    fail("Adult program for week build");
    return done();
  }

  ({ res, body } = await req("/api/text-upload/build", {
    method: "POST",
    json: { mode: "program-week", rawText: weekText, programSlug: adult.slug, weekNumber: 1 },
  }));
  if (res.ok && body?.appliedCount >= 1) pass("Build program week", `applied=${body.appliedCount}`);
  else fail("Build program week", body?.error || res.status);

  ({ res, body } = await req("/api/text-upload/build", {
    method: "POST",
    json: {
      mode: "program-week",
      rawText: "Day 1 Gym: Totally Fake Workout XYZ",
      programSlug: adult.slug,
      weekNumber: 1,
    },
  }));
  if (!res.ok) pass("Reject unmatched workout names");
  else fail("Reject unmatched workout names");

  const out = await req("/api/admin/export-seed");
  res = out.res;
  let snapshot = null;
  try {
    snapshot = JSON.parse(out.text);
  } catch {
    snapshot = null;
  }
  if (
    res.ok &&
    snapshot?._meta?.exportedAt &&
    Array.isArray(snapshot.exercises) &&
    Array.isArray(snapshot.programs)
  ) {
    pass(
      "Export seed snapshot",
      `${snapshot.exercises.length} exercises, ${snapshot.programs.length} programs`,
    );
  } else {
    fail("Export seed snapshot", res.status);
  }

  done();
}

function done() {
  const ok = results.filter((r) => r.ok).length;
  console.log(`\n${ok}/${results.length} passed\n`);
  process.exit(ok === results.length ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});