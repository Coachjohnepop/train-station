#!/usr/bin/env node
/**
 * Production cleanup — strip Stripe/E2E/QA noise + orphan workout clones.
 *
 * Keeps:
 *  - Real members (Jeremy, John, Chad, Gator, Jayden, Katie, Steph, etc.)
 *  - demo@thetrainstation.co (handy coach demo member)
 *  - All calendar-linked workouts / cycles
 *  - Up to KEEP_ORPHANS_PER_NAME orphan workouts per title (samples)
 *  - Up to KEEP_TEMPLATES_PER_NAME templates per name (samples)
 *  - Real waitlist leads
 *
 * Removes:
 *  - payments-e2e / stripe-e2e / qa-auth / example.com / mailinator test users
 *  - Their enrollments, logs, waitlist, custom offers (via cascade + explicit)
 *  - Stripe webhook event log (test-mode events)
 *  - MARSHMALLOW / soak workouts, exercises, templates
 *  - Excess orphan workout clones (> KEEP_ORPHANS_PER_NAME per name)
 *  - Excess duplicate library templates
 *  - Smoke chat markers
 *
 * Usage:
 *   DRY_RUN=1 npx tsx scripts/cleanup-prod-test-noise.mjs
 *   npx tsx scripts/cleanup-prod-test-noise.mjs
 */

import dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { createPgPool } from "../src/lib/pg-connection.ts";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env.vercel.production", override: true });
dotenv.config({ path: ".env.vercel.prod", override: true });

const DRY_RUN = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";
const KEEP_ORPHANS_PER_NAME = Number(process.env.KEEP_ORPHANS_PER_NAME || 2);
const KEEP_TEMPLATES_PER_NAME = Number(process.env.KEEP_TEMPLATES_PER_NAME || 2);

/** Never purge these emails even if they look synthetic. */
const ALWAYS_KEEP_EMAILS = new Set([
  "jeremy@thetrainstation.co",
  "john@thetrainstation.co",
  "demo@thetrainstation.co",
  "chad@thetrainstation.co",
  "kaite@thetrainstation.co",
  "coachbyrd84@aol.com",
  "jaymoody170@gmail.com",
  "jeremy_blackburn@icloud.com",
  "john@lemonvoice.com",
  "johnsteph@thetrainstation.co",
  "sprealty9@gmail.com",
]);

function resolveDatabaseUrl() {
  const url =
    process.env.POSTGRES_PRISMA_URL ??
    process.env.POSTGRES_URL ??
    process.env.DATABASE_URL ??
    "";
  if (!url || url.includes("dummy")) {
    throw new Error("Need real Postgres URL (.env.vercel.prod / .env.vercel.production)");
  }
  return url;
}

function isTestUserEmail(email) {
  const e = (email || "").toLowerCase().trim();
  if (!e) return false;
  if (ALWAYS_KEEP_EMAILS.has(e)) return false;
  if (e.startsWith("payments-e2e")) return true;
  if (e.startsWith("stripe-e2e")) return true;
  if (e.startsWith("e2e-")) return true;
  if (e.startsWith("qa-auth-")) return true;
  if (e.endsWith("@example.com")) return true;
  if (e.endsWith("@mailinator.com")) return true;
  if (e === "jordan.member@example.com") return true;
  if (e === "casey.prospective@example.com") return true;
  if (/^payments-e2e\+/i.test(e)) return true;
  return false;
}

function isSoakName(name) {
  return /marshmallow|badger|jerdog|testingsilly|prodtest|clone-party|laser-chicken|confetti-goose|builder-soak|tripledays|db-mode-smoke/i.test(
    name || "",
  );
}

function workoutRefCount(w) {
  const c = w._count;
  return (
    c.dayOptions +
    c.programDays +
    c.cycleSlots +
    c.logs +
    (w.templateMeta ? 1 : 0)
  );
}

async function deleteWorkouts(prisma, ids, label) {
  if (!ids.length) {
    console.log(`  ${label}: nothing`);
    return 0;
  }
  console.log(`  ${label}: ${ids.length} workout(s)`);
  if (DRY_RUN) {
    return ids.length;
  }
  await prisma.programDayOption.deleteMany({ where: { workoutId: { in: ids } } });
  await prisma.programDay.updateMany({
    where: { workoutId: { in: ids } },
    data: { workoutId: null },
  });
  await prisma.workoutCycleDaySlot.deleteMany({ where: { workoutId: { in: ids } } });
  await prisma.workoutTemplate.deleteMany({ where: { workoutId: { in: ids } } });
  await prisma.workoutLog.deleteMany({ where: { workoutId: { in: ids } } });
  await prisma.workoutExercise.deleteMany({ where: { workoutId: { in: ids } } });
  const del = await prisma.workout.deleteMany({ where: { id: { in: ids } } });
  return del.count;
}

