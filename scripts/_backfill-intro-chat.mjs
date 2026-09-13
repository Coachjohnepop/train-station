#!/usr/bin/env node
/**
 * Post the Calendly 1:1 Messages pair for recent confirmed intros.
 *
 *   node scripts/_backfill-intro-chat.mjs
 */
import { randomUUID } from "node:crypto";
import dotenv from "dotenv";
dotenv.config({ path: ".env", quiet: true });
dotenv.config({ path: ".env.go-prod", override: true, quiet: true });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { createPgPool } from "../src/lib/pg-connection.ts";

const TZ = "America/Los_Angeles";

function formatWhen(d) {
  if (!d) return "Time chosen in Calendly — check your confirmation email for the exact slot";
  return new Date(d).toLocaleString("en-US", {
    timeZone: TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

async function main() {
  const pool = createPgPool(process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL);
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

  const bookings = await prisma.booking.findMany({
    where: {
      status: { not: "cancelled" },
      OR: [{ scheduledAt: { gte: since } }, { createdAt: { gte: since } }],
    },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { scheduledAt: "desc" },
  });

  let posted = 0;
  for (const b of bookings) {
    let userId = b.userId;
    if (!userId && b.memberEmail) {
      const u = await prisma.user.findFirst({
        where: { email: { equals: b.memberEmail, mode: "insensitive" } },
        select: { id: true, name: true },
      });
      userId = u?.id || null;
      if (u && !b.user) b.user = u;
    }
    if (!userId) {
      console.log("skip (no member account)", b.memberEmail);
      continue;
    }
    const name = b.user?.name || b.memberEmail || "Member";
    const suffix = (b.calendlyInviteeUri || b.scheduledAt.toISOString()).slice(0, 72);
    const category = `coach-once:intro-chat:${suffix}`.slice(0, 80);

    const existing = await prisma.outboundNotification.findFirst({
      where: { userId, category, status: "sent" },
      select: { id: true },
    });
    if (existing) {
      console.log("skip (already posted)", name);
      continue;
    }

    const threadId = `thread-member-${userId}`;
    const now = new Date();
    await prisma.coachChatThread.upsert({
      where: { id: threadId },
      create: {
        id: threadId,
        kind: "member",
        memberId: userId,
        title: name,
        createdAt: now,
        updatedAt: now,
      },
      update: { updatedAt: now, title: name },
    });

    const when = formatWhen(b.scheduledAt);
    await prisma.coachChatMessage.create({
      data: {
        id: randomUUID(),
        threadId,
        authorRole: "coach",
        authorId: "demo-coach-jeremy",
        authorName: "Coach Jeremy",
        kind: "text",
        body: `You're booked with me.\n\n${when}\n\nI'll see you then — reply here if you need to move it.`,
        alertSent: false,
        readByUserIds: ["coach"],
        createdAt: now,
      },
    });
    await prisma.coachChatMessage.create({
      data: {
        id: randomUUID(),
        threadId,
        authorRole: "system",
        authorId: "system",
        authorName: "Train Station",
        kind: "system",
        body: `${name} booked a 15-min intro.\n\nWhen: ${when}`,
        alertSent: false,
        readByUserIds: [],
        createdAt: new Date(now.getTime() + 1000),
      },
    });
    await prisma.outboundNotification.create({
      data: {
        channel: "in_app",
        category,
        status: "sent",
        userId,
        subject: `claim:intro-chat:${suffix}`.slice(0, 120),
        bodyPreview: "coach notify once claim",
        provider: "coach-notify-once",
      },
    });
    posted += 1;
    console.log("posted", name, when);
  }

  console.log(`done · posted ${posted} of ${bookings.length} recent bookings`);
  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
