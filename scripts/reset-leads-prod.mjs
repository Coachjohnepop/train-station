#!/usr/bin/env node
/**
 * Clear all leads on production and optionally seed a test member.
 *
 * Usage:
 *   node scripts/reset-leads-prod.mjs
 *   BASE_URL=https://www.thetrainstation.co COACH_EMAIL=jeremy@thetrainstation.co node scripts/reset-leads-prod.mjs
 */

const BASE = process.env.BASE_URL || "https://www.thetrainstation.co";
const COACH_EMAIL = process.env.COACH_EMAIL || "jeremy@thetrainstation.co";
const COACH_PASSWORD = process.env.COACH_PASSWORD || "";

const SEED = {
  email: "coachjohnepop@yahoo.com",
  firstName: "Edward",
  lastName: "Test",
  plan: "member",
};

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
  console.log(`Logging in as ${COACH_EMAIL} on ${BASE}...`);
  const login = await req("/api/auth/login", {
    method: "POST",
    json: { email: COACH_EMAIL, password: COACH_PASSWORD },
  });

  if (!login.res.ok) {
    console.error("Login failed:", login.res.status, login.body || login.text);
    process.exit(1);
  }

  console.log("Clearing leads and seeding Edward Test...");
  const reset = await req("/api/admin/leads/reset", {
    method: "POST",
    json: { seed: SEED },
  });

  if (!reset.res.ok) {
    console.error("Reset failed:", reset.res.status, reset.body || reset.text);
    process.exit(1);
  }

  console.log(JSON.stringify(reset.body, null, 2));
  console.log("\nDone. Edward Test can sign in at /login with a blank password.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});