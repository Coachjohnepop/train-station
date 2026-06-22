#!/usr/bin/env node
/**
 * Condensed S3–S6 smoke test (catalog, bulk entry, member preview, booking).
 * Usage: BASE_URL=https://www.thetrainstation.co npm run test:s3-s6
 */

const BASE = process.env.BASE_URL || "https://www.thetrainstation.co";
const COACH_EMAIL = process.env.COACH_EMAIL || "jeremy@thetrainstation.co";

let cookies = "";
const results = [];

function ok(l) {
  results.push(true);
  console.log(`✅ ${l}`);
}
function bad(l, d = "") {
  results.push(false);
  console.log(`❌ ${l}${d ? ` — ${d}` : ""}`);
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
  for (const c of res.headers.getSetCookie?.() || []) {
    const jar = Object.fromEntries(
      cookies
        .split("; ")
        .filter(Boolean)
        .map((p) => p.split("="))
        .map(([k, ...v]) => [k, v.join("=")]),
    );
    const [kv] = c.split(";");
    const [k, ...v] = kv.split("=");
    jar[k] = v.join("=");
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
  console.log(`S3–S6 @ ${BASE}\n`);

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
  if (res.ok && slotCount > 0 && slotCount < 80) ok("S6 booking slots sane", `${slotCount} slots`);
  else if (res.ok && slotCount === 0) ok("S6 booking slots empty", "use Calendly");
  else bad("S6 booking slots", `${slotCount}`);

  // S5 hygiene — adolescent enroll blocked
  ({ res } = await req("/api/programs/youth-sports/enroll", { method: "POST" }));
  if (res.status === 403) ok("S5 coming-soon enroll blocked");
  else bad("S5 coming-soon enroll blocked", res.status);

  // S4 export
  await req("/api/auth/login", {
    method: "POST",
    json: { email: COACH_EMAIL, password: "", redirect: "/admin" },
  });
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