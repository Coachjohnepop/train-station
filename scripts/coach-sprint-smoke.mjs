#!/usr/bin/env node
/**
 * Smoke test coach sprint APIs (queue, live floor, coach prefs).
 *
 *   BASE_URL=https://www.thetrainstation.co COACH_EMAIL=... COACH_PASSWORD=... \
 *     node scripts/coach-sprint-smoke.mjs
 */
const BASE = process.env.BASE_URL || "https://www.thetrainstation.co";
const COACH_EMAIL = process.env.COACH_EMAIL || "jeremy@thetrainstation.co";
const COACH_PASSWORD =
  process.env.COACH_PASSWORD || process.env.COACH_TEST_PASSWORD || "";

let cookies = "";

async function req(path, opts = {}) {
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const headers = { ...(opts.headers || {}) };
  if (cookies) headers.Cookie = cookies;
  if (opts.json) {
    headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(opts.json);
  }
  const res = await fetch(url, { ...opts, headers, redirect: "manual" });
  const setCookie = res.headers.getSetCookie?.() || [];
  if (setCookie.length) {
    const jar = Object.fromEntries(
      (cookies ? cookies.split("; ").map((p) => p.split("=")) : []).filter(([k]) => k),
    );
    for (const raw of setCookie) {
      const part = raw.split(";")[0];
      const [k, ...v] = part.split("=");
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

async function main() {
  console.log(`Coach sprint smoke on ${BASE}\n`);

  if (!COACH_PASSWORD) {
    console.error("Set COACH_PASSWORD or COACH_TEST_PASSWORD");
    process.exit(1);
  }

  const login = await req("/api/auth/login", {
    method: "POST",
    json: { email: COACH_EMAIL, password: COACH_PASSWORD },
  });
  if (!login.res.ok) {
    console.error("Login failed:", login.res.status, login.body || login.text);
    process.exit(1);
  }
  console.log("✓ Coach login");

  const queueCount = await req("/api/admin/queue/count");
  if (!queueCount.res.ok) {
    console.error("Queue count failed:", queueCount.res.status);
    process.exit(1);
  }
  console.log(`✓ Queue count: ${queueCount.body.count}`);

  const queueList = await req("/api/admin/queue");
  if (!queueList.res.ok) {
    console.error("Queue list failed:", queueList.res.status);
    process.exit(1);
  }
  if (!Array.isArray(queueList.body.items)) {
    console.error("Queue list missing items array");
    process.exit(1);
  }
  console.log(`✓ Queue list: ${queueList.body.items.length} item(s)`);

  const today = new Date().toISOString().slice(0, 10);
  const floor = await req(`/api/admin/live-floor?date=${today}`);
  if (!floor.res.ok) {
    console.error("Live floor failed:", floor.res.status);
    process.exit(1);
  }
  console.log(
    `✓ Live floor: ${floor.body.assignedCount} tile(s) on ${floor.body.sessionDate}`,
  );
  if (Array.isArray(floor.body.tiles)) {
    for (const tile of floor.body.tiles) {
      if (!("activeExercise" in tile)) {
        console.error("Live floor tile missing activeExercise field");
        process.exit(1);
      }
    }
    if (floor.body.tiles.length > 0) {
      console.log(`  activeExercise sample: ${floor.body.tiles[0].activeExercise ?? "null"}`);
    }
  }

  const members = await req("/api/admin/members");
  if (!members.res.ok) {
    console.error("Members list failed:", members.res.status);
    process.exit(1);
  }
  const memberList = members.body.members || [];
  console.log(`✓ Members: ${memberList.length} row(s)`);
  if (memberList.length > 0 && !("coachingMode" in memberList[0])) {
    console.error("Members missing coachingMode field");
    process.exit(1);
  }

  const testMember = memberList[0];
  if (testMember) {
    const currentMode = testMember.coachingMode;
    const flip = currentMode === "live" ? "async" : "live";
    const patch = await req(
      `/api/admin/members/${encodeURIComponent(testMember.userId)}/coach-prefs`,
      { method: "PATCH", json: { coachingMode: flip } },
    );
    if (!patch.res.ok) {
      console.error("Coach prefs PATCH failed:", patch.res.status, patch.body);
      process.exit(1);
    }
    const restore = await req(
      `/api/admin/members/${encodeURIComponent(testMember.userId)}/coach-prefs`,
      { method: "PATCH", json: { coachingMode: currentMode } },
    );
    if (!restore.res.ok) {
      console.error("Coach prefs restore failed:", restore.res.status);
      process.exit(1);
    }
    console.log(`✓ Coach prefs PATCH round-trip (${currentMode} → ${flip} → ${currentMode})`);
  } else {
    console.log("○ Coach prefs PATCH skipped (no members)");
  }

  const pages = ["/admin/queue", "/admin/live", "/admin/members"];
  for (const path of pages) {
    const page = await req(path);
    if (page.res.status !== 200) {
      console.error(`Page ${path} failed:`, page.res.status);
      process.exit(1);
    }
    console.log(`✓ ${path} renders`);
  }

  console.log("\nCoach sprint smoke passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});