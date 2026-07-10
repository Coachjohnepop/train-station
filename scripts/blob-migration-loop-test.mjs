#!/usr/bin/env node
/**
 * Blob migration loop test — probes + round-trip writes for PR-2 through PR-9 stores.
 *
 * Usage:
 *   npm run test:blob-migration-loop
 *   BASE_URL=https://www.thetrainstation.co npm run test:blob-migration-loop
 */

import dotenv from "dotenv";

function loadEnv() {
  dotenv.config({ path: ".env" });
  dotenv.config({ path: ".env.vercel.prod", override: true });
  dotenv.config({ path: ".env.vercel.production", override: true });
}

const BASE = (process.env.BASE_URL || "https://www.thetrainstation.co").replace(/\/$/, "");
const COACH_EMAIL = process.env.COACH_EMAIL || "jeremy@thetrainstation.co";
const COACH_PASSWORD =
  process.env.COACH_PASSWORD || process.env.COACH_TEST_PASSWORD || "CoachTest123!";

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

async function req(path, opts = {}) {
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const headers = { ...(opts.headers || {}) };
  if (cookies) headers.Cookie = cookies;
  if (opts.json) {
    headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(opts.json);
  }
  const res = await fetch(url, { ...opts, headers, redirect: "manual" });
  const setCookie = parseSetCookie(res.headers);
  if (setCookie) cookies = setCookie;
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { res, body, text };
}

async function coachLogin() {
  const login = await req("/api/auth/login", {
    method: "POST",
    json: { email: COACH_EMAIL, password: COACH_PASSWORD, redirect: "/admin" },
  });
  if (!login.res.ok || !cookies.includes("ts_session")) {
    fail("Coach login", login.body?.error || `status ${login.res.status}`);
    return false;
  }
  pass("Coach login", COACH_EMAIL);
  return true;
}

async function createPrismaClient() {
  const { resolveDatabaseUrl } = await import("../src/lib/database-config.ts");
  const { createPgPool } = await import("../src/lib/pg-connection.ts");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { PrismaClient } = await import("../src/generated/prisma/client");
  const connectionString = resolveDatabaseUrl();
  if (!connectionString) throw new Error("No Postgres URL");
  const adapter = new PrismaPg(createPgPool(connectionString));
  return new PrismaClient({ adapter });
}

async function testDbLayer() {
  loadEnv();
  const { isDatabaseConfigured } = await import("../src/lib/database-config.ts");
  if (!isDatabaseConfigured()) {
    fail("Database configured", "missing — skipping DB probes");
    return null;
  }
  pass("Database configured");

  let prisma;
  try {
    prisma = await createPrismaClient();
  } catch (e) {
    fail("Prisma client", e instanceof Error ? e.message : String(e));
    return null;
  }

  const probes = [
    ["coach-chat-threads", () => prisma.coachChatThread.count()],
    ["coach-chat-messages", () => prisma.coachChatMessage.count()],
    ["live-sessions", () => prisma.liveWorkoutSession.count()],
    ["coach-settings", () => prisma.coachSettings.count()],
    ["member-coach-prefs", () => prisma.memberCoachPrefs.count()],
    ["commission-partners", () => prisma.commissionPartner.count()],
    ["commission-ledger", () => prisma.commissionPayout.count()],
    ["referral-codes", () => prisma.referralCode.count()],
    ["stripe-webhooks", () => prisma.stripeWebhookEvent.count()],
    ["waitlist", () => prisma.waitlistEntry.count()],
    ["custom-offers", () => prisma.customTrainingOffer.count()],
    ["users", () => prisma.user.count()],
    ["member-profiles", () => prisma.memberProfile.count()],
    ["sms-workouts", () => prisma.workout.count({ where: { source: "sms" } })],
  ];

  for (const [name, run] of probes) {
    try {
      const count = await run();
      pass(`DB count: ${name}`, String(count));
    } catch (e) {
      fail(`DB count: ${name}`, e instanceof Error ? e.message : String(e));
    }
  }

  const marker = `migration-loop-${Date.now()}`;

  try {
    const eventId = `evt_loop_${marker}`;
    await prisma.stripeWebhookEvent.create({
      data: { eventId, type: "test.loop", processedAt: new Date() },
    });
    let replay = false;
    try {
      await prisma.stripeWebhookEvent.create({
        data: { eventId, type: "test.loop", processedAt: new Date() },
      });
    } catch (error) {
      if (error && typeof error === "object" && error.code === "P2002") replay = true;
      else throw error;
    }
    if (replay) pass("Webhook idempotent claim (P2002 on replay)");
    else fail("Webhook idempotent claim", "duplicate create succeeded");
    await prisma.stripeWebhookEvent.delete({ where: { eventId } });
  } catch (e) {
    fail("Webhook idempotent claim", e instanceof Error ? e.message : String(e));
  }

  try {
    const sessionKey = {
      userId: "migration-loop-user",
      workoutId: "migration-loop-workout",
      sessionDate: "2099-01-01",
    };
    await prisma.liveWorkoutSession.upsert({
      where: { userId_workoutId_sessionDate: sessionKey },
      create: {
        ...sessionKey,
        completedSets: { block1: [1] },
        finishedExercises: ["ex-1"],
        weights: { "ex-1": "135" },
        updatedBy: "coach",
        revision: 1,
      },
      update: {
        completedSets: { block1: [1] },
        weights: { "ex-1": "135" },
        revision: 1,
      },
    });
    const read = await prisma.liveWorkoutSession.findUnique({
      where: { userId_workoutId_sessionDate: sessionKey },
    });
    if (read?.revision === 1) pass("Live session round-trip");
    else fail("Live session round-trip", JSON.stringify(read));
    await prisma.liveWorkoutSession.delete({ where: { userId_workoutId_sessionDate: sessionKey } });
  } catch (e) {
    fail("Live session round-trip", e instanceof Error ? e.message : String(e));
  }

  try {
    const row = await prisma.coachSettings.findUnique({ where: { id: "default" } });
    if (!row) {
      fail("Coach settings round-trip", "no default row");
    } else {
      const prev = row.messagingEnabled;
      await prisma.coachSettings.update({
        where: { id: "default" },
        data: { messagingEnabled: !prev },
      });
      const reloaded = await prisma.coachSettings.findUnique({ where: { id: "default" } });
      if (reloaded?.messagingEnabled === !prev) pass("Coach settings round-trip");
      else fail("Coach settings round-trip", `expected ${!prev}`);
      await prisma.coachSettings.update({
        where: { id: "default" },
        data: { messagingEnabled: prev },
      });
    }
  } catch (e) {
    fail("Coach settings round-trip", e instanceof Error ? e.message : String(e));
  }

  return prisma;
}

