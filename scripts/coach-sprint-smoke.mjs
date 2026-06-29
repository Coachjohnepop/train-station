#!/usr/bin/env node
/**
 * Smoke test coach sprint APIs (queue count, live floor).
 *
 *   BASE_URL=https://www.thetrainstation.co COACH_EMAIL=... COACH_PASSWORD=... \
 *     node scripts/coach-sprint-smoke.mjs
 */
const BASE = process.env.BASE_URL || "https://www.thetrainstation.co";
const COACH_EMAIL = process.env.COACH_EMAIL || "jeremy@thetrainstation.co";
const COACH_PASSWORD = process.env.COACH_PASSWORD || "";

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

  const login = await req("/api/auth/login", {
    method: "POST",
    json: { email: COACH_EMAIL, password: COACH_PASSWORD },
  });
  if (!login.res.ok) {
    console.error("Login failed:", login.res.status, login.body || login.text);
    process.exit(1);
  }
  console.log("✓ Coach login");

  const queue = await req("/api/admin/queue/count");
  if (!queue.res.ok) {
    console.error("Queue count failed:", queue.res.status);
    process.exit(1);
  }
  console.log(`✓ Queue count: ${queue.body.count}`);

  const today = new Date().toISOString().slice(0, 10);
  const floor = await req(`/api/admin/live-floor?date=${today}`);
  if (!floor.res.ok) {
    console.error("Live floor failed:", floor.res.status);
    process.exit(1);
  }
  console.log(`✓ Live floor: ${floor.body.assignedCount} tile(s) on ${floor.body.sessionDate}`);

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