#!/usr/bin/env node
/**
 * Coach chat persistence smoke test — coach reply must appear in member inbox.
 *
 * Usage:
 *   node scripts/chat-persistence-test.mjs
 *   BASE_URL=https://www.thetrainstation.co COACH_EMAIL=john@thetrainstation.co COACH_PASSWORD=... node scripts/chat-persistence-test.mjs
 */

const BASE = process.env.BASE_URL || "http://localhost:3000";
const COACH_EMAIL = process.env.COACH_EMAIL || "jeremy@thetrainstation.co";
const COACH_PASSWORD = process.env.COACH_PASSWORD || "";
const MEMBER_ID = process.env.MEMBER_ID || "demo-user-john";
const THREAD_ID = `thread-member-${MEMBER_ID}`;
const MARKER = `QA-CHAT-${Date.now()}`;

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

function pass(msg) {
  console.log(`✅ ${msg}`);
}
function fail(msg, detail = "") {
  console.error(`❌ ${msg}${detail ? ` — ${detail}` : ""}`);
  process.exit(1);
}

async function main() {
  console.log(`Chat persistence test → ${BASE}`);
  console.log(`Member ${MEMBER_ID} / thread ${THREAD_ID}`);

  if (COACH_PASSWORD) {
    const login = await req("/api/auth/login", {
      method: "POST",
      json: { email: COACH_EMAIL, password: COACH_PASSWORD },
    });
    if (!login.res.ok) fail("Coach login", `${login.res.status} ${login.text}`);
    pass(`Logged in as ${COACH_EMAIL}`);
  }

  const reply = await req("/api/chat/reply", {
    method: "POST",
    json: { message: MARKER, threadId: THREAD_ID, role: "coach", sendSms: false },
  });
  if (!reply.res.ok) fail("Coach reply", `${reply.res.status} ${reply.text}`);
  if (!reply.body?.message?.id) fail("Coach reply body", JSON.stringify(reply.body));
  pass("Coach reply accepted");

  await new Promise((r) => setTimeout(r, 1500));

  const member = await req(
    `/api/chat/messages?threadId=${encodeURIComponent(THREAD_ID)}&role=member`,
    { headers: { Cookie: `ts_uid=${MEMBER_ID}` } },
  );
  if (!member.res.ok) fail("Member fetch", `${member.res.status} ${member.text}`);

  const found = (member.body?.messages || []).some((m) => m.body === MARKER);
  if (!found) {
    fail(
      "Member inbox contains coach message",
      `messages=${(member.body?.messages || []).length} marker=${MARKER}`,
    );
  }

  pass("Member inbox shows coach message");
  console.log("All chat persistence checks passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});