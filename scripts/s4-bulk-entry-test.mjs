#!/usr/bin/env node
/**
 * Sprint 4 — bulk text upload + seed export smoke test.
 * Usage: BASE_URL=https://www.thetrainstation.co npm run test:s4
 */

const BASE = process.env.BASE_URL || "https://www.thetrainstation.co";
const COACH_EMAIL = process.env.COACH_EMAIL || "jeremy@thetrainstation.co";
const MARKER = `S4-${Date.now()}`;

let cookies = "";
const results = [];

function pass(n, d = "") {
  results.push({ ok: true });
  console.log(`✅ ${n}${d ? ` — ${d}` : ""}`);
}
function fail(n, d = "") {
  results.push({ ok: false });
  console.log(`❌ ${n}${d ? ` — ${d}` : ""}`);
}

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
      cookies
        .split("; ")
        .filter(Boolean)
        .map((p) => p.split("="))
        .map(([k, ...v]) => [k, v.join("=")]),
    );
    for (const c of setCookie) {
      const [kv] = c.split(";");
      const [k, ...v] = kv.split("=");
      jar[k] = v.join("=");
    }
    cookies = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
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

async function coachLogin() {
  const { res, body } = await req("/api/auth/login", {
    method: "POST",
    json: { email: COACH_EMAIL, password: "", redirect: "/admin" },
  });
  if (res.ok && body?.user?.role) pass("Coach login", COACH_EMAIL);
  else fail("Coach login", `${res.status}`);
  return res.ok;
}

async function main() {
  console.log(`\nS4 bulk entry test\nBASE: ${BASE}\n`);

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

  await coachLogin();
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