#!/usr/bin/env node
/**
 * Condensed S3–S6 smoke test (catalog, bulk entry, member preview, booking).
 * Usage: BASE_URL=https://www.thetrainstation.co npm run test:s3-s6
 */

import { createCoachClient } from "./lib/coach-auth.mjs";

const BASE = process.env.BASE_URL || "https://www.thetrainstation.co";
const { req, loginCoach } = createCoachClient(BASE);
const results = [];

function ok(l) {
  results.push(true);
  console.log(`✅ ${l}`);
}
function bad(l, d = "") {
  results.push(false);
  console.log(`❌ ${l}${d ? ` — ${d}` : ""}`);
}

async function main() {
  console.log(`S3–S6 @ ${BASE}\n`);

  if (!(await loginCoach({ onPass: ok, onFail: bad }))) {
    process.exit(1);
  }

  // S3
  const { body: programs } = await req(`/api/programs?_t=${Date.now()}`);
  if (Array.isArray(programs) && programs.length === 5) ok("S3 catalog");
  else bad("S3 catalog", `${programs?.length ?? "?"}`);

  // S4
  const weekText = "Day 1 Gym: Day 1 Upper Body Workout (Gym)\nDay 2 Gym: Day 2 Lower Body Workout (Gym)";
  let { res, body } = await req("/api/text-upload/build", {
    method: "POST",
    json: { mode: "program-week", rawText: weekText, programSlug: "adult", weekNumber: 1 },
  });
  if (res.ok && body?.appliedCount >= 1) ok("S4 week paste");
  else bad("S4 week paste");

  // S6 preview — adult start-workout should be real program workout, not Preview shell
  ({ res, body } = await req("/api/programs/adult/start-workout"));
  if (
    res.ok &&
    body?.workoutId &&
    body.exerciseCount > 0 &&
    !body.isPreviewShell
  ) {
    ok("S6 adult start-workout", body.workoutName || body.workoutId);
  } else {
    bad("S6 adult start-workout", body?.error || `exercises=${body?.exerciseCount}`);
  }

  // S6 booking — backup slots should be limited (not 7 full weekdays)
  ({ res, body } = await req("/api/bookings?slots=true"));
  const slotCount = Array.isArray(body) ? body.length : 0;
  if (res.ok && slotCount > 0 && slotCount < 150) ok("S6 booking slots sane", `${slotCount} slots`);
  else if (res.ok && slotCount === 0) ok("S6 booking slots empty", "use Calendly");
  else bad("S6 booking slots", `${slotCount}`);

  // S5 hygiene — adolescent enroll blocked
  ({ res } = await req("/api/programs/youth-sports/enroll", { method: "POST" }));
  if (res.status === 403) ok("S5 coming-soon enroll blocked");
  else bad("S5 coming-soon enroll blocked", res.status);

  // S4 export
  const out = await req("/api/admin/export-seed");
  try {
    const snap = JSON.parse(out.text);
    if (out.res.ok && snap._meta?.exportedAt) ok("S4 export snapshot");
    else bad("S4 export snapshot");
  } catch {
    bad("S4 export snapshot");
  }

  const pass = results.filter(Boolean).length;
  console.log(`\n${pass}/${results.length}${pass === results.length ? " — all good" : ""}\n`);
  process.exit(pass === results.length ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});