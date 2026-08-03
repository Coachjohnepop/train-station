#!/usr/bin/env node
/**
 * Condensed S3 + S4 smoke test (catalog cleanup + bulk entry/export).
 * Usage: BASE_URL=https://www.thetrainstation.co npm run test:s3-s4
 */

const BASE = process.env.BASE_URL || "https://www.thetrainstation.co";
const COACH_EMAIL = process.env.COACH_EMAIL || "jeremy@thetrainstation.co";
const MARKER = `S34-${Date.now()}`;

let cookies = "";
const results = [];

function ok(label) {
  results.push(true);
  console.log(`✅ ${label}`);
}
function bad(label, detail = "") {
  results.push(false);
  console.log(`❌ ${label}${detail ? ` — ${detail}` : ""}`);
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
  console.log(`S3+S4 @ ${BASE}\n`);

  // —— S3 catalog ——
  const { res: pRes, body: programs } = await req(`/api/programs?_t=${MARKER}`);
  if (!pRes.ok || !Array.isArray(programs)) {
    bad("S3 programs API");
    return summary();
  }
  const names = programs.map((p) => p.name);
  const live = [
    "Strength & Conditioning",
    "Athletes — Speed, Strength & Conditioning",
    "Military Preparation",
    "Mom & Dads with Little Time",
  ];
  const hidden = [/muscle max/i, /gracefully age/i, /combat training/i];
  if (programs.length === 5 && live.every((n) => names.includes(n))) ok("S3 catalog (5 programs)");
  else bad("S3 catalog", `${programs.length} programs`);
  if (names.includes("Adolescent Training")) ok("S3 adolescent coming soon");
  else bad("S3 adolescent coming soon");
  if (!hidden.some((re) => names.find((n) => re.test(n)))) ok("S3 junk hidden");
  else bad("S3 junk hidden");

  const { body: workouts } = await req(`/api/workouts?_t=${MARKER}`);
  const qa = Array.isArray(workouts)
    ? workouts.filter((w) => /\bqa\b|\bsmoke\b/i.test(w.name || ""))
    : [];
  if (qa.length === 0) ok("S3 QA workouts filtered");
  else bad("S3 QA workouts filtered", `${qa.length} remain`);

  // —— S4 text upload week ——
  const adult = programs.find((p) => p.slug === "adult");
  const weekText = "Day 1 Gym: Day 1 Upper Body Workout (Gym)\nDay 2 Gym: Day 2 Lower Body Workout (Gym)";
  let { res, body } = await req("/api/text-upload/parse", {
    method: "POST",
    json: { mode: "program-week", rawText: weekText },
  });
  if (res.ok && body?.slots?.length >= 2) ok("S4 parse program week");
  else bad("S4 parse program week");

  ({ res, body } = await req("/api/text-upload/build", {
    method: "POST",
    json: { mode: "program-week", rawText: weekText, programSlug: adult?.slug, weekNumber: 1 },
  }));
  if (res.ok && body?.appliedCount >= 1) ok("S4 build program week");
  else bad("S4 build program week", body?.error || res.status);

  ({ res, body } = await req("/api/text-upload/build", {
    method: "POST",
    json: {
      mode: "program-week",
      rawText: "Day 1 Gym: Totally Fake Workout XYZ",
      programSlug: adult?.slug,
      weekNumber: 1,
    },
  }));
  if (!res.ok) ok("S4 rejects bad workout names");
  else bad("S4 rejects bad workout names");

  // —— S4 export ——
  let exportRes, exportBody;
  ({ res: exportRes, body: exportBody } = await req("/api/admin/export-seed"));
  if (exportRes.status === 401) {
    ({ res, body } = await req("/api/auth/login", {
      method: "POST",
      json: { email: COACH_EMAIL, password: "", redirect: "/admin" },
    }));
    if (res.ok) ok("S4 coach login");
    else bad("S4 coach login");
    const out = await req("/api/admin/export-seed");
    exportRes = out.res;
    try {
      exportBody = JSON.parse(out.text);
    } catch {
      exportBody = out.text;
    }
  }
  if (
    exportRes.ok &&
    typeof exportBody === "object" &&
    exportBody?._meta?.exportedAt &&
    Array.isArray(exportBody.programs)
  ) {
    ok("S4 export seed snapshot");
  } else {
    bad("S4 export seed snapshot", String(exportRes.status));
  }

  summary();
}

function summary() {
  const pass = results.filter(Boolean).length;
  const total = results.length;
  console.log(`\n${pass}/${total}${pass === total ? " — all good" : " — failures above"}\n`);
  process.exit(pass === total ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});