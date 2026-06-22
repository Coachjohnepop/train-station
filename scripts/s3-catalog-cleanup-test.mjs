#!/usr/bin/env node
/**
 * Sprint 3 — catalog naming / visibility smoke test (API level).
 *
 * Usage:
 *   node scripts/s3-catalog-cleanup-test.mjs
 *   BASE_URL=https://www.thetrainstation.co npm run test:s3
 */

const BASE = process.env.BASE_URL || "https://www.thetrainstation.co";

const LIVE_NAMES = [
  "Adult Strength Conditioning",
  "Athletes — Speed, Strength & Conditioning",
  "Military Preparation",
  "Mom & Dads with Little Time",
];

const COMING_SOON_NAMES = ["Adolescent Training"];

const HIDDEN_NAME_PATTERNS = [
  /muscle max/i,
  /weight loss/i,
  /gracefully age/i,
  /combat training/i,
  /yoga channel/i,
  /john & steph/i,
];

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

async function req(path, opts = {}) {
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const headers = {
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    ...(opts.headers || {}),
  };
  if (opts.json) {
    headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(opts.json);
  }
  const res = await fetch(url, { ...opts, headers, cache: "no-store" });
  let body = null;
  const text = await res.text();
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { res, body, text };
}

function isQaWorkoutName(name) {
  const n = String(name || "").toLowerCase();
  return /\bqa\b/.test(n) || /\bqa[-_]/.test(n) || /\bsmoke\b/.test(n);
}

async function main() {
  console.log(`\nS3 catalog cleanup test\nBASE: ${BASE}\n`);

  const { res, body } = await req(bust("/api/programs"));
  if (!res.ok || !Array.isArray(body)) {
    fail("GET /api/programs", `${res.status}`);
    printSummary();
    process.exit(1);
  }

  const names = body.map((p) => p.name);
  pass("GET /api/programs", `${body.length} program(s)`);

  for (const expected of LIVE_NAMES) {
    if (names.includes(expected)) pass(`Live program visible: ${expected}`);
    else fail(`Live program visible: ${expected}`);
  }

  for (const expected of COMING_SOON_NAMES) {
    if (names.includes(expected)) pass(`Coming soon visible: ${expected}`);
    else fail(`Coming soon visible: ${expected}`);
  }

  for (const pattern of HIDDEN_NAME_PATTERNS) {
    const hit = names.find((n) => pattern.test(n));
    if (hit) fail(`Hidden program not in API list`, hit);
    else pass(`Hidden program absent`, pattern.source);
  }

  const adult = body.find((p) => p.slug === "adult" || p.name === LIVE_NAMES[0]);
  if (adult?.name === LIVE_NAMES[0]) pass("Adult slug keeps canonical name");
  else fail("Adult slug keeps canonical name", adult?.name || "missing");

  const boot = body.find((p) => p.slug === "boot-camp-preparation");
  if (boot?.name === "Military Preparation") pass("Boot camp renamed to Military Preparation");
  else fail("Boot camp renamed to Military Preparation", boot?.name || "missing");

  const momDads = body.find(
    (p) => p.slug === "mom-dads-little-time" || /mom.*dad/i.test(p.name || ""),
  );
  if (momDads?.name === "Mom & Dads with Little Time") {
    pass("Mom & Dads program present");
  } else {
    fail("Mom & Dads program present", momDads?.name || "missing");
  }

  const { res: wRes, body: workouts } = await req(bust("/api/workouts"));
  if (!wRes.ok || !Array.isArray(workouts)) {
    fail("GET /api/workouts", `${wRes.status}`);
  } else {
    const qaHits = workouts.filter((w) => isQaWorkoutName(w.name));
    if (qaHits.length === 0) pass("QA/smoke workouts hidden from admin list");
    else fail("QA/smoke workouts hidden from admin list", qaHits.map((w) => w.name).join(", "));
  }

  printSummary();
  process.exit(results.some((r) => !r.ok) ? 1 : 0);
}

function printSummary() {
  const ok = results.filter((r) => r.ok).length;
  const bad = results.length - ok;
  console.log(`\n${ok}/${results.length} passed${bad ? ` (${bad} failed)` : ""}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});