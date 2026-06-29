#!/usr/bin/env node
/**
 * Jeremy demo smoke test — runs against production (or BASE_URL).
 * Usage: node scripts/jeremy-smoke-test.mjs
 */

const BASE = process.env.BASE_URL || "https://www.thetrainstation.co";
const COACH_EMAIL = "jeremy@thetrainstation.co";
const MARKER = `QA-SMOKE-${Date.now()}`;

const JEREMY_SMS = `So isolation/Core work

Warm up well 5 min bike

Jump squats 20

Flat bench Single arm dumbbell chest press
10,10,10,10 each arm

Incline bench single arm dumbbell chest press
10,10,10,10 each arm

HIIT cool down 5 mins
30 sec on 30 sec off`;

const results = [];
let cookies = "";

function pass(name, detail = "") {
  results.push({ name, ok: true, detail });
  console.log(`✅ ${name}${detail ? ` — ${detail}` : ""}`);
}
function fail(name, detail = "") {
  results.push({ name, ok: false, detail });
  console.log(`❌ ${name}${detail ? ` — ${detail}` : ""}`);
}

async function req(path, opts = {}) {
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const headers = { ...(opts.headers || {}) };
  if (cookies) headers.Cookie = cookies;
  if (opts.json) {
    headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(opts.json);
  }
  const res = await fetch(url, { ...opts, headers });
  const setCookie = res.headers.getSetCookie?.() || [];
  if (setCookie.length) {
    const parts = setCookie.map((c) => c.split(";")[0]);
    const jar = Object.fromEntries(
      (cookies ? cookies.split("; ").map((p) => p.split("=")) : []).filter(([k]) => k),
    );
    for (const p of parts) {
      const [k, ...v] = p.split("=");
      jar[k] = v.join("=");
    }
    cookies = Object.entries(jar)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }
  let body = null;
  const text = await res.text();
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

async function pageBundleContains(path, needles) {
  const { text: html } = await req(path);
  const chunks = chunkUrlsFromHtml(html);
  const found = new Set();
  for (const chunk of chunks) {
    const js = await (await fetch(`${BASE}${chunk}`)).text();
    for (const needle of needles) {
      if (js.includes(needle)) found.add(needle);
    }
    if (found.size === needles.length) break;
  }
  return { html, found: [...found], chunks: chunks.length };
}

async function waitForExerciseInList(id, attempts = 5, delayMs = 600) {
  for (let i = 0; i < attempts; i++) {
    const { body } = await req("/api/exercises");
    if (Array.isArray(body) && body.some((e) => e.id === id)) return true;
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
}

async function testLanding() {
  console.log("\n=== 1. Landing conversion ===");
  const { text } = await req("/");
  const checks = [
    ["Pick your ticket", /Pick your ticket/],
    ["Pick your ticket", /Pick your ticket/],
    ["Three ways aboard", /Three ways aboard/],
    ["Coming soon section", /Programs coming soon|On the manifest/],
    ["Ticket grid id", /id="tickets"/],
    ["Coming soon links", /signup\?interest=/],
    ["Free ticket CTA", /Tap if you dare/],
  ];
  for (const [label, re] of checks) {
    if (re.test(text)) pass(label);
    else fail(label, "not found in HTML");
  }

  const tickets = await pageBundleContains("/", ['"$25"', '"$50"', "SMS accountability texts"]);
  if (tickets.found.includes('"$25"') && tickets.found.includes('"$50"')) {
    pass("Ticket pricing in bundles", "$25 / $50");
  } else {
    fail("Ticket pricing", `found: ${tickets.found.join(", ")}`);
  }

  const welcome = await pageBundleContains("/", ["WelcomeVideoPopover", "Welcome to The Train Station"]);
  if (welcome.found.length > 0) pass("Welcome video component (bundle)", welcome.found[0]);
  else fail("Welcome video component", "not in linked JS bundles");

  for (const [path, label] of [
    ["/signup?plan=member", "Coach Class signup"],
    ["/signup?plan=pro", "1st Class signup"],
    ["/signup?plan=explorer", "Free explorer signup"],
    ["/signup?interest=stretching", "Stretching interest signup"],
  ]) {
    const { res } = await req(path);
    if (res.ok) pass(`${label} page loads (${res.status})`);
    else fail(`${label} page`, `HTTP ${res.status}`);
  }
}

async function testTextUpload() {
  console.log("\n=== 2. Text upload parse/build ===");

  const exerciseText = `${MARKER} Curl\n${MARKER} Row`;
  let { res, body } = await req("/api/text-upload/parse", {
    method: "POST",
    json: { mode: "exercises", rawText: exerciseText },
  });
  if (res.ok && body?.exercises?.length === 2) pass("Parse exercises", `${body.exercises.length} lines`);
  else fail("Parse exercises", `${res.status} ${JSON.stringify(body)?.slice(0, 120)}`);

  ({ res, body } = await req("/api/text-upload/build", {
    method: "POST",
    json: { mode: "exercises", rawText: exerciseText },
  }));
  if (res.ok && body?.created >= 1) pass("Build exercises", `created=${body.created}`);
  else fail("Build exercises", `${res.status} ${JSON.stringify(body)?.slice(0, 200)}`);

  ({ res, body } = await req("/api/text-upload/parse", {
    method: "POST",
    json: { mode: "workout", rawText: JEREMY_SMS },
  }));
  const exCount = body?.workout?.exercises?.length || 0;
  if (res.ok && exCount >= 4) pass("Parse Jeremy-style SMS workout", `${exCount} blocks`);
  else fail("Parse Jeremy-style SMS", `${res.status} blocks=${exCount}`);

  ({ res, body } = await req("/api/text-upload/build", {
    method: "POST",
    json: { mode: "workout", rawText: JEREMY_SMS, workoutName: `QA Jeremy SMS ${MARKER}` },
  }));
  if (res.ok && body?.workoutId) pass("Build Jeremy-style workout", body.workoutId);
  else fail("Build Jeremy-style workout", `${res.status} ${JSON.stringify(body)?.slice(0, 200)}`);

  const { body: programs } = await req("/api/programs");
  const adult = Array.isArray(programs) ? programs.find((p) => /adult/i.test(p.slug || p.name)) : null;
  if (!adult) {
    fail("Program week build", "no adult program in /api/programs");
    return;
  }

  const weekText = "Day 1 Gym: Preview: Upper Body Power\nDay 2 Home: Preview: Lower Body";
  ({ res, body } = await req("/api/text-upload/parse", {
    method: "POST",
    json: { mode: "program-week", rawText: weekText },
  }));
  if (res.ok && body?.slots?.length >= 1) pass("Parse program week", `${body.slots.length} slots`);
  else fail("Parse program week", `${res.status} ${JSON.stringify(body)?.slice(0, 120)}`);

  ({ res, body } = await req("/api/text-upload/build", {
    method: "POST",
    json: {
      mode: "program-week",
      rawText: weekText,
      programSlug: adult.slug,
      weekNumber: 1,
    },
  }));
  if (res.ok && body?.appliedCount >= 1) pass("Build program week", `applied=${body.appliedCount}`);
  else fail("Build program week", `${res.status} ${JSON.stringify(body)?.slice(0, 250)}`);

  ({ res, body } = await req("/api/text-upload/build", {
    method: "POST",
    json: {
      mode: "program-week",
      rawText: "Day 1 Gym: Totally Fake Workout XYZ",
      programSlug: adult.slug,
      weekNumber: 1,
    },
  }));
  if (!res.ok && String(body?.error || "").includes("matched")) {
    pass("Program week rejects bad workout names");
  } else if (!res.ok) {
    pass("Program week rejects bad workout names", body?.error?.slice(0, 60));
  } else {
    fail("Program week bad names", "should have failed but succeeded");
  }
}

async function testPersistence() {
  console.log("\n=== 3. Coach content persistence ===");

  const { res: loginRes, body: loginBody } = await req("/api/auth/login", {
    method: "POST",
    json: { email: COACH_EMAIL, password: "", redirect: "/admin" },
  });
  if (loginRes.ok && loginBody?.user?.role === "INSTRUCTOR") pass("Coach login", COACH_EMAIL);
  else {
    fail("Coach login", `${loginRes.status} ${JSON.stringify(loginBody)}`);
    return;
  }

  const testName = `QA Persist ${MARKER}`;
  let { res, body } = await req("/api/exercises", {
    method: "POST",
    json: { name: testName, description: "smoke test", tags: "qa-smoke" },
  });
  if (!res.ok || !body?.id) {
    fail("Create exercise", `${res.status} ${JSON.stringify(body)?.slice(0, 200)}`);
    return;
  }
  const exerciseId = body.id;
  pass("Create exercise", exerciseId);

  const found = await waitForExerciseInList(exerciseId);
  if (found) pass("Exercise persists after create");
  else fail("Exercise persists after create", "not in GET /api/exercises after retries");

  const newDesc = `Updated ${MARKER}`;
  ({ res, body } = await req(`/api/exercises/${exerciseId}`, {
    method: "PATCH",
    json: { description: newDesc },
  }));
  if (res.ok && body?.description === newDesc) pass("PATCH exercise description");
  else fail("PATCH exercise", `${res.status}`);

  let persisted = null;
  for (let i = 0; i < 5; i++) {
    ({ body } = await req("/api/exercises"));
    persisted = Array.isArray(body) ? body.find((e) => e.id === exerciseId) : null;
    if (persisted?.description === newDesc) break;
    await new Promise((r) => setTimeout(r, 600));
  }
  if (persisted?.description === newDesc) pass("Exercise PATCH persists on re-fetch");
  else fail("Exercise PATCH persists", `got: ${persisted?.description}`);

  const workoutName = `QA Workout ${MARKER}`;
  ({ res, body } = await req("/api/workouts", {
    method: "POST",
    json: { name: workoutName, description: "workout persistence probe" },
  }));
  const workoutId = body?.id;
  if (!res.ok || !workoutId) {
    fail("Create workout", `${res.status} ${JSON.stringify(body)?.slice(0, 120)}`);
  } else {
    pass("Create workout persists", workoutId);

    ({ res, body } = await req(`/api/workouts/${workoutId}/exercises`, {
      method: "POST",
      json: {
        exerciseId,
        setScheme: "standard",
        reps: "8-10",
        sets: 3,
        weightTier: "medium",
      },
    }));
    const workoutItemId = body?.id;
    if (!res.ok || !workoutItemId) {
      fail("Add exercise to workout", `${res.status}`);
    } else {
      pass("Add exercise to workout", workoutItemId);

      ({ res, body } = await req(`/api/workouts/${workoutId}/exercises`, {
        method: "PATCH",
        json: { itemId: workoutItemId, sets: 4, reps: "12" },
      }));
      if (res.ok && body?.sets === 4 && body?.reps === "12") pass("PATCH workout exercise prescription");
      else fail("PATCH workout exercise", `${res.status}`);

      let wItem = null;
      for (let i = 0; i < 5; i++) {
        ({ body } = await req(`/api/workouts/${workoutId}`));
        wItem = body?.exercises?.find((e) => e.id === workoutItemId);
        if (wItem?.sets === 4 && wItem?.reps === "12") break;
        await new Promise((r) => setTimeout(r, 600));
      }
      if (wItem?.sets === 4 && wItem?.reps === "12") pass("Workout exercise PATCH persists on re-fetch");
      else fail("Workout exercise re-fetch", `sets=${wItem?.sets} reps=${wItem?.reps}`);

      const renamed = `${testName} RENAMED`;
      await req(`/api/exercises/${exerciseId}`, {
        method: "PATCH",
        json: { name: renamed },
      });
      let propagated = null;
      for (let i = 0; i < 5; i++) {
        ({ body } = await req(`/api/workouts/${workoutId}`));
        propagated = body?.exercises?.find((e) => e.id === workoutItemId);
        if (propagated?.exercise?.name === renamed) break;
        await new Promise((r) => setTimeout(r, 600));
      }
      if (propagated?.exercise?.name === renamed) pass("Library rename propagates to workout view");
      else fail("Name propagation", `got: ${propagated?.exercise?.name}`);

      const del = await req(
        `/api/workouts/${workoutId}/exercises?itemId=${encodeURIComponent(workoutItemId)}`,
        { method: "DELETE" },
      );
      if (del.res.status === 204) pass("DELETE workout exercise");
      else fail("DELETE workout exercise", String(del.res.status));

      ({ body } = await req(`/api/workouts/${workoutId}`));
      const stillThere = body?.exercises?.some((e) => e.id === workoutItemId);
      if (!stillThere) pass("Workout exercise delete persists on re-fetch");
      else fail("Workout exercise delete re-fetch", "item still present");
    }
  }

  const { body: summary } = await req("/api/admin/programs-summary");
  const adult = summary?.programs?.find((p) => p.slug === "adult");
  const dayId = adult?.weeks?.[0]?.days?.[0]?.id;
  if (!dayId) {
    fail("Program day PATCH", "no day id in programs-summary");
    return;
  }

  const testNote = `QA note ${MARKER}`;
  ({ res, body } = await req(`/api/programs/days/${dayId}`, {
    method: "PATCH",
    json: { notes: testNote },
  }));
  if (res.ok && body?.notes === testNote) pass("PATCH program day notes", dayId);
  else fail("PATCH program day", `${res.status} ${JSON.stringify(body)?.slice(0, 120)}`);

  let dayNotes = null;
  for (let i = 0; i < 5; i++) {
    await new Promise((r) => setTimeout(r, i === 0 ? 1200 : 600));
    ({ res, body } = await req(`/api/programs/days/${dayId}`, {
      method: "PATCH",
      json: { videoUrl: null },
    }));
    if (res.ok && body?.notes === testNote) {
      dayNotes = body.notes;
      break;
    }
  }
  if (dayNotes === testNote) pass("Program day notes survive re-fetch");
  else fail("Program day notes re-fetch", `notes=${body?.notes}`);

  await req(`/api/programs/days/${dayId}`, { method: "PATCH", json: { notes: null } });

  const today = "2026-06-20";
  ({ res, body } = await req("/api/today/parse", {
    method: "POST",
    json: { rawSms: JEREMY_SMS },
  }));
  if (res.ok && body?.workout?.exercises?.length >= 4) pass("Today SMS parse (rawSms field)");
  else fail("Today SMS parse", `${res.status}`);

  ({ res, body } = await req("/api/today", {
    method: "POST",
    json: {
      sessionDate: today,
      scheduledAt: `${today}T11:00:00.000Z`,
      rawSms: `QA ${MARKER}\n${JEREMY_SMS}`,
      userIds: ["demo-user-john-steph"],
    },
  }));
  if (res.ok && body?.session?.id) pass("Today assign/build", body.session.id);
  else fail("Today assign", `${res.status} ${JSON.stringify(body)?.slice(0, 200)}`);

  ({ res, body } = await req(`/api/today?date=${today}&userId=demo-user-john-steph`));
  if (res.ok && body?.session?.rawSms?.includes(MARKER)) pass("Today GET immediately after assign");
  else fail("Today GET after assign", body?.session ? "marker missing" : "session null");

  for (const path of ["/admin/exercises", "/admin/workouts", "/admin/programs/adult", "/admin/today"]) {
    const { res: pageRes } = await req(path);
    if (pageRes.ok) pass(`Admin page ${path}`);
    else fail(`Admin page ${path}`, `HTTP ${pageRes.status}`);
  }

  await req(`/api/exercises/${exerciseId}`, { method: "DELETE" });
  await new Promise((r) => setTimeout(r, 800));
  ({ res, body } = await req("/api/exercises"));
  const deleted = !Array.isArray(body) || !body.some((e) => e.id === exerciseId);
  if (deleted) pass("Delete exercise persists");
  else fail("Delete exercise", "still in list");
}

async function main() {
  console.log(`Jeremy smoke test → ${BASE}`);
  console.log(`Marker: ${MARKER}\n`);

  try {
    await testLanding();
    await testTextUpload();
    await testPersistence();
  } catch (e) {
    fail("Unhandled error", e.message);
    console.error(e);
  }

  const failed = results.filter((r) => !r.ok);
  console.log("\n=== Summary ===");
  console.log(`${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.log("\nFailures:");
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
    process.exit(1);
  }
}

main();