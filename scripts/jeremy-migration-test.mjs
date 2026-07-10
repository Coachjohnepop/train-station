#!/usr/bin/env node
/**
 * Jeremy migration QA — auto-checks prod APIs for JEREMY_MIGRATION_TEST.md
 * and prints manual browser steps for items that need human verification.
 *
 * Usage:
 *   npm run test:jeremy-migration
 *   BASE_URL=https://www.thetrainstation.co npm run test:jeremy-migration
 *
 * Env:
 *   COACH_EMAIL / COACH_PASSWORD (default jeremy@ + CoachTest123!)
 *   MEMBER_EMAIL / MEMBER_PASSWORD — optional, enables item #3 API probe
 *   SKIP_WRITE=1 — read-only API checks (no chat/SMS/live-session writes)
 */

import { createCoachClient } from "./lib/coach-auth.mjs";

const BASE = (process.env.BASE_URL || "https://www.thetrainstation.co").replace(/\/$/, "");
const MARKER = `QA-MIGRATION-${Date.now()}`;
const SKIP_WRITE = process.env.SKIP_WRITE === "1" || process.env.SKIP_WRITE === "true";
const MEMBER_EMAIL = process.env.MEMBER_EMAIL || "";
const MEMBER_PASSWORD = process.env.MEMBER_PASSWORD || "";

const PLAN_TEXT = `${MARKER} lower day

Leg press
3 sets
10,10,10`;

const results = [];

function tag(n) {
  return `[#${n}]`;
}