async function main() {
  const pool = createPgPool(resolveDatabaseUrl());
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const summary = {
    users: 0,
    waitlist: 0,
    webhooks: 0,
    offers: 0,
    workouts: 0,
    templates: 0,
    exercises: 0,
    chatMsgs: 0,
  };

  console.log(`\n══ Prod test-noise cleanup${DRY_RUN ? " (DRY RUN)" : ""} ══\n`);

  // ── 1. Test users ──────────────────────────────────────────────
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true },
  });
  const purgeUsers = users.filter((u) => isTestUserEmail(u.email));
  console.log(`Users total=${users.length} purge=${purgeUsers.length}`);
  for (const u of purgeUsers) {
    console.log(`  DEL user ${u.email} (${u.name || "—"}) ${u.role}`);
  }
  if (!DRY_RUN && purgeUsers.length) {
    const ids = purgeUsers.map((u) => u.id);
    // Clear non-cascade / optional refs first
    await prisma.factSubscriptionPayment.updateMany({
      where: { userId: { in: ids } },
      data: { userId: null },
    });
    await prisma.analyticsEvent.updateMany({
      where: { userId: { in: ids } },
      data: { userId: null },
    });
    await prisma.analyticsSession.updateMany({
      where: { userId: { in: ids } },
      data: { userId: null },
    });
    // Coach chat member threads
    const memberThreads = await prisma.coachChatThread.findMany({
      where: { memberId: { in: ids } },
      select: { id: true },
    });
    if (memberThreads.length) {
      const tids = memberThreads.map((t) => t.id);
      await prisma.coachChatMessage.deleteMany({ where: { threadId: { in: tids } } });
      await prisma.coachChatThread.deleteMany({ where: { id: { in: tids } } });
    }
    await prisma.customTrainingOffer.deleteMany({
      where: {
        OR: [
          { memberUserId: { in: ids } },
          { memberEmail: { in: purgeUsers.map((u) => u.email) } },
        ],
      },
    });
    const del = await prisma.user.deleteMany({ where: { id: { in: ids } } });
    summary.users = del.count;
  } else {
    summary.users = purgeUsers.length;
  }

  // ── 2. Waitlist test rows ──────────────────────────────────────
  const waitlist = await prisma.waitlistEntry.findMany();
  const purgeWait = waitlist.filter((e) => isTestUserEmail(e.email));
  console.log(`\nWaitlist total=${waitlist.length} purge=${purgeWait.length}`);
  for (const e of purgeWait) console.log(`  DEL waitlist ${e.email}`);
  if (!DRY_RUN && purgeWait.length) {
    const del = await prisma.waitlistEntry.deleteMany({
      where: { id: { in: purgeWait.map((e) => e.id) } },
    });
    summary.waitlist = del.count;
  } else {
    summary.waitlist = purgeWait.length;
  }

  // ── 3. Stripe webhook log (all test-mode history) ──────────────
  const whCount = await prisma.stripeWebhookEvent.count();
  console.log(`\nStripe webhooks: ${whCount} (clear all — test-mode noise)`);
  if (!DRY_RUN && whCount) {
    const del = await prisma.stripeWebhookEvent.deleteMany({});
    summary.webhooks = del.count;
  } else {
    summary.webhooks = whCount;
  }

  // ── 4. Custom training offers for test emails ──────────────────
  const offers = await prisma.customTrainingOffer.findMany();
  const purgeOffers = offers.filter(
    (o) => isTestUserEmail(o.memberEmail) || isSoakName(o.label),
  );
  console.log(`\nCustom offers total=${offers.length} purge=${purgeOffers.length}`);
  if (!DRY_RUN && purgeOffers.length) {
    const del = await prisma.customTrainingOffer.deleteMany({
      where: { id: { in: purgeOffers.map((o) => o.id) } },
    });
    summary.offers = del.count;
  } else {
    summary.offers = purgeOffers.length;
  }

  // ── 5. Smoke chat messages ─────────────────────────────────────
  const smokeMsgs = await prisma.coachChatMessage.findMany({
    where: {
      OR: [
        { body: { contains: "db-mode-smoke", mode: "insensitive" } },
        { body: { contains: "prodtest", mode: "insensitive" } },
        { body: { contains: "MARSHMALLOW-BADGER", mode: "insensitive" } },
      ],
    },
    select: { id: true, body: true },
  });
  console.log(`\nSmoke chat msgs: ${smokeMsgs.length}`);
  for (const m of smokeMsgs) console.log(`  DEL chat ${(m.body || "").slice(0, 60)}`);
  if (!DRY_RUN && smokeMsgs.length) {
    const del = await prisma.coachChatMessage.deleteMany({
      where: { id: { in: smokeMsgs.map((m) => m.id) } },
    });
    summary.chatMsgs = del.count;
  } else {
    summary.chatMsgs = smokeMsgs.length;
  }

  // ── 6. Soak exercises ──────────────────────────────────────────
  const exercises = await prisma.exercise.findMany({
    select: { id: true, name: true, tags: true },
  });
  const soakExercises = exercises.filter(
    (e) => isSoakName(e.name) || isSoakName(e.tags),
  );
  console.log(`\nSoak exercises: ${soakExercises.length}`);
  for (const e of soakExercises) console.log(`  DEL exercise ${e.name}`);
  if (!DRY_RUN && soakExercises.length) {
    const eids = soakExercises.map((e) => e.id);
    // Detach from workouts first
    await prisma.workoutExercise.deleteMany({ where: { exerciseId: { in: eids } } });
    await prisma.exercisePerformance.deleteMany({ where: { exerciseId: { in: eids } } });
    const del = await prisma.exercise.deleteMany({ where: { id: { in: eids } } });
    summary.exercises = del.count;
  } else {
    summary.exercises = soakExercises.length;
  }

  // ── 7. Templates — soak + excess duplicates ────────────────────
  const templates = await prisma.workoutTemplate.findMany({
    select: { id: true, name: true, workoutId: true, createdAt: true, archivedAt: true },
    orderBy: { createdAt: "desc" },
  });
  const tplByName = new Map();
  const tplDeleteIds = [];
  for (const t of templates) {
    if (isSoakName(t.name)) {
      tplDeleteIds.push(t.id);
      continue;
    }
    const key = (t.name || "").trim() || "(blank)";
    if (!tplByName.has(key)) tplByName.set(key, []);
    tplByName.get(key).push(t);
  }
  for (const [name, list] of tplByName) {
    // newest first already
    if (list.length > KEEP_TEMPLATES_PER_NAME) {
      const excess = list.slice(KEEP_TEMPLATES_PER_NAME);
      console.log(
        `  templates "${name.slice(0, 50)}": keep ${KEEP_TEMPLATES_PER_NAME}, drop ${excess.length}`,
      );
      for (const t of excess) tplDeleteIds.push(t.id);
    }
  }
  console.log(`\nTemplates purge: ${tplDeleteIds.length} of ${templates.length}`);
  if (!DRY_RUN && tplDeleteIds.length) {
    const del = await prisma.workoutTemplate.deleteMany({
      where: { id: { in: tplDeleteIds } },
    });
    summary.templates = del.count;
  } else {
    summary.templates = tplDeleteIds.length;
  }

  // ── 8. Workouts — soak + excess orphans ────────────────────────
  const workouts = await prisma.workout.findMany({
    select: {
      id: true,
      name: true,
      createdAt: true,
      certifiedAt: true,
      templateMeta: { select: { id: true } },
      _count: {
        select: {
          exercises: true,
          dayOptions: true,
          programDays: true,
          cycleSlots: true,
          logs: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const workoutDeleteIds = new Set();
  const orphansByName = new Map();

  for (const w of workouts) {
    const refs = workoutRefCount(w);
    if (isSoakName(w.name)) {
      // Soak: delete even if template-linked (we already deleted soak templates)
      workoutDeleteIds.add(w.id);
      continue;
    }
    if (refs > 0) continue; // calendar / logs / remaining template — keep
    if (w.certifiedAt) continue; // certified catalog — keep
    const key = (w.name || "").trim() || "(blank)";
    if (!orphansByName.has(key)) orphansByName.set(key, []);
    orphansByName.get(key).push(w);
  }

  let orphanKeep = 0;
  let orphanDrop = 0;
  for (const [name, list] of orphansByName) {
    // Prefer more exercises, then newer
    list.sort((a, b) => {
      const ex = b._count.exercises - a._count.exercises;
      if (ex !== 0) return ex;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
    const keep = list.slice(0, KEEP_ORPHANS_PER_NAME);
    const drop = list.slice(KEEP_ORPHANS_PER_NAME);
    orphanKeep += keep.length;
    orphanDrop += drop.length;
    if (drop.length) {
      console.log(
        `  orphans "${name.slice(0, 50)}": keep ${keep.length}, drop ${drop.length}`,
      );
    }
    for (const w of drop) workoutDeleteIds.add(w.id);
  }

  // Empty shells with zero exercises and zero refs (belt + suspenders)
  for (const w of workouts) {
    if (workoutDeleteIds.has(w.id)) continue;
    if (w._count.exercises === 0 && workoutRefCount(w) === 0) {
      workoutDeleteIds.add(w.id);
    }
  }

  console.log(
    `\nWorkouts: total=${workouts.length} delete=${workoutDeleteIds.size} (orphan keep samples=${orphanKeep}, orphan drop=${orphanDrop})`,
  );
  summary.workouts = await deleteWorkouts(
    prisma,
    [...workoutDeleteIds],
    DRY_RUN ? "would delete" : "deleted",
  );

  // ── 9. Optional: clear fact payments with no real user left ────
  // (table was empty in inventory — skip if still empty)
  const payCount = await prisma.factSubscriptionPayment.count();
  if (payCount) {
    console.log(`\nFactSubscriptionPayment rows still present: ${payCount} (left intact)`);
  }

  console.log("\n══ SUMMARY ══");
  console.log(summary);
  console.log(DRY_RUN ? "\nDRY_RUN — no changes written.\n" : "\nDone.\n");

  // Post counts
  const after = {
    users: await prisma.user.count(),
    workouts: await prisma.workout.count(),
    templates: await prisma.workoutTemplate.count(),
    exercises: await prisma.exercise.count(),
    waitlist: await prisma.waitlistEntry.count(),
    webhooks: await prisma.stripeWebhookEvent.count(),
  };
  console.log("After counts:", after);

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
