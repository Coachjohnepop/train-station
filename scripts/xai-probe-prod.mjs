#!/usr/bin/env node
/**
 * Probe xAI from production (uses server-side XAI_API_KEY).
 *   COACH_PASSWORD=... node scripts/xai-probe-prod.mjs
 */
const BASE = process.env.BASE_URL || "https://www.thetrainstation.co";
const EMAIL = process.env.COACH_EMAIL || "john@thetrainstation.co";
const PASSWORD = process.env.COACH_PASSWORD || process.env.COACH_TEST_PASSWORD || "";

let cookies = "";

async function req(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (cookies) headers.Cookie = cookies;
  if (opts.json) {
    headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(opts.json);
  }
  const res = await fetch(`${BASE}${path}`, { ...opts, headers, redirect: "manual" });
  for (const raw of res.headers.getSetCookie?.() || []) {
    const part = raw.split(";")[0];
    const i = part.indexOf("=");
    cookies += (cookies ? "; " : "") + part.slice(0, i) + "=" + part.slice(i + 1);
  }
  return { res, body: await res.json().catch(() => ({})) };
}

async function main() {
  if (!PASSWORD) {
    console.error("Set COACH_PASSWORD (john@thetrainstation.co password)");
    process.exit(1);
  }
  const login = await req("/api/auth/login", {
    method: "POST",
    json: { email: EMAIL, password: PASSWORD },
  });
  if (!login.res.ok) {
    console.error("Login failed", login.res.status, login.body);
    process.exit(1);
  }
  const probe = await req("/api/admin/help-chat?probe=1");
  console.log(JSON.stringify(probe.body, null, 2));
}

main();