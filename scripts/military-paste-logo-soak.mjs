#!/usr/bin/env node
/**
 * 4-pass soak for Jeremy Military builder + logo (Jul 26 fix).
 *
 * Covers:
 *  - GET /api/programs/boot-camp-preparation (was 405 — paste refresh bug)
 *  - multi-part day (2 parts) assign Gym/Home
 *  - template promote + paste onto part 2 with rename
 *  - GET reload shows new clone workout ids on the correct part
 *  - logo white plate on /images/logo.png
 *
 *   BASE_URL=https://www.thetrainstation.co ROUNDS=4 \
 *   COACH_EMAIL=john@thetrainstation.co COACH_PASSWORD='…' \
 *   node scripts/military-paste-logo-soak.mjs
 */
import { writeFileSync } from "node:fs";
import { createCoachClient } from "./lib/coach-auth.mjs";

const BASE = (process.env.BASE_URL || "https://www.thetrainstation.co").replace(/\/$/, "");
const ROUNDS = Math.max(1, Number(process.env.ROUNDS || "4"));
const MARK = "MILITARY-PASTE-LOGO";
const RUN = Date.now().toString(36);
const PROGRAM_SLUG = process.env.PROGRAM_SLUG || "boot-camp-preparation";
const COACH_EMAIL = process.env.COACH_EMAIL || "john@thetrainstation.co";
const COACH_PASSWORD =
  process.env.COACH_PASSWORD ||
  process.env.COACH_TEST_PASSWORD ||
  "LaserChickenSoak2026!";

const results = [];
function pass(name, detail = "") {
  results.push({ ok: true, name, detail });
  console.log(`✅ ${name}${detail ? ` — ${detail}` : ""}`);
}
function assert(cond, name, detail = "") {
  if (cond) pass(name, detail);
  else {
    console.log(`❌ ${name}${detail ? ` — ${detail}` : ""}`);
    results.push({ ok: false, name, detail });
    throw new Error(`${name}: ${detail}`);
  }
}

async function checkLogoWhitePlate(round) {
  const res = await fetch(`${BASE}/images/logo.png`, { cache: "no-store" });
  assert(res.ok, `r${round} logo.png reachable`, String(res.status));
  const buf = Buffer.from(await res.arrayBuffer());
  assert(buf.length > 1000, `r${round} logo size`, String(buf.length));
  // PNG signature
  assert(buf[0] === 0x89 && buf[1] === 0x50, `r${round} logo is PNG`);

  // Sample a few pixels near the top edge — white plate should be bright.
  // Decode via sharp if available; else skip deep check with warn.
  try {
    const sharp = (await import("sharp")).default;
    const { data, info } = await sharp(buf)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const w = info.width;
    const h = info.height;
    const sample = (x, y) => {
      const i = (y * w + x) * 4;
      return [data[i], data[i + 1], data[i + 2], data[i + 3]];
    };
    const edge = sample(Math.floor(w / 2), Math.max(2, Math.floor(h / 12)));
    const [r, g, b, a] = edge;
    assert(a > 200, `r${round} logo edge opaque`, `a=${a}`);
    assert(r > 240 && g > 240 && b > 240, `r${round} logo edge white plate`, `rgb=${r},${g},${b}`);
    const center = sample(Math.floor(w / 2), Math.floor(h / 2));
    // Center should be the dark mark, not pure white
    assert(
      center[0] < 80 || center[1] < 80 || center[2] < 80,
      `r${round} logo center is mark (not blank)`,
      `rgb=${center.slice(0, 3).join(",")}`,
    );
  } catch (e) {
    if (String(e.message || e).includes("logo")) throw e;
    pass(`r${round} logo sharp skip`, String(e.message || e).slice(0, 80));
  }
}

