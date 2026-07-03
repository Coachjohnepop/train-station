#!/usr/bin/env node
/**
 * Slice 3c — coach today-sessions on Postgres (database mode).
 *
 * Usage:
 *   BASE_URL=https://www.thetrainstation.co npm run test:s3c
 */

const BASE = process.env.BASE_URL || "http://localhost:3000";
const COACH_EMAIL = process.env.COACH_EMAIL || "jeremy@thetrainstation.co";
const COACH_PASSWORD_ENV =
  process.env.COACH_PASSWORD ?? process.env.COACH_TEST_PASSWORD ?? null;
const MEMBER_USER_ID = process.env.MEMBER_USER_ID || "demo-user-john-steph";

const results = [];
let cookies = "";

function pass(name, detail = "") {
  results.push({ name, ok: true, detail });
  console.log(`✅ ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name, detail = "") {
  results.push({ name, ok: false, detail });
  console.log(`❌ ${name}${detail ? ` — ${detail}` : ""}`);
}

function parseSetCookie(headers) {
  const raw = headers.getSetCookie?.() || [];
  return raw.map((c) => c.split(";")[0]).join("; ");
}

async function tryLogin(password) {
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: COACH_EMAIL,
      password,
      redirect: "/admin/today",
    }),
    redirect: "manual",
  });
  const setCookie = parseSetCookie(loginRes.headers);
  if (loginRes.ok && setCookie.includes("ts_session")) {
    cookies = setCookie;
    return true;
  }
  return false;
}

async function loginCoach() {
  const attempts =
    COACH_PASSWORD_ENV !== null ? [COACH_PASSWORD_ENV] : ["CoachTest123!", ""];
  for (const password of attempts) {
    if (await tryLogin(password)) {
      pass("Coach login", COACH_EMAIL);
      return true;
    }
  }
  fail("Coach login", "set COACH_PASSWORD for prod");
  return false;
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
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { res, body };
}

function localTodayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function main() {
  console.log(`\nS3c today-sessions DB test\nBASE: ${BASE}\nUSER: ${MEMBER_USER_ID}\n`);

  if (!(await loginCoach())) process.exit(1);

  const persistence = await req("/api/admin/demo-persistence");
  if (!persistence.res.ok) {
    fail("Persistence status", `${persistence.res.status}`);
    process.exit(1);
  }
  if (persistence.body.demoMode) {
    fail("Database mode", "still demo/blob — set POSTGRES_PRISMA_URL on prod");
    process.exit(1);
  }
  pass("Database mode", "today-sessions path is Postgres");

  const sessionDate = process.env.SESSION_DATE || localTodayIso();
  const marker = `S3c soak ${Date.now()}`;
  const rawSms = `${marker}\n\nJump squats 10\n\nPush ups 10,10,10`;

  const list0 = await req("/api/today?all=1");
  if (!list0.res.ok || !Array.isArray(list0.body?.sessions)) {
    fail("List sessions", `${list0.res.status} ${JSON.stringify(list0.body)}`);
    process.exit(1);
  }
  const baseline = list0.body.sessions.length;
  pass("List sessions", `${baseline} total`);

  const scheduledAt = new Date(`${sessionDate}T14:00:00`).toISOString();
  const create = await req("/api/today", {
    method: "POST",
    json: {
      sessionDate,
      scheduledAt,
      rawSms,
      programSlug: "adult",
      userIds: [MEMBER_USER_ID],
      replacesSchedule: true,
      title: marker,
    },
  });
  if (!create.res.ok || !create.body?.session?.id) {
    fail("Create today session", `${create.res.status} ${JSON.stringify(create.body)}`);
    process.exit(1);
  }
  const sessionId = create.body.session.id;
  pass("Create today session", `${sessionId} · workout ${create.body.workoutId}`);

  const read = await req(
    `/api/today?userId=${encodeURIComponent(MEMBER_USER_ID)}&date=${sessionDate}`,
  );
  if (!read.res.ok || !read.body?.session?.id) {
    fail("Read member session", `${read.res.status} ${JSON.stringify(read.body)}`);
    process.exit(1);
  }
  if (read.body.session.id !== sessionId) {
    fail("Verify session id", `expected ${sessionId}, got ${read.body.session.id}`);
    process.exit(1);
  }
  pass("Read member session", read.body.session.title);

  const list1 = await req("/api/today?all=1");
  if (!list1.res.ok || list1.body.sessions.length < baseline + 1) {
    fail(
      "Verify session count",
      `expected >= ${baseline + 1}, got ${list1.body?.sessions?.length}`,
    );
    process.exit(1);
  }
  pass("Verify persisted session count", `${list1.body.sessions.length} total`);

  const del = await req(`/api/today?sessionId=${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
  });
  if (!del.res.ok || !del.body?.deleted) {
    fail("Delete test session", `${del.res.status} ${JSON.stringify(del.body)}`);
    process.exit(1);
  }
  pass("Delete test session", sessionId);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n---\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exit(1);
  console.log("\nS3c acceptance: PASS\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});