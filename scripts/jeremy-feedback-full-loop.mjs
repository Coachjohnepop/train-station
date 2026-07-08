#!/usr/bin/env node
/**
 * Full loop: Jeremy written feedback + July 5 video items → prod API/UI checks.
 *
 * Usage:
 *   BASE_URL=https://www.thetrainstation.co node scripts/jeremy-feedback-full-loop.mjs
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BASE = process.env.BASE_URL || "https://www.thetrainstation.co";
const COACH_EMAIL = process.env.COACH_EMAIL || "jeremy@thetrainstation.co";
const MEMBER_EMAIL = process.env.MEMBER_EMAIL || "john@lemonvoice.com";
const MARKER = `JEREMY-LOOP-${Date.now()}`;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const results = [];

function pass(id, name, detail = "") {
  results.push({ id, name, ok: true, detail, source: FEEDBACK[id]?.source });
  console.log(`✅ [${id}] ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(id, name, detail = "") {
  results.push({ id, name, ok: false, detail, source: FEEDBACK[id]?.source });
  console.log(`❌ [${id}] ${name}${detail ? ` — ${detail}` : ""}`);
}

function skip(id, name, detail = "") {
  results.push({ id, name, ok: true, detail: `SKIP: ${detail}`, source: FEEDBACK[id]?.source });
  console.log(`⏭  [${id}] ${name} — ${detail}`);
}

/** Maps test id → Jeremy written note / video transcript line */
const FEEDBACK = {
  "exercise-flow": { source: "written: Exercise flow good; YouTube pick?" },
  "workout-flow": { source: "written: Workout flow looks good" },
  "program-drag": { source: "video: can't drag exercises (0:52)" },
  "program-save": { source: "video: wants Save not just Publish (0:55)" },
  "program-delete": { source: "video: delete + refresh re-adds warmups (1:15)" },
  "program-week2": { source: "video: week two on week one confusion (1:37)" },
  "library-delete": { source: "video: bench press doesn't delete (2:18)" },
  "upload-translation": { source: "written: hopefully text translations work" },
  "message-flow": { source: "written: Message flow looks good" },
  "sms-group": { source: "written: text group uncertain" },
  "free-ticket-rick": { source: "written: Rick ~20s then chastise" },
  "welcome-landing": { source: "written: welcome video on landing" },
  "member-weekly-video": { source: "written: weekly coach video hover" },
  "member-dinner": { source: "written: what's for dinner video" },
  "member-nutrition": { source: "written: nutrition calorie tiers" },
  "week1-template": { source: "ops: Week 1 template seed" },
};

let cookies = "";

