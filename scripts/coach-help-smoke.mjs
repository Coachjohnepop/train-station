#!/usr/bin/env node
/**
 * Smoke test Jeremy-only Grok help panel API.
 *
 *   BASE_URL=https://www.thetrainstation.co COACH_PASSWORD=CoachTest123! \
 *     node scripts/coach-help-smoke.mjs
 */
const BASE = process.env.BASE_URL || "https://www.thetrainstation.co";
const COACH_EMAIL = process.env.COACH_EMAIL || "jeremy@thetrainstation.co";
const COACH_PASSWORD =
  process.env.COACH_PASSWORD || process.env.COACH_TEST_PASSWORD || "CoachTest123!";

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
    body = text.slice(0, 200);
  }
  return { res, body, text };
}

async function main() {
  console.log(`Coach help smoke on ${BASE}\n`);

  const login = await req("/api/auth/login", {
    method: "POST",
    json: { email: COACH_EMAIL, password: COACH_PASSWORD },
  });
  if (!login.res.ok) {
    console.error("✗ Login failed:", login.res.status, login.body);
    process.exit(1);
  }
  console.log("✓ Jeremy login");

  const status = await req("/api/admin/help-chat");
  if (!status.res.ok) {
    console.error("✗ help-chat GET failed:", status.res.status, status.body);
    process.exit(1);
  }
  if (!status.body?.enabled) {
    console.error("✗ Help not enabled for this account:", status.body);
    process.exit(1);
  }
  console.log(`✓ Help enabled (configured=${status.body.configured})`);

  const chat = await req("/api/admin/help-chat", {
    method: "POST",
    json: {
      message: "How do I copy today's workout to another member?",
      pagePath: "/admin/day",
    },
  });
  if (!chat.res.ok) {
    console.error("✗ help-chat POST failed:", chat.res.status, chat.body);
    process.exit(1);
  }
  if (!chat.body?.reply) {
    console.error("✗ No reply from Grok:", chat.body);
    process.exit(1);
  }
  console.log(`✓ Grok reply: ${chat.body.reply.slice(0, 120)}…`);

  console.log("\nAll coach-help checks passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});