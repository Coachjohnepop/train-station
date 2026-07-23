#!/usr/bin/env node
/**
 * Member data export pack (DSAR / M&A privacy sample).
 *
 *   # With production env (hide local .env that shadows secrets):
 *   mv .env.local /tmp/ && vercel env run --environment production -- \
 *     npx tsx scripts/export-member-dsar.mjs --email member@example.com
 *
 *   Or:
 *   DATABASE_URL=… npx tsx scripts/export-member-dsar.mjs --user-id <id>
 *
 * Writes JSON to exports/dsar-<id>-<timestamp>.json (gitignored folder preferred).
 */
import fs from "fs";
import path from "path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createPgPool } from "../src/lib/pg-connection";

function arg(name) {
  const i = process.argv.indexOf(name);
  if (i < 0) return null;
  return process.argv[i + 1] || null;
}

const email = arg("--email")?.trim().toLowerCase();
const userIdArg = arg("--user-id")?.trim();
if (!email && !userIdArg) {
  console.error("Usage: --email user@x.com  OR  --user-id <id>");
  process.exit(1);
}

const url =
  process.env.POSTGRES_PRISMA_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  "";
if (!url || url.includes("dummy")) {
  console.error("Need real DATABASE_URL / POSTGRES_PRISMA_URL");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg(createPgPool(url)) });

async function main() {
  const user = email
    ? await prisma.user.findUnique({ where: { email } })
    : await prisma.user.findUnique({ where: { id: userIdArg } });

  if (!user) {
    console.error("User not found");
    process.exit(1);
  }

  const userId = user.id;
  const [
    profile,
    enrollments,
    workoutLogs,
    performances,
    measurements,
    equipment,
    weatherLogs,
    oauth,
    pushSubs,
    smsLogs,
    bookings,
    chatMessages,
    chatThreads,
    gamiEvents,
    gamiScores,
    gamiPromos,
    gamiPrizes,
    paymentFacts,
    auditAsActor,
  ] = await Promise.all([
    prisma.memberProfile.findUnique({ where: { userId } }).catch(() => null),
    prisma.programEnrollment.findMany({ where: { userId } }).catch(() => []),
    prisma.workoutLog.findMany({ where: { userId }, take: 500, orderBy: { performedAt: "desc" } }).catch(() => []),
    prisma.exercisePerformance
      .findMany({ where: { userId }, take: 1000, orderBy: { performedAt: "desc" } })
      .catch(() => []),
    prisma.userMeasurement.findMany({ where: { userId } }).catch(() => []),
    prisma.userEquipment.findMany({ where: { userId } }).catch(() => []),
    prisma.userWeatherLog.findMany({ where: { userId }, take: 200 }).catch(() => []),
    prisma.oAuthIdentity.findMany({ where: { userId } }).catch(() => []),
    prisma.webPushSubscription.findMany({ where: { userId } }).catch(() => []),
    prisma.smsLog.findMany({ where: { userId }, take: 500, orderBy: { sentAt: "desc" } }).catch(() => []),
    prisma.booking.findMany({ where: { userId } }).catch(() => []),
    prisma.coachChatMessage
      .findMany({
        where: {
          OR: [{ authorId: userId }, { thread: { memberId: userId } }],
        },
        take: 1000,
        orderBy: { createdAt: "desc" },
      })
      .catch(() => []),
    prisma.coachChatThread.findMany({ where: { memberId: userId } }).catch(() => []),
    prisma.gamificationEvent.findMany({ where: { userId }, take: 2000, orderBy: { at: "desc" } }).catch(() => []),
    prisma.gamificationSeasonScore.findMany({ where: { userId } }).catch(() => []),
    prisma.gamificationPromo.findMany({ where: { userId } }).catch(() => []),
    prisma.gamificationPrizeAward.findMany({ where: { userId } }).catch(() => []),
    prisma.factSubscriptionPayment.findMany({ where: { userId }, take: 200, orderBy: { paidAt: "desc" } }).catch(() => []),
    prisma.auditEvent
      .findMany({ where: { actorUserId: userId }, take: 200, orderBy: { occurredAt: "desc" } })
      .catch(() => []),
  ]);

  // Strip secrets from OAuth / push
  const oauthSafe = (oauth || []).map((o) => ({
    id: o.id,
    provider: o.provider,
    providerUserId: o.providerUserId,
    linkedAt: o.linkedAt,
  }));
  const pushSafe = (pushSubs || []).map((p) => ({
    id: p.id,
    endpointHost: (() => {
      try {
        return new URL(p.endpoint).host;
      } catch {
        return "unknown";
      }
    })(),
    createdAt: p.createdAt,
  }));

  const pack = {
    exportedAt: new Date().toISOString(),
    purpose: "DSAR / M&A privacy sample — Train Station member pack",
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      phoneE164: user.phoneE164,
      role: user.role,
      status: user.status,
      hidden: user.hidden,
      city: user.city,
      state: user.state,
      birthdate: user.birthdate,
      goals: user.goals,
      smsConsentAt: user.smsConsentAt,
      smsOptOutAt: user.smsOptOutAt,
      smsOptInAt: user.smsOptInAt,
      createdAt: user.createdAt,
      registeredAt: user.registeredAt,
      // never export passwordHash
    },
    memberProfile: profile,
    enrollments,
    workoutLogs,
    exercisePerformances: performances,
    measurements,
    homeEquipment: equipment,
    weatherLogs,
    oauthIdentities: oauthSafe,
    webPushSubscriptions: pushSafe,
    smsLogs,
    bookings,
    chatThreads,
    chatMessages,
    gamification: {
      events: gamiEvents,
      seasonScores: gamiScores,
      promos: gamiPromos,
      prizes: gamiPrizes,
    },
    subscriptionPaymentFacts: paymentFacts,
    auditEventsAsActor: auditAsActor,
  };

  const outDir = path.join(process.cwd(), "exports");
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = path.join(outDir, `dsar-${userId.slice(0, 12)}-${stamp}.json`);
  fs.writeFileSync(outPath, JSON.stringify(pack, null, 2));
  console.log("Wrote", outPath);
  console.log(
    JSON.stringify(
      {
        userId,
        email: user.email,
        counts: {
          workoutLogs: workoutLogs?.length ?? 0,
          performances: performances?.length ?? 0,
          chatMessages: chatMessages?.length ?? 0,
          gamiEvents: gamiEvents?.length ?? 0,
          paymentFacts: paymentFacts?.length ?? 0,
        },
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