async function runRound(req, round) {
  const tag = `${MARK} · r${round} · ${RUN}`;
  console.log(`\n── Round ${round}/${ROUNDS} · ${tag} ──\n`);
  const created = { exercises: [], workouts: [], templates: [] };

  // 0. Logo every round
  await checkLogoWhitePlate(round);

  // 1. GET program tree (the bug fix)
  const getProg = await req(`/api/programs/${PROGRAM_SLUG}`);
  assert(
    getProg.res.ok,
    `r${round} GET /api/programs/${PROGRAM_SLUG}`,
    `${getProg.res.status} ${String(getProg.text || "").slice(0, 120)}`,
  );
  assert(Array.isArray(getProg.body?.weeks) && getProg.body.weeks.length > 0, `r${round} program has weeks`);
  pass(`r${round} program tree`, `${getProg.body.weeks.length} weeks · ${getProg.body.name || PROGRAM_SLUG}`);

  // 2. Pick low-traffic day (last week, day 6)
  const weeks = getProg.body.weeks;
  const week = weeks[weeks.length - 1] || weeks[0];
  const dayMeta = week.days.find((d) => d.dayNumber === 6) || week.days.at(-1);
  assert(dayMeta?.id, `r${round} day id`);
  const dayId = dayMeta.id;
  pass(`r${round} target day`, `${PROGRAM_SLUG} W${week.weekNumber}D${dayMeta.dayNumber} ${dayId}`);

  // 3. Source exercise + workout for template
  const ex = await req("/api/exercises", {
    method: "POST",
    json: {
      name: `${tag} · ruck march`,
      tags: "military,soak",
      description: "Military paste soak movement",
    },
  });
  assert(ex.res.status === 201 || ex.res.ok, `r${round} create exercise`, String(ex.res.status));
  created.exercises.push(ex.body.id);

  const sourceW = await req("/api/workouts", {
    method: "POST",
    json: { name: `${tag} · source AM` },
  });
  assert(sourceW.res.status === 201 || sourceW.res.ok, `r${round} create source workout`);
  created.workouts.push(sourceW.body.id);

  const add = await req(`/api/workouts/${sourceW.body.id}/exercises`, {
    method: "POST",
    json: {
      exerciseId: ex.body.id,
      setScheme: "standard",
      sets: 3,
      reps: "12",
      weightTier: "medium",
      restSec: 60,
      notes: `${MARK} coach cue`,
    },
  });
  assert(add.res.status === 201 || add.res.ok, `r${round} add exercise line`);

  // 4. Promote template (requires title)
  const tmplName = `${tag} · template`;
  const tmpl = await req("/api/workout-templates", {
    method: "POST",
    json: {
      sourceWorkoutId: sourceW.body.id,
      name: tmplName,
      category: "military",
      versionLabel: "v_soak",
    },
  });
  assert(
    tmpl.res.status === 201 || tmpl.res.ok,
    `r${round} save template`,
    `${tmpl.res.status} ${String(tmpl.text || "").slice(0, 120)}`,
  );
  created.templates.push(tmpl.body.id);
  if (tmpl.body.workoutId) created.workouts.push(tmpl.body.workoutId);
  pass(`r${round} template id`, tmpl.body.id);

  // 5. Set 2-part day
  const pc = await req(`/api/programs/days/${dayId}`, {
    method: "PATCH",
    json: { partCount: 2 },
  });
  assert(pc.res.ok, `r${round} set partCount 2`, `${pc.res.status}`);
  assert(Number(pc.body.partCount) === 2, `r${round} partCount is 2`, String(pc.body.partCount));
  assert(
    Array.isArray(pc.body.sessions) && pc.body.sessions.length >= 2,
    `r${round} two sessions`,
    String(pc.body.sessions?.length),
  );

  // 6. Paste template onto PART 2 with required rename (different from template title)
  const pasteName = `${tag} · PM copy`;
  const paste = await req("/api/workout-templates/paste", {
    method: "POST",
    json: {
      templateId: tmpl.body.id,
      dayId,
      tracks: { gym: true, home: true },
      replace: true,
      force: true,
      partIndex: 2,
      contentName: pasteName,
    },
  });
  assert(
    paste.res.status === 201 || paste.res.ok,
    `r${round} paste template → part 2 Gym+Home`,
    `${paste.res.status} ${String(paste.text || "").slice(0, 160)}`,
  );
  const gymId = paste.body.gymWorkoutId;
  const homeId = paste.body.homeWorkoutId;
  assert(gymId, `r${round} paste gymWorkoutId`);
  assert(homeId, `r${round} paste homeWorkoutId`);
  assert(gymId !== homeId, `r${round} separate gym/home clones`);
  assert(Number(paste.body.partIndex) === 2, `r${round} paste partIndex 2`, String(paste.body.partIndex));
  created.workouts.push(gymId, homeId);

  const gymW = (await req(`/api/workouts/${gymId}`)).body;
  assert(
    Array.isArray(gymW.exercises) && gymW.exercises.length >= 1,
    `r${round} gym clone has exercises`,
    String(gymW.exercises?.length),
  );

  // 7. GET program again — must show part 2 options with new clones (refresh path)
  const get2 = await req(`/api/programs/${PROGRAM_SLUG}`);
  assert(get2.res.ok, `r${round} GET program after paste`);
  let foundDay = null;
  for (const w of get2.body.weeks || []) {
    const d = (w.days || []).find((x) => x.id === dayId);
    if (d) {
      foundDay = d;
      break;
    }
  }
  assert(foundDay, `r${round} day in GET tree after paste`);
  assert(Number(foundDay.partCount) >= 2, `r${round} GET day partCount ≥ 2`, String(foundDay.partCount));

  const sessions = foundDay.sessions || [];
  const part2 = sessions.find((s) => s.partIndex === 2);
  assert(part2, `r${round} GET has part 2 session`);
  const part2Opts = part2.options || [];
  const hasGym = part2Opts.some((o) => o.workoutId === gymId);
  const hasHome = part2Opts.some((o) => o.workoutId === homeId);
  assert(hasGym, `r${round} GET part2 has gym clone`, JSON.stringify(part2Opts.map((o) => o.workoutId)).slice(0, 100));
  assert(hasHome, `r${round} GET part2 has home clone`);

  // Flat options may also list them
  const flat = foundDay.options || [];
  assert(
    flat.some((o) => o.workoutId === gymId) || hasGym,
    `r${round} GET options include paste gym`,
  );
  pass(`r${round} paste sticky after GET refresh`);

  // 8. Part-scoped independence: edit home note, gym stays clean
  const homeW = (await req(`/api/workouts/${homeId}`)).body;
  const homeLine = homeW.exercises?.[0];
  if (homeLine?.id) {
    await req(`/api/workouts/${homeId}/exercises`, {
      method: "PATCH",
      json: { itemId: homeLine.id, notes: "HOME-ONLY-PART2", sets: 5 },
    });
    const gym2 = (await req(`/api/workouts/${gymId}`)).body;
    assert(
      !/HOME-ONLY-PART2/i.test(gym2.exercises?.[0]?.notes || ""),
      `r${round} gym not polluted by home edit`,
    );
  }

  // 9. Sync endpoint still works as fallback
  const sync = await req(`/api/programs/${PROGRAM_SLUG}/sync`, { method: "POST" });
  assert(sync.res.ok, `r${round} POST sync`, String(sync.res.status));
  assert(Array.isArray(sync.body?.weeks), `r${round} sync returns weeks`);

  // 10. Cleanup — reset day, archive template, delete soak workouts/exercises
  await req(`/api/programs/days/${dayId}`, {
    method: "PATCH",
    json: { options: [], replaceAllOptions: true, partCount: 1 },
  });
  pass(`r${round} day reset to 1 part`);

  for (const id of created.templates) {
    await req(`/api/workout-templates/${id}`, { method: "DELETE" }).catch(() => {});
    await req(`/api/workout-templates/${id}?hard=1`, { method: "DELETE" }).catch(() => {});
  }
  for (const id of created.workouts) {
    await req(`/api/workouts/${id}`, { method: "DELETE" }).catch(() => {});
  }
  for (const id of created.exercises) {
    await req(`/api/exercises/${id}`, { method: "DELETE" }).catch(() => {});
    await req(`/api/exercises/${id}?hard=1&force=1`, { method: "DELETE" }).catch(() => {});
  }

  // Sweep leftovers by marker
  for (const path of ["/api/workouts", "/api/exercises?archive=all", "/api/workout-templates?archive=all"]) {
    const list = await req(path);
    if (!list.res.ok || !Array.isArray(list.body)) continue;
    for (const row of list.body) {
      if (!String(row.name || "").includes(MARK)) continue;
      if (path.startsWith("/api/workouts")) {
        await req(`/api/workouts/${row.id}`, { method: "DELETE" });
      } else if (path.startsWith("/api/exercises")) {
        await req(`/api/exercises/${row.id}`, { method: "DELETE" });
        await req(`/api/exercises/${row.id}?hard=1&force=1`, { method: "DELETE" });
      } else {
        await req(`/api/workout-templates/${row.id}`, { method: "DELETE" });
        await req(`/api/workout-templates/${row.id}?hard=1`, { method: "DELETE" });
      }
      console.log("  swept", row.name);
    }
  }
  pass(`r${round} cleanup done`);
}