function pass(item, name, detail = "") {
  results.push({ item, name, ok: true, detail });
  console.log(`✅ ${tag(item)} ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(item, name, detail = "") {
  results.push({ item, name, ok: false, detail });
  console.log(`❌ ${tag(item)} ${name}${detail ? ` — ${detail}` : ""}`);
}

function skip(item, name, detail = "") {
  results.push({ item, name, ok: true, detail, skipped: true });
  console.log(`○ ${tag(item)} ${name}${detail ? ` — ${detail}` : ""}`);
}

function bust(path) {
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}_t=${Date.now()}`;
}

const MANUAL_STEPS = [
  {
    item: 3,
    title: "Member chat",
    steps: [
      "Sign in as a member (not coach)",
      "Open member chat and reply to coach",
      "On admin /admin/chat, confirm unread badge and message appear",
    ],
  },
  {
    item: 4,
    title: "New signup",
    steps: [
      "Register a new test email at /signup",
      "Confirm the member appears in Admin → Members with profile fields",
    ],
  },
  {
    item: 8,
    title: "Stripe checkout (optional)",
    steps: [
      "Complete a test checkout if you have a test card",
      "Confirm paid flags update on the member profile",
    ],
  },
  {
    item: 9,
    title: "Existing member login (after auth Phase C)",
    steps: ["Log in as a blob-imported member (not a fresh signup)"],
    pending: true,
  },
  {
    item: 10,
    title: "Password reset (after auth Phase C)",
    steps: ["Request reset → email link → set password → log in"],
    pending: true,
  },
  {
    item: 11,
    title: "OAuth (after auth Phase C)",
    steps: ["Google sign-in for existing + new user"],
    pending: true,
  },
];

async function testLoginPage(base) {
  const res = await fetch(`${base}/login`, { redirect: "manual" });
  const text = await res.text();
  const shellOk =
    res.status === 200 &&
    (/The Train Station/i.test(text) ||
      text.includes("/login") ||
      text.includes("BAILOUT_TO_CLIENT_SIDE_RENDERING"));
  if (shellOk) {
    pass(1, "Login page loads", "200 (client-rendered shell)");
  } else if (res.status === 307 || res.status === 302) {
    pass(1, "Login page loads", `redirects when session present (${res.status})`);
  } else {
    fail(1, "Login page loads", `status ${res.status}`);
  }
}

async function testAdminAfterLogin(req) {
  const admin = await req("/admin/day");
  if (admin.res.status === 200) {
    pass(1, "Admin dashboard after login", "/admin/day");
  } else {
    fail(1, "Admin dashboard after login", `status ${admin.res.status}`);
  }
}

async function testCoachChat(req) {
  const threads = await req("/api/chat/threads?role=coach");
  if (!threads.res.ok || !Array.isArray(threads.body?.threads)) {
    fail(2, "Coach chat threads API", threads.body?.error || `status ${threads.res.status}`);
    return;
  }
  pass(2, "Coach chat threads API", `${threads.body.threads.length} threads`);

  const chatPage = await req("/admin/chat");
  if (chatPage.res.status === 200) {
    pass(2, "Coach chat page", "/admin/chat");
  } else {
    fail(2, "Coach chat page", `status ${chatPage.res.status}`);
  }

  if (SKIP_WRITE) {
    skip(2, "Coach chat send/persist", "SKIP_WRITE=1");
    return;
  }

  const thread = threads.body.threads[0];
  if (!thread?.id) {
    skip(2, "Coach chat send/persist", "no threads to test");
    return;
  }

  const reply = await req("/api/chat/reply", {
    method: "POST",
    json: { message: MARKER, threadId: thread.id, role: "coach", sendSms: false },
  });
  if (!reply.res.ok || !reply.body?.message?.id) {
    fail(2, "Coach chat send", reply.body?.error || `status ${reply.res.status}`);
    return;
  }
  pass(2, "Coach chat send", reply.body.message.id);

  await new Promise((r) => setTimeout(r, 1200));

  const messages = await req(
    `/api/chat/messages?threadId=${encodeURIComponent(thread.id)}&role=coach`,
  );
  const found = (messages.body?.messages || []).some((m) => m.body === MARKER);
  if (messages.res.ok && found) {
    pass(2, "Coach chat persists after send", "message in thread");
  } else {
    fail(2, "Coach chat persists after send", `found=${found}`);
  }
}

async function testMemberChat() {
  if (!MEMBER_EMAIL || !MEMBER_PASSWORD) {
    skip(3, "Member chat API", "set MEMBER_EMAIL + MEMBER_PASSWORD to auto-test");
    return;
  }

  let memberCookies = "";
  const memberReq = async (path, opts = {}) => {
    const url = path.startsWith("http") ? path : `${BASE}${path}`;
    const headers = { ...(opts.headers || {}) };
    if (memberCookies) headers.Cookie = memberCookies;
    if (opts.json) {
      headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(opts.json);
    }
    const res = await fetch(url, { ...opts, headers, redirect: "manual" });
    const setCookie = res.headers.getSetCookie?.() || [];
    if (setCookie.length) {
      memberCookies = setCookie.map((c) => c.split(";")[0]).join("; ");
    }
    const text = await res.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    return { res, body, text };
  };

  const login = await memberReq("/api/auth/login", {
    method: "POST",
    json: { email: MEMBER_EMAIL, password: MEMBER_PASSWORD, redirect: "/member" },
  });
  if (!login.res.ok) {
    fail(3, "Member login", login.body?.error || `status ${login.res.status}`);
    return;
  }
  pass(3, "Member login", MEMBER_EMAIL);

  const threads = await memberReq("/api/chat/threads?role=member");
  if (!threads.res.ok || !Array.isArray(threads.body?.threads)) {
    fail(3, "Member chat threads", threads.body?.error || `status ${threads.res.status}`);
    return;
  }
  pass(3, "Member chat threads", `${threads.body.threads.length} threads`);
}

async function testLessonPlanSms(req) {
  const planPage = await req("/admin/day?plan=1");
  if (planPage.res.status === 200) {
    pass(5, "Lesson plan page", "/admin/day?plan=1");
  } else {
    fail(5, "Lesson plan page", `status ${planPage.res.status}`);
  }

  if (SKIP_WRITE) {
    skip(5, "SMS workout draft + persist", "SKIP_WRITE=1");
    return;
  }

  const interpret = await req("/api/today/lesson-plan", {
    method: "POST",
    json: { rawText: PLAN_TEXT, includeWarmup: false },
  });
  if (!interpret.res.ok || !interpret.body?.workout?.exercises?.length) {
    fail(5, "Interpret lesson plan", interpret.body?.error || `status ${interpret.res.status}`);
    return;
  }
  pass(5, "Interpret lesson plan", `${interpret.body.workout.exercises.length} blocks`);

  const draft = await req("/api/today/lesson-plan/draft", {
    method: "POST",
    json: { rawText: PLAN_TEXT, includeWarmup: false },
  });
  if (!draft.res.ok || !draft.body?.workoutId?.startsWith("sms-w-")) {
    fail(5, "Draft SMS workout", draft.body?.error || JSON.stringify(draft.body));
    return;
  }
  const workoutId = draft.body.workoutId;
  pass(5, "Draft SMS workout", workoutId);

  await new Promise((r) => setTimeout(r, 1500));
  const loaded = await req(bust(`/api/workouts/${workoutId}`));
  if (loaded.res.ok && (loaded.body?.exercises?.length ?? 0) >= 1) {
    pass(5, "SMS workout persists in Postgres", `${loaded.body.exercises.length} exercises`);
  } else {
    fail(5, "SMS workout persists in Postgres", `status ${loaded.res.status}`);
  }

  const del = await req(`/api/workouts/${workoutId}`, { method: "DELETE" });
  if (del.res.status === 204 || del.res.ok) {
    pass(5, "Cleanup test SMS workout", workoutId);
  } else {
    fail(5, "Cleanup test SMS workout", `status ${del.res.status} — run cleanup:migration-test-data`);
  }
}

async function testGoToToday(req) {
  const todayPage = await req("/admin/today");
  if (todayPage.res.status === 200) {
    pass(6, "Go to Today page", "/admin/today");
  } else {
    fail(6, "Go to Today page", `status ${todayPage.res.status}`);
  }

  const todayKey = new Date().toISOString().slice(0, 10);
  const floor = await req(`/api/admin/live-floor?date=${todayKey}`);
  if (floor.res.ok && typeof floor.body?.assignedCount === "number") {
    pass(6, "Live floor API", `${floor.body.assignedCount} tile(s) on ${floor.body.sessionDate || todayKey}`);
  } else {
    fail(6, "Live floor API", floor.body?.error || `status ${floor.res.status}`);
  }

  const sessions = await req("/api/today?all=1");
  if (sessions.res.ok && Array.isArray(sessions.body?.sessions)) {
    pass(6, "Today sessions API", `${sessions.body.sessions.length} sessions`);
  } else {
    fail(6, "Today sessions API", sessions.body?.error || `status ${sessions.res.status}`);
  }
}

async function testMembers(req) {
  const members = await req("/api/admin/members");
  if (!members.res.ok || !Array.isArray(members.body?.members)) {
    fail(7, "Admin members API", members.body?.error || `status ${members.res.status}`);
    return;
  }
  const list = members.body.members;
  pass(7, "Admin members API", `${list.length} members`);

  const membersPage = await req("/admin/members");
  if (membersPage.res.status === 200) {
    pass(7, "Admin members page", "/admin/members");
  } else {
    fail(7, "Admin members page", `status ${membersPage.res.status}`);
  }

  if (list.length > 0) {
    const row = list[0];
    const hasProfile = "displayName" in row || "name" in row || "email" in row;
    if (hasProfile) pass(7, "Member profile fields", row.email || row.userId);
    else fail(7, "Member profile fields", "missing name/email on roster row");
  }
}

async function testLiveSession(req) {
  const todayKey = new Date().toISOString().slice(0, 10);
  const sessions = await req("/api/today?all=1");
  const session = (sessions.body?.sessions || []).find((s) => s.workoutId);
  if (!session?.workoutId) {
    skip(12, "Live session round-trip", "no today session with workoutId");
    return;
  }

  const userId = session.userId || session.userIds?.[0];
  if (!userId) {
    skip(12, "Live session round-trip", "no userId on today session");
    return;
  }

  if (SKIP_WRITE) {
    skip(12, "Live session round-trip", "SKIP_WRITE=1");
    return;
  }

  const put = await req(`/api/workouts/${session.workoutId}/live-session`, {
    method: "PUT",
    json: {
      userId,
      sessionDate: todayKey,
      completedSets: { block1: [1] },
      finishedExercises: [],
      weights: {},
      updatedBy: "coach",
    },
  });
  if (!put.res.ok) {
    fail(12, "Live session write", put.body?.error || `status ${put.res.status}`);
    return;
  }
  pass(12, "Live session write", session.workoutId);

  const get = await req(
    `/api/workouts/${session.workoutId}/live-session?userId=${encodeURIComponent(userId)}&date=${todayKey}`,
  );
  if (get.res.ok && get.body?.session?.completedSets) {
    pass(12, "Live session read-back", "completedSets present");
  } else {
    fail(12, "Live session read-back", JSON.stringify(get.body)?.slice(0, 120));
  }

  await req(`/api/workouts/${session.workoutId}/live-session`, {
    method: "PUT",
    json: { userId, sessionDate: todayKey, updatedBy: "coach", clear: true },
  });
}

async function testCoachSettings(req) {
  const get = await req("/api/admin/coach-settings");
  if (!get.res.ok || !get.body?.settings) {
    fail(13, "Coach settings GET", get.body?.error || `status ${get.res.status}`);
    return;
  }
  pass(13, "Coach settings GET", `messaging=${get.body.settings.messagingEnabled}`);

  if (SKIP_WRITE) {
    skip(13, "Coach settings PATCH round-trip", "SKIP_WRITE=1");
    return;
  }

  const prev = get.body.settings.messagingEnabled;
  const patch = await req("/api/admin/coach-settings", {
    method: "PATCH",
    json: { messagingEnabled: !prev },
  });
  if (!patch.res.ok) {
    fail(13, "Coach settings PATCH", patch.body?.error || `status ${patch.res.status}`);
    return;
  }

  const reload = await req("/api/admin/coach-settings");
  if (reload.body?.settings?.messagingEnabled === !prev) {
    pass(13, "Coach settings PATCH round-trip", `${prev} → ${!prev}`);
  } else {
    fail(13, "Coach settings PATCH round-trip", `got ${reload.body?.settings?.messagingEnabled}`);
  }

  await req("/api/admin/coach-settings", {
    method: "PATCH",
    json: { messagingEnabled: prev },
  });
}

async function testMemberCoachPrefs(req) {
  const members = await req("/api/admin/members");
  const testMember = (members.body?.members || [])[0];
  if (!testMember?.userId) {
    skip(14, "Member coach prefs", "no members");
    return;
  }

  const get = await req(
    `/api/admin/members/${encodeURIComponent(testMember.userId)}/coach-prefs`,
  );
  if (!get.res.ok) {
    fail(14, "Member coach prefs GET", get.body?.error || `status ${get.res.status}`);
    return;
  }
  pass(14, "Member coach prefs GET", testMember.email || testMember.userId);

  if (SKIP_WRITE) {
    skip(14, "Member coach prefs PATCH", "SKIP_WRITE=1");
    return;
  }

  const currentMode = testMember.coachingMode || get.body?.coachingMode || "async";
  const flip = currentMode === "live" ? "async" : "live";
  const patch = await req(
    `/api/admin/members/${encodeURIComponent(testMember.userId)}/coach-prefs`,
    { method: "PATCH", json: { coachingMode: flip } },
  );
  if (!patch.res.ok) {
    fail(14, "Member coach prefs PATCH", patch.body?.error || `status ${patch.res.status}`);
    return;
  }
  pass(14, "Member coach prefs PATCH", `${currentMode} → ${flip}`);

  await req(
    `/api/admin/members/${encodeURIComponent(testMember.userId)}/coach-prefs`,
    { method: "PATCH", json: { coachingMode: currentMode } },
  );
}

async function testCommerce(req) {
  const commission = await req("/api/admin/commission");
  if (commission.res.ok) {
    const partners = commission.body?.partners?.length ?? 0;
    const payouts = commission.body?.payouts?.length ?? 0;
    pass(15, "Admin commission API", `partners=${partners} payouts=${payouts}`);
  } else {
    fail(15, "Admin commission API", commission.body?.error || `status ${commission.res.status}`);
  }

  const referrals = await req("/api/admin/referral-codes");
  if (referrals.res.ok && Array.isArray(referrals.body?.codes)) {
    pass(16, "Admin referral-codes API", `${referrals.body.codes.length} codes`);
  } else {
    fail(16, "Admin referral-codes API", referrals.body?.error || `status ${referrals.res.status}`);
  }

  const leads = await req("/api/leads/count");
  if (leads.res.ok && typeof leads.body?.total === "number") {
    pass(17, "Leads / waitlist API", `total=${leads.body.total}`);
  } else {
    fail(17, "Leads / waitlist API", leads.body?.error || `status ${leads.res.status}`);
  }

  const offers = await req("/api/admin/custom-training");
  if (offers.res.ok && Array.isArray(offers.body?.offers)) {
    pass(18, "Custom training offers API", `${offers.body.offers.length} offers`);
  } else {
    fail(18, "Custom training offers API", offers.body?.error || `status ${offers.res.status}`);
  }
}

async function testMigrationStatus(req) {
  const persistence = await req("/api/admin/demo-persistence");
  if (
    persistence.res.ok &&
    persistence.body?.databaseConfigured === true &&
    Array.isArray(persistence.body?.migration)
  ) {
    pass("—", "Postgres migration status", `${persistence.body.migration.length} stores, dbBacked=${persistence.body.dbBackedStoreCount ?? "?"}`);
  } else {
    fail("—", "Postgres migration status", JSON.stringify(persistence.body)?.slice(0, 160));
  }
}

function printManualChecklist() {
  console.log("\n══════════════════════════════════════════════════════════");
  console.log("MANUAL BROWSER CHECKLIST (JEREMY_MIGRATION_TEST.md)");
  console.log("══════════════════════════════════════════════════════════\n");

  for (const block of MANUAL_STEPS) {
    const label = block.pending ? `${block.title} — NOT YET (we'll ping you)` : block.title;
    console.log(`${tag(block.item)} ${label}`);
    for (const step of block.steps) {
      console.log(`    • ${step}`);
    }
    console.log();
  }

  console.log("Watch for:");
  console.log("  • Vercel logs: [migration-parity-mismatch] on auth/profiles dual-write");
  console.log("  • Orphan profiles (safe to ignore): member-8eeff995-292, member-19ed60cf-b04");
  console.log();
}

async function main() {
  console.log(`\nJeremy migration QA\n  BASE: ${BASE}\n  MARKER: ${MARKER}\n  SKIP_WRITE: ${SKIP_WRITE}\n`);

  await testLoginPage(BASE);

  const { req, loginCoach } = createCoachClient(BASE);
  if (!(await loginCoach({ onPass: (n, d) => pass(1, n, d), onFail: (n, d) => fail(1, n, d) }))) {
    console.error("\nCoach login failed — set COACH_PASSWORD if prod requires it.\n");
    process.exit(1);
  }

  await testAdminAfterLogin(req);
  await testCoachChat(req);
  await testMemberChat();
  await testLessonPlanSms(req);
  await testGoToToday(req);
  await testMembers(req);
  await testLiveSession(req);
  await testCoachSettings(req);
  await testMemberCoachPrefs(req);
  await testCommerce(req);
  await testMigrationStatus(req);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n--- ${results.length - failed.length}/${results.length} automated checks passed ---`);
  if (failed.length) {
    console.log("\nFailures:");
    for (const f of failed) {
      console.log(`  ${tag(f.item)} ${f.name}: ${f.detail}`);
    }
  }

  printManualChecklist();

  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});