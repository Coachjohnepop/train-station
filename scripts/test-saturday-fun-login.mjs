#!/usr/bin/env node
/**
 * Test Jeremy + John login and Saturday fun workout on prod.
 *
 *   node scripts/test-saturday-fun-login.mjs
 */
const BASE = (process.argv[2] || "https://www.thetrainstation.co").replace(/\/$/, "");
const SESSION_DATE = process.argv[3] || "2026-07-04";

const JEREMY = { email: "jeremy@thetrainstation.co", password: "CoachTest123!" };
const JOHN = { email: "john@bcxvoice.com", password: process.env.JOHN_PASSWORD || "TestPass123!" };

function parseSetCookie(headers) {
  const raw = headers.getSetCookie?.() || [];
  return raw.map((c) => c.split(";")[0]).join("; ");
}

async function login({ email, password, redirect }) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, redirect }),
    redirect: "manual",
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok && parseSetCookie(res.headers).includes("ts_session"), body, cookies: parseSetCookie(res.headers) };
}

async function main() {
  console.log(`\nLogin + Saturday workout test → ${BASE} (${SESSION_DATE})\n`);

  const jeremy = await login({ ...JEREMY, redirect: "/admin/day" });
  if (!jeremy.ok) {
    console.error("❌ Jeremy login failed", jeremy.body);
    process.exit(1);
  }
  console.log(`✅ Jeremy login → ${jeremy.body.redirect}`);
  if (!String(jeremy.body.redirect || "").includes("/admin/day")) {
    console.error("❌ Jeremy should redirect to /admin/day, got", jeremy.body.redirect);
    process.exit(1);
  }

  const coachDay = await fetch(`${BASE}/admin/day?date=${SESSION_DATE}`, {
    headers: { Cookie: jeremy.cookies },
    redirect: "manual",
  });
  if (coachDay.status !== 200) {
    console.error("❌ Coach day page", coachDay.status);
    process.exit(1);
  }
  const coachHtml = await coachDay.text();
  if (!coachHtml.includes("My class") && !coachHtml.includes("Saturday")) {
    console.log("⚠ Coach day HTML loaded (status 200) — verify roster in browser");
  } else {
    console.log("✅ Coach /admin/day loads for Saturday");
  }

  const parseRes = await fetch(`${BASE}/api/today/lesson-plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: jeremy.cookies },
    body: JSON.stringify({
      rawText: "Sexy boob lifts 3x10\nSlap that ass hardening 4x12",
      includeWarmup: true,
    }),
  });
  const parseBody = await parseRes.json().catch(() => ({}));
  if (!parseRes.ok) {
    console.error("❌ Lesson plan interpret", parseBody);
    process.exit(1);
  }
  console.log(`✅ Lesson plan interpret — ${parseBody.workout?.exercises?.length || 0} blocks`);

  const john = await login({ ...JOHN, redirect: `/member/today?date=${SESSION_DATE}` });
  if (!john.ok) {
    console.error("❌ John login failed", john.body);
    process.exit(1);
  }
  console.log(`✅ John login → ${john.body.redirect}`);

  const todayApi = await fetch(`${BASE}/api/today?date=${SESSION_DATE}`, {
    headers: { Cookie: john.cookies },
  });
  const todayBody = await todayApi.json().catch(() => ({}));
  if (!todayApi.ok || !todayBody.session?.workoutId) {
    console.error("❌ John Saturday session missing", todayBody);
    process.exit(1);
  }
  const title = todayBody.session.title || "";
  console.log(`✅ John has session: "${title}" workout=${todayBody.session.workoutId}`);

  if (!/fun|saturday|sexy|boob|intestine|ass/i.test(title + todayBody.session.rawSms)) {
    console.log("⚠ Session title may not match fun workout — check rawSms in blob");
  }

  console.log(`\n── Forward these ──`);
  console.log(`Coach:   ${BASE}/admin/day?date=${SESSION_DATE}`);
  console.log(`Members: ${BASE}/member/today?date=${SESSION_DATE}`);
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});