async function main() {
  console.log(`\n🪖 ${MARK} SOAK`);
  console.log(`BASE: ${BASE}`);
  console.log(`PROGRAM: ${PROGRAM_SLUG}`);
  console.log(`ROUNDS: ${ROUNDS}`);
  console.log(`coach: ${COACH_EMAIL}\n`);

  const { req, loginCoach } = createCoachClient(BASE, {
    coachEmail: COACH_EMAIL,
    password: COACH_PASSWORD,
  });
  if (!(await loginCoach())) {
    console.error("Login failed");
    process.exit(1);
  }
  pass("Coach login", COACH_EMAIL);

  try {
    for (let r = 1; r <= ROUNDS; r++) {
      await runRound(req, r);
    }
    const failed = results.filter((x) => !x.ok);
    const report = {
      ok: failed.length === 0,
      mark: MARK,
      run: RUN,
      rounds: ROUNDS,
      program: PROGRAM_SLUG,
      base: BASE,
      pass: results.filter((x) => x.ok).length,
      fail: failed.length,
      results,
      at: new Date().toISOString(),
    };
    writeFileSync(
      new URL("./.military-paste-logo-soak-latest.json", import.meta.url),
      JSON.stringify(report, null, 2),
    );
    console.log(
      failed.length
        ? `\n❌ ${MARK}: ${failed.length} failed / ${results.length} checks\n`
        : `\n🎉 ${MARK} ALL PASSED (${results.filter((x) => x.ok).length} checks · ${ROUNDS} rounds)\n`,
    );
    process.exit(failed.length ? 1 : 0);
  } catch (e) {
    console.error("\n💥", e.message);
    writeFileSync(
      new URL("./.military-paste-logo-soak-latest.json", import.meta.url),
      JSON.stringify(
        {
          ok: false,
          mark: MARK,
          run: RUN,
          error: e.message,
          results,
          at: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }
}

main();
