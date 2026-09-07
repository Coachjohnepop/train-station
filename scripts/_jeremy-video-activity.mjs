#!/usr/bin/env node
/**
 * Jeremy activity + intro-video writes (prod).
 *   MINUTES=240 npx tsx scripts/_jeremy-video-activity.mjs
 *   SINCE=2026-09-04T00:00:00-07:00 UNTIL=2026-09-05T00:00:00-07:00 npx tsx scripts/_jeremy-video-activity.mjs
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env", quiet: true });
dotenv.config({ path: ".env.go-prod", override: true, quiet: true });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { createPgPool } from "../src/lib/pg-connection.ts";

const MINUTES = Number(process.env.MINUTES || "240");
const SUBJECT = "jeremy@thetrainstation.co";

function fmt(d) {
  return new Date(d).toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    hour12: true,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg(createPgPool(process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL)),
  });

  const jeremy = await prisma.user.findFirst({
    where: { email: SUBJECT },
    select: { id: true, email: true, name: true, updatedAt: true },
  });
  console.log("JEREMY", JSON.stringify(jeremy, null, 2));
  if (!jeremy) {
    await prisma.$disconnect();
    process.exit(1);
  }

  const since = process.env.SINCE ? new Date(process.env.SINCE) : new Date(Date.now() - MINUTES * 60 * 1000);
  const until = process.env.UNTIL ? new Date(process.env.UNTIL) : new Date();
  console.log("WINDOW", since.toISOString(), "→", until.toISOString());

  const events = await prisma.analyticsEvent.findMany({
    where: { userId: jeremy.id, occurredAt: { gte: since, lte: until } },
    orderBy: { occurredAt: "asc" },
    select: {
      occurredAt: true,
      eventType: true,
      pagePath: true,
      pageTitle: true,
      elementText: true,
      clickAction: true,
      clickHref: true,
      deviceType: true,
      properties: true,
    },
    take: 800,
  });
  console.log("\n=== ANALYTICS", events.length, "events ===");
  for (const e of events) {
    const bits = [
      fmt(e.occurredAt),
      e.eventType,
      e.pagePath || "",
      e.elementText || e.clickAction || "",
      e.clickHref || "",
      e.deviceType || "",
    ].filter(Boolean);
    console.log(bits.join(" | "));
  }

  const lastAny = await prisma.analyticsEvent.findFirst({
    where: { userId: jeremy.id },
    orderBy: { occurredAt: "desc" },
    select: {
      occurredAt: true,
      eventType: true,
      pagePath: true,
      elementText: true,
      clickAction: true,
      deviceType: true,
    },
  });
  console.log("\n=== LAST JEREMY EVENT EVER ===");
  console.log(
    lastAny
      ? `${fmt(lastAny.occurredAt)} ${lastAny.eventType} ${lastAny.pagePath} ${lastAny.elementText || lastAny.clickAction || ""} ${lastAny.deviceType || ""}`
      : "none",
  );

  // last 14 days of videos-related
  const since14 = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const recentVideo = await prisma.analyticsEvent.findMany({
    where: {
      userId: jeremy.id,
      occurredAt: { gte: since14 },
      OR: [
        { pagePath: { contains: "video" } },
        { pagePath: { contains: "landing" } },
        { clickHref: { contains: "video" } },
        { elementText: { contains: "Upload" } },
        { elementText: { contains: "Replace" } },
        { clickAction: { contains: "upload" } },
      ],
    },
    orderBy: { occurredAt: "desc" },
    take: 80,
    select: {
      occurredAt: true,
      eventType: true,
      pagePath: true,
      elementText: true,
      clickAction: true,
      clickHref: true,
      deviceType: true,
    },
  });
  console.log("\n=== LAST 14d video/landing ===", recentVideo.length);
  for (const e of recentVideo) {
    console.log(
      fmt(e.occurredAt),
      e.eventType,
      e.pagePath,
      e.elementText,
      e.clickAction,
      e.clickHref,
      e.deviceType,
    );
  }

  const landing = await prisma.landingMediaSettings.findUnique({ where: { id: "default" } });
  console.log("\n=== LandingMediaSettings updatedAt ===", landing?.updatedAt.toISOString());

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
