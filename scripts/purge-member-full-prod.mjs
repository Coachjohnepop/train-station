#!/usr/bin/env node
/**
 * Full prod purge of one member (Postgres + blob) so they can sign up from scratch.
 *
 * Usage:
 *   node scripts/purge-member-full-prod.mjs coachbyrd84@aol.com
 *   DRY_RUN=1 node scripts/purge-member-full-prod.mjs coachbyrd84@aol.com
 */
import dotenv from "dotenv";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const Module = require("module");
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, parent, isMain);
};

dotenv.config({ path: ".env.vercel.fresh" });
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.go-prod" });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { createPgPool } from "../src/lib/pg-connection.ts";
import { fullyResetMemberByEmail } from "./reset-member-full-prod.mjs";

const DRY_RUN = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";
const emailArg = process.argv[2]?.trim().toLowerCase();

if (!emailArg) {
  console.error("Usage: node scripts/purge-member-full-prod.mjs <email>");
  process.exit(1);
}

async function cancelStripeSubs(stripeCustomerId, stripeSubId) {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    console.log("  (no STRIPE_SECRET_KEY — skip Stripe cancel)");
    return;
  }
  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(key, { apiVersion: "2025-02-24.acacia" });

  const subIds = new Set();
  if (stripeSubId) subIds.add(stripeSubId);
  if (stripeCustomerId) {
    const list = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: "all",
      limit: 20,
    });
    for (const s of list.data) {
      if (s.status === "active" || s.status === "trialing" || s.status === "past_due") {
        subIds.add(s.id);
      }
    }
  }
  for (const id of subIds) {
    if (DRY_RUN) {
      console.log(`  DRY_RUN cancel sub ${id}`);
      continue;
    }
    try {
      await stripe.subscriptions.cancel(id);
      console.log(`  ✓ Stripe subscription canceled: ${id}`);
    } catch (e) {
      console.warn(`  ⚠ cancel ${id}:`, e.message || e);
    }
  }
}

async function purgePostgres(email) {
  const pool = createPgPool(
    process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL,
  );
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      memberProfile: {
        select: {
          stripeCustomerId: true,
          stripeSubscriptionId: true,
          paymentStatus: true,
          plan: true,
        },
      },
    },
  });

  if (!user) {
    console.log(`Postgres: no user for ${email}`);
    await prisma.$disconnect();
    return null;
  }

  if (user.role !== "MEMBER") {
    console.error(`Refusing to purge non-MEMBER role=${user.role}`);
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log(
    `Postgres user: ${user.email} (${user.id}) plan=${user.memberProfile?.plan || "—"} payment=${user.memberProfile?.paymentStatus || "—"}`,
  );

  await cancelStripeSubs(
    user.memberProfile?.stripeCustomerId,
    user.memberProfile?.stripeSubscriptionId,
  );

  const id = user.id;

  const classRows = await prisma.coachTodaySession.findMany();
  for (const row of classRows) {
    if (!row.userIds.includes(id)) continue;
    const next = row.userIds.filter((uid) => uid !== id);
    if (!DRY_RUN) {
      await prisma.coachTodaySession.update({
        where: { id: row.id },
        data: { userIds: next },
      });
    }
    console.log(`  class ${row.sessionDate} "${row.title}": pulled off roster`);
  }

  // Null out optional FKs that don't cascade
  await prisma.factSubscriptionPayment.updateMany({
    where: { userId: id },
    data: { userId: null },
  });
  await prisma.analyticsEvent.updateMany({
    where: { userId: id },
    data: { userId: null },
  });
  await prisma.analyticsSession.updateMany({
    where: { userId: id },
    data: { userId: null },
  });
  await prisma.outboundNotification.updateMany({
    where: { userId: id },
    data: { userId: null },
  });

  const threads = await prisma.coachChatThread.findMany({
    where: { memberId: id },
    select: { id: true },
  });
  if (threads.length) {
    const tids = threads.map((t) => t.id);
    if (!DRY_RUN) {
      await prisma.coachChatMessage.deleteMany({ where: { threadId: { in: tids } } });
      await prisma.coachChatThread.deleteMany({ where: { id: { in: tids } } });
    }
    console.log(`  chat threads: ${threads.length}`);
  }

  if (!DRY_RUN) {
    await prisma.customTrainingOffer.deleteMany({
      where: { OR: [{ memberUserId: id }, { memberEmail: email }] },
    });
    // Cascade should wipe profile, enrollments, logs, equipment, etc.
    await prisma.user.delete({ where: { id } });
    console.log("  ✓ Postgres user deleted (cascade children)");
  } else {
    console.log("  DRY_RUN — would delete user + cascade");
  }

  await prisma.$disconnect();
  return user;
}

async function main() {
  console.log(`\n══ Full purge ${emailArg}${DRY_RUN ? " (DRY RUN)" : ""} ══\n`);

  await purgePostgres(emailArg);

  try {
    if (DRY_RUN) {
      console.log("\nBlob: skip write in DRY_RUN");
    } else {
      console.log("\nBlob stores…");
      const blob = await fullyResetMemberByEmail(emailArg);
      console.log(JSON.stringify(blob, null, 2));
    }
  } catch (e) {
    console.warn("Blob purge warning (ok if already DB-only):", e.message || e);
  }

  console.log(
    `\nDone. ${emailArg} can sign up fresh at https://www.thetrainstation.co/signup\n`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