async function testProdApis() {
  if (!(await coachLogin())) return;

  const chat = await req("/api/chat/threads?role=coach");
  if (chat.res.ok && Array.isArray(chat.body?.threads)) {
    pass("Coach chat threads API", `${chat.body.threads.length} threads`);
  } else {
    fail("Coach chat threads API", chat.body?.error || `status ${chat.res.status}`);
  }

  const members = await req("/api/admin/members");
  if (members.res.ok && Array.isArray(members.body?.members)) {
    pass("Admin members API", `${members.body.members.length} members`);
  } else {
    fail("Admin members API", members.body?.error || `status ${members.res.status}`);
  }

  const leads = await req("/api/leads/count");
  if (leads.res.ok && typeof leads.body?.total === "number") {
    pass("Leads count API (waitlist+signups)", `total=${leads.body.total}`);
  } else {
    fail("Leads count API", leads.body?.error || `status ${leads.res.status}`);
  }

  const commission = await req("/api/admin/commission");
  if (commission.res.ok) {
    const partners = commission.body?.partners?.length ?? 0;
    const payouts = commission.body?.payouts?.length ?? 0;
    pass("Admin commission API", `partners=${partners} payouts=${payouts}`);
  } else {
    fail("Admin commission API", commission.body?.error || `status ${commission.res.status}`);
  }

  const referrals = await req("/api/admin/referral-codes");
  if (referrals.res.ok && Array.isArray(referrals.body?.codes)) {
    pass("Admin referral-codes API", `${referrals.body.codes.length} codes`);
  } else {
    fail("Admin referral-codes API", referrals.body?.error || `status ${referrals.res.status}`);
  }

  const settings = await req("/api/admin/coach-settings");
  if (settings.res.ok && settings.body?.settings) {
    pass("Admin coach-settings API", `messaging=${settings.body.settings.messagingEnabled}`);
  } else {
    fail("Admin coach-settings API", settings.body?.error || `status ${settings.res.status}`);
  }

  const today = await req("/api/today?all=1");
  if (today.res.ok && Array.isArray(today.body?.sessions)) {
    pass("Today sessions API", `${today.body.sessions.length} sessions`);
  } else {
    fail("Today sessions API", today.body?.error || `status ${today.res.status}`);
  }

  const customOffers = await req("/api/admin/custom-training");
  if (customOffers.res.ok && Array.isArray(customOffers.body?.offers)) {
    pass("Admin custom-training API", `${customOffers.body.offers.length} offers`);
  } else {
    fail("Admin custom-training API", customOffers.body?.error || `status ${customOffers.res.status}`);
  }

  const persistence = await req("/api/admin/demo-persistence");
  if (
    persistence.res.ok &&
    persistence.body?.databaseConfigured === true &&
    Array.isArray(persistence.body?.migration)
  ) {
    pass(
      "Demo-persistence migration status",
      `${persistence.body.migration.length} stores, dbBacked=${persistence.body.dbBackedStoreCount ?? "?"}`,
    );
  } else {
    fail("Demo-persistence migration status", JSON.stringify(persistence.body));
  }
}

async function main() {
  loadEnv();
  const { isDatabaseConfigured, resolveDatabaseUrl } = await import("../src/lib/database-config.ts");
  const dbConfigured = isDatabaseConfigured();
  console.log(
    `\nBlob migration loop test\n  DB: ${dbConfigured ? "configured" : "not configured"}\n  API: ${BASE}\n`,
  );
  if (!dbConfigured && resolveDatabaseUrl()) {
    console.log("  (resolveDatabaseUrl returned a URL but isDatabaseConfigured=false — check dummy/localhost)\n");
  }

  const prisma = await testDbLayer();
  if (prisma) await prisma.$disconnect();
  await testProdApis();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n--- ${results.length - failed.length}/${results.length} passed ---\n`);
  if (failed.length > 0) {
    console.error("Failures:", failed.map((f) => f.name).join(", "));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});