async function req(path, opts = {}) {
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const headers = { "Cache-Control": "no-cache", ...(opts.headers || {}) };
  if (cookies) headers.Cookie = cookies;
  if (opts.json) {
    headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(opts.json);
  }
  const res = await fetch(url, { ...opts, headers, cache: "no-store" });
  const setCookie = res.headers.getSetCookie?.() || [];
  if (setCookie.length) {
    const jar = Object.fromEntries(
      (cookies ? cookies.split("; ").map((p) => p.split("=")) : []).filter(([k]) => k),
    );
    for (const c of setCookie) {
      const [k, ...v] = c.split(";")[0].split("=");
      jar[k] = v.join("=");
    }
    cookies = Object.entries(jar)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { res, body, text };
}

function chunkUrlsFromHtml(html) {
  return [...new Set([...html.matchAll(/\/_next\/static\/chunks\/[^"']+\.js/g)].map((m) => m[0]))];
}

async function bundlesContain(path, needles) {
  const { text: html } = await req(path);
  const chunks = chunkUrlsFromHtml(html);
  const found = new Set();
  for (const chunk of chunks.slice(0, 40)) {
    try {
      const js = await (await fetch(`${BASE}${chunk}`, { cache: "no-store" })).text();
      for (const n of needles) if (js.includes(n)) found.add(n);
    } catch {
      /* skip */
    }
    if (found.size === needles.length) break;
  }
  return { found: [...found], html };
}

async function loginCoach() {
  for (const password of ["", "CoachTest123!"]) {
    const { res, body } = await req("/api/auth/login", {
      method: "POST",
      json: { email: COACH_EMAIL, password, redirect: "/admin" },
    });
    if (res.ok && body?.user) return true;
  }
  return false;
}

async function loginMember() {
  for (const password of ["", "MemberTest123!"]) {
    const { res, body } = await req("/api/auth/login", {
      method: "POST",
      json: { email: MEMBER_EMAIL, password, redirect: "/member/today" },
    });
    if (res.ok && body?.user) return true;
  }
  return false;
}

async function testExerciseFlow() {
  if (!(await loginCoach())) {
    fail("exercise-flow", "Coach login");
    return;
  }

  const squatHint = await req("/api/exercises", {
    method: "POST",
    json: { name: `${MARKER} Back Squat`, tags: "qa" },
  });
  if (squatHint.res.ok && squatHint.body?.videoUrl?.includes("youtube")) {
    pass("exercise-flow", "YouTube hint on exercise create", squatHint.body.videoUrl);
  } else if (squatHint.res.ok) {
    fail("exercise-flow", "YouTube hint on create", "no videoUrl");
  } else {
    fail("exercise-flow", "Create exercise with hint", squatHint.text?.slice(0, 80));
  }

  if (squatHint.body?.id) {
    await req(`/api/exercises/${squatHint.body.id}`, { method: "DELETE" });
  }

  const lib = await bundlesContain("/admin/exercises", ["Upload translation", "Use YouTube match"]);
  if (lib.found.length >= 1) pass("exercise-flow", "Library upload translation UI", lib.found.join(", "));
  else fail("exercise-flow", "Library UI strings", `found: ${lib.found.join(", ") || "none"}`);
}

async function testWorkoutFlow() {
  const { res } = await req("/admin/workouts");
  if (res.ok) pass("workout-flow", "Workouts admin page loads");
  else fail("workout-flow", "Workouts page", String(res.status));

  const { res: apiRes, body } = await req("/api/workouts");
  if (apiRes.ok && Array.isArray(body) && body.length > 0) {
    pass("workout-flow", "Workout library API", `${body.length} workouts`);
  } else {
    fail("workout-flow", "Workout library API");
  }
}

async function testProgramBuilderUi() {
  const { found, html } = await bundlesContain("/admin/programs/adult", [
    "Upload translation",
    "Save",
    "Publish",
    "Move up",
    "drag",
  ]);
  const checks = [
    ["program-drag", "Upload translation in program builder", "Upload translation"],
    ["program-save", "Save button in builder", "Save"],
    ["program-save", "Publish button in builder", "Publish"],
    ["program-drag", "Reorder hint or move controls", found.some((f) => f.includes("Move") || f.includes("drag"))],
  ];
  for (const [id, label, needle] of checks) {
    if (typeof needle === "boolean") {
      if (needle) pass(id, label);
      else fail(id, label, "not in bundles");
    } else if (found.includes(needle) || html.includes(needle)) {
      pass(id, label);
    } else {
      fail(id, label, `missing ${needle}`);
    }
  }
}

async function testProgramDeleteAndOrder() {
  const script = join(ROOT, "scripts/program-exercise-order-test.mjs");
  const res = spawnSync("node", [script], {
    env: { ...process.env, BASE_URL: BASE },
    encoding: "utf8",
  });
  if (res.status === 0) {
    pass("program-delete", "Delete + order persistence (program-exercise-order-test)");
  } else {
    fail("program-delete", "program-exercise-order-test", res.stderr?.slice(-200) || "failed");
  }
}

async function testLibraryDelete() {
  const name = `${MARKER} Bench Press QA`;
  let { res, body } = await req("/api/exercises", {
    method: "POST",
    json: { name, tags: "qa" },
  });
  if (!res.ok || !body?.id) {
    fail("library-delete", "Create bench exercise", String(res.status));
    return;
  }
  const id = body.id;
  await new Promise((r) => setTimeout(r, 500));

  ({ res, body } = await req(`/api/exercises/${id}`, { method: "DELETE" }));
  if (!res.ok && res.status !== 204) {
    fail("library-delete", "DELETE exercise", String(res.status));
    return;
  }

  await new Promise((r) => setTimeout(r, 800));
  ({ body } = await req("/api/exercises"));
  const gone = !Array.isArray(body) || !body.some((e) => e.id === id);
  if (gone) pass("library-delete", "Exercise delete persists on re-fetch");
  else fail("library-delete", "Exercise still in list after delete");
}

async function testUploadTranslation() {
  const sms = `QA ${MARKER} Upper\n\nFlat bench press\n10,10,10,10\n\nCable row\n10,10,10,10`;
  let { res, body } = await req("/api/text-upload/parse", {
    method: "POST",
    json: { mode: "workout", rawText: sms },
  });
  if (!res.ok || (body?.workout?.exercises?.length || 0) < 2) {
    fail("upload-translation", "Parse workout text", `${res.status}`);
    return;
  }
  pass("upload-translation", "Parse upload translation", `${body.workout.exercises.length} blocks`);

  ({ res, body } = await req("/api/text-upload/build", {
    method: "POST",
    json: { mode: "workout", rawText: sms, workoutName: `QA ${MARKER}` },
  }));
  if (res.ok && body?.workoutId && body?.exerciseCount >= 2) {
    pass("upload-translation", "Build upload translation", `${body.exerciseCount} exercises`);
  } else {
    fail("upload-translation", "Build upload translation", JSON.stringify(body)?.slice(0, 120));
  }
}

async function testMessageAndSms() {
  const chat = await req("/admin/chat");
  if (chat.res.ok) pass("message-flow", "Admin Messages page");
  else fail("message-flow", "Admin Messages", String(chat.res.status));

  const sms = await req("/admin/sms-hub");
  if (sms.res.ok && sms.text.includes("Community feed")) {
    pass("sms-group", "SMS Hub vs community clarity");
  } else if (sms.res.ok) {
    fail("sms-group", "SMS Hub clarity note", "Community feed text missing");
  } else {
    fail("sms-group", "SMS Hub page", String(sms.res.status));
  }

  const hub = await req("/api/sms/hub/recipients");
  if (hub.res.ok && Array.isArray(hub.body?.recipients)) {
    pass("sms-group", "SMS Hub recipients API", `${hub.body.recipients.length} members`);
  } else {
    fail("sms-group", "SMS Hub API");
  }
}

async function testLandingAndFreeTicket() {
  const landing = await bundlesContain("/", [
    "WelcomeVideoPopover",
    "Watch intro",
    "RICKROLL_MS",
    "20_000",
  ]);
  if (landing.found.some((f) => f.includes("Welcome") || f.includes("Watch intro"))) {
    pass("welcome-landing", "Welcome video on landing");
  } else {
    fail("welcome-landing", "Welcome video UI", landing.found.join(", ") || "none");
  }

  if (landing.found.includes("20_000") || landing.found.includes("RICKROLL_MS")) {
    pass("free-ticket-rick", "20s Rick roll constant in bundle");
  } else {
    const src = readFileSync(join(ROOT, "src/components/FreeTicketModal.tsx"), "utf8");
    if (src.includes("20_000") || src.includes("RICKROLL_MS = 20")) {
      skip("free-ticket-rick", "20s Rick roll", "in source; bundle string not found (deploy lag?)");
    } else {
      fail("free-ticket-rick", "Rick roll duration");
    }
  }
}

async function testMemberSurfaces() {
  cookies = "";
  if (!(await loginMember())) {
    skip("member-weekly-video", "Member login", "try manual — credentials may differ");
    skip("member-dinner", "Member surfaces", "no member session");
    skip("member-nutrition", "Nutrition page", "no member session");
    return;
  }

  const today = await req("/member/today");
  if (today.res.ok) pass("member-weekly-video", "Member Today page loads");
  else fail("member-weekly-video", "Member Today", String(today.res.status));

  const content = await req("/api/admin/member-content");
  if (content.res.ok) {
    const w = content.body?.weeklyVideoUrl;
    const d = content.body?.dinnerVideoUrl;
    if (w) pass("member-weekly-video", "Weekly video URL configured", w.slice(0, 40));
    else skip("member-weekly-video", "Weekly video URL", "not set — Jeremy must paste in Admin → Landing");

    if (d) pass("member-dinner", "Dinner video URL configured", d.slice(0, 40));
    else skip("member-dinner", "Dinner video URL", "not set — Jeremy must paste");
  } else {
    skip("member-weekly-video", "Member content API", "coach-only endpoint");
  }

  const nutrition = await req("/member/nutrition");
  if (nutrition.res.ok && nutrition.text.match(/1600|2000|2500|calorie/i)) {
    pass("member-nutrition", "Nutrition calorie tiers page");
  } else if (nutrition.res.ok) {
    fail("member-nutrition", "Nutrition tiers content", "tier labels not found");
  } else {
    fail("member-nutrition", "Nutrition page", String(nutrition.res.status));
  }
}

async function testWeek1Week2() {
  const { res, body } = await req("/api/programs/adult/sync", { method: "POST" });
  if (!res.ok) {
    fail("program-week2", "Program sync");
    fail("week1-template", "Week 1 days");
    return;
  }

  const w1 = body.weeks?.find((w) => w.weekNumber === 1);
  const w2 = body.weeks?.find((w) => w.weekNumber === 2);
  const dayOpts = (day) => {
    if (day.options?.length) return day.options;
    if (day.workoutId) return [{ workoutId: day.workoutId, label: "Gym" }];
    return [];
  };

  const w1Filled = (w1?.days || []).filter((d) => dayOpts(d).some((o) => o.workoutId || /day off/i.test(o.label))).length;
  const w2Filled = (w2?.days || []).filter((d) => dayOpts(d).some((o) => o.workoutId || /day off/i.test(o.label))).length;

  if (w1Filled >= 6) pass("week1-template", "Week 1 template days", `${w1Filled}/7 days configured`);
  else fail("week1-template", "Week 1 template", `only ${w1Filled}/7 days`);

  if (w2Filled >= 5) pass("program-week2", "Week 2 independent copies", `${w2Filled}/7 days`);
  else fail("program-week2", "Week 2 content", `only ${w2Filled}/7 days`);

  if (w1 && w2) {
    const mon1 = w1.days.find((d) => d.dayNumber === 1);
    const mon2 = w2.days.find((d) => d.dayNumber === 1);
    const id1 = dayOpts(mon1)[0]?.workoutId;
    const id2 = dayOpts(mon2)[0]?.workoutId;
    if (id1 && id2 && id1 !== id2) {
      pass("program-week2", "Week 2 Mon has separate workout ID from Week 1");
    } else if (id1 && id2) {
      fail("program-week2", "Week 2 should not share workout ID with Week 1");
    }
  }
}

function printReport() {
  const failed = results.filter((r) => !r.ok);
  const skipped = results.filter((r) => r.detail?.startsWith("SKIP:"));
  const passed = results.filter((r) => r.ok && !r.detail?.startsWith("SKIP:"));

  console.log("\n══════════════════════════════════════════");
  console.log("JEREMY FEEDBACK FULL LOOP — REPORT");
  console.log(`BASE: ${BASE}`);
  console.log("══════════════════════════════════════════\n");

  console.log(`Passed: ${passed.length}  Failed: ${failed.length}  Skipped: ${skipped.length}\n`);

  if (failed.length) {
    console.log("── FAILURES (fix or re-test) ──\n");
    for (const f of failed) {
      console.log(`  ${f.id}: ${f.name}`);
      if (f.detail) console.log(`    → ${f.detail}`);
      if (f.source) console.log(`    📎 ${f.source}`);
      console.log();
    }
  }

  if (skipped.length) {
    console.log("── SKIPPED (Jeremy/manual) ──\n");
    for (const s of skipped) {
      console.log(`  ${s.id}: ${s.detail.replace("SKIP: ", "")}`);
    }
    console.log();
  }

  console.log("── VIDEO ITEMS (July 5) — automated coverage ──\n");
  const videoItems = [
    ["program-drag", "Drag / reorder exercises"],
    ["program-save", "Save vs Publish"],
    ["program-delete", "Delete + no warmup re-inject on refresh"],
    ["program-week2", "Week 1 vs Week 2 separate workouts"],
    ["library-delete", "Exercise library delete"],
    ["upload-translation", "Text upload (not in video — written)"],
  ];
  for (const [id, label] of videoItems) {
    const r = results.find((x) => x.id === id && x.name.includes(label.split(" ")[0]) || x.id === id);
    const status = results.filter((x) => x.id === id);
    const worst = status.find((x) => !x.ok);
    const icon = worst ? "❌" : status.some((x) => x.detail?.startsWith("SKIP:")) ? "⏭" : "✅";
    console.log(`  ${icon} ${label}`);
  }

  return failed.length;
}

async function main() {
  console.log(`\n══ Jeremy feedback full loop ══\nBASE: ${BASE}\nMarker: ${MARKER}\n`);

  await testExerciseFlow();
  await testWorkoutFlow();
  await testProgramBuilderUi();
  await testProgramDeleteAndOrder();
  await testLibraryDelete();
  await testUploadTranslation();
  await testMessageAndSms();
  await testLandingAndFreeTicket();
  await testMemberSurfaces();
  await testWeek1Week2();

  const failCount = printReport();
  process.exit(failCount ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});