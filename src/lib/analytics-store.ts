import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { Prisma } from "@/generated/prisma/client";
import { isDatabaseConfigured } from "@/lib/database-config";
import { isDemoMode } from "@/lib/demo-exercises";
import { hydrateJsonStore, persistJsonStore } from "@/lib/demo-json-blob";
import type {
  AnalyticsEventInput,
  AnalyticsIngestPayload,
  AnalyticsSessionContext,
} from "@/lib/analytics-types";

const DEV_FILE = path.join(process.cwd(), "prisma", "analytics-events.dev.json");
const BLOB_PATH = "demo/analytics-events.json";
const MAX_DEMO_EVENTS = 20_000;

type StoredAnalyticsEvent = AnalyticsEventInput & {
  id: string;
  userId?: string | null;
  role?: string | null;
  sessionKey: string;
  ingestedAt: string;
};

type DemoAnalyticsStore = {
  sessions: Record<
    string,
    AnalyticsSessionContext & {
      userId?: string | null;
      lastActivityAt: string;
      startedAt: string;
    }
  >;
  events: StoredAnalyticsEvent[];
};

let demoMemory: DemoAnalyticsStore | null = null;

function emptyStore(): DemoAnalyticsStore {
  return { sessions: {}, events: [] };
}

function setDemoMemory(store: DemoAnalyticsStore) {
  demoMemory = store;
}

function trimDemoEvents(store: DemoAnalyticsStore): DemoAnalyticsStore {
  if (store.events.length <= MAX_DEMO_EVENTS) return store;
  return {
    ...store,
    events: store.events.slice(-MAX_DEMO_EVENTS),
  };
}

async function loadDemoStore(): Promise<DemoAnalyticsStore> {
  const loaded = await hydrateJsonStore<DemoAnalyticsStore>({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    memory: demoMemory,
    setMemory: setDemoMemory,
    fallback: emptyStore,
    preferFresh: true,
  });
  return Array.isArray(loaded.events) ? loaded : emptyStore();
}

async function saveDemoStore(store: DemoAnalyticsStore): Promise<boolean> {
  const trimmed = trimDemoEvents(store);
  demoMemory = trimmed;
  const { blobSaved } = await persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    data: trimmed,
    setMemory: setDemoMemory,
  });
  return blobSaved || !process.env.VERCEL;
}

function inferPageSection(pagePath?: string): string | null {
  if (!pagePath) return null;
  if (pagePath.startsWith("/admin")) return "admin";
  if (pagePath.startsWith("/member")) return "member";
  if (pagePath.startsWith("/login") || pagePath.startsWith("/signup")) return "auth";
  if (pagePath === "/" || pagePath.startsWith("/join")) return "landing";
  return "other";
}

function sanitizeText(value?: string, max = 240): string | undefined {
  if (!value) return undefined;
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed) return undefined;
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

async function ingestToDatabase(
  payload: AnalyticsIngestPayload,
  userId: string | null,
  role: string | null,
): Promise<{ accepted: number }> {
  const { prisma } = await import("@/lib/prisma");
  const now = new Date();
  const sessionCtx = payload.session;

  let session = await prisma.analyticsSession.findUnique({
    where: { sessionKey: sessionCtx.sessionKey },
  });

  if (!session) {
    session = await prisma.analyticsSession.create({
      data: {
        sessionKey: sessionCtx.sessionKey,
        userId,
        anonymousId: sessionCtx.anonymousId,
        landingPath: sessionCtx.landingPath,
        referrer: sessionCtx.referrer,
        utmSource: sessionCtx.utmSource,
        utmMedium: sessionCtx.utmMedium,
        utmCampaign: sessionCtx.utmCampaign,
        utmTerm: sessionCtx.utmTerm,
        utmContent: sessionCtx.utmContent,
        deviceType: sessionCtx.deviceType,
        userAgent: sessionCtx.userAgent?.slice(0, 500),
        startedAt: now,
        lastActivityAt: now,
      },
    });
  } else {
    session = await prisma.analyticsSession.update({
      where: { id: session.id },
      data: {
        lastActivityAt: now,
        userId: userId ?? session.userId,
        deviceType: sessionCtx.deviceType ?? session.deviceType,
      },
    });
  }

  const rows = payload.events.slice(0, 50).map((event) => ({
    id: randomUUID(),
    sessionKey: sessionCtx.sessionKey,
    sessionId: session.id,
    eventType: event.eventType,
    occurredAt: event.occurredAt ? new Date(event.occurredAt) : now,
    userId: userId ?? undefined,
    anonymousId: sessionCtx.anonymousId,
    pagePath: event.pagePath,
    pageTitle: sanitizeText(event.pageTitle, 200),
    pageSection: event.pageSection ?? inferPageSection(event.pagePath) ?? undefined,
    referrer: event.referrer ?? sessionCtx.referrer,
    elementId: event.elementId,
    elementText: sanitizeText(event.elementText),
    elementRole: event.elementRole,
    clickHref: event.clickHref,
    clickAction: event.clickAction,
    programId: event.programId,
    programSlug: event.programSlug,
    workoutId: event.workoutId,
    exerciseId: event.exerciseId,
    enrollmentId: event.enrollmentId,
    tierSlug: event.tierSlug,
    utmSource: event.utmSource ?? sessionCtx.utmSource,
    utmMedium: event.utmMedium ?? sessionCtx.utmMedium,
    utmCampaign: event.utmCampaign ?? sessionCtx.utmCampaign,
    deviceType: event.deviceType ?? sessionCtx.deviceType,
    role: role ?? undefined,
    properties: (event.properties ?? undefined) as Prisma.InputJsonValue | undefined,
  }));

  if (rows.length > 0) {
    await prisma.analyticsEvent.createMany({ data: rows });
  }

  return { accepted: rows.length };
}

async function ingestToDemo(
  payload: AnalyticsIngestPayload,
  userId: string | null,
  role: string | null,
): Promise<{ accepted: number }> {
  const store = await loadDemoStore();
  const nowIso = new Date().toISOString();
  const sessionKey = payload.session.sessionKey;

  store.sessions[sessionKey] = {
    ...payload.session,
    userId,
    startedAt: store.sessions[sessionKey]?.startedAt ?? nowIso,
    lastActivityAt: nowIso,
  };

  const ingested: StoredAnalyticsEvent[] = payload.events.slice(0, 50).map((event) => ({
    ...event,
    id: randomUUID(),
    sessionKey,
    userId,
    role,
    ingestedAt: nowIso,
    pageSection: event.pageSection ?? inferPageSection(event.pagePath) ?? undefined,
    elementText: sanitizeText(event.elementText),
    pageTitle: sanitizeText(event.pageTitle, 200),
  }));

  store.events.push(...ingested);
  await saveDemoStore(store);
  return { accepted: ingested.length };
}

export async function ingestAnalyticsEvents(
  payload: AnalyticsIngestPayload,
  opts?: { userId?: string | null; role?: string | null },
): Promise<{ accepted: number; storage: "database" | "demo" }> {
  if (!payload.session?.sessionKey || !Array.isArray(payload.events)) {
    return { accepted: 0, storage: isDatabaseConfigured() ? "database" : "demo" };
  }

  const userId = opts?.userId ?? null;
  const role = opts?.role ?? null;

  if (isDatabaseConfigured() && !isDemoMode()) {
    const result = await ingestToDatabase(payload, userId, role);
    return { ...result, storage: "database" };
  }

  const result = await ingestToDemo(payload, userId, role);
  return { ...result, storage: "demo" };
}

export async function getAnalyticsOverview(days = 7): Promise<{
  storage: "database" | "demo";
  pageViews: number;
  pageClicks: number;
  uniqueSessions: number;
  topPages: Array<{ path: string; views: number }>;
  topClicks: Array<{ label: string; path: string; clicks: number }>;
  payments: { count: number; revenueCents: number };
}> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  if (isDatabaseConfigured() && !isDemoMode()) {
    const { prisma } = await import("@/lib/prisma");
    const [pageViews, pageClicks, sessions, payments] = await Promise.all([
      prisma.analyticsEvent.count({
        where: { eventType: "page_view", occurredAt: { gte: since } },
      }),
      prisma.analyticsEvent.count({
        where: { eventType: "page_click", occurredAt: { gte: since } },
      }),
      prisma.analyticsSession.count({
        where: { lastActivityAt: { gte: since } },
      }),
      prisma.factSubscriptionPayment.aggregate({
        where: { paidAt: { gte: since }, status: "paid" },
        _count: true,
        _sum: { amountCents: true },
      }),
    ]);

    const pageGroups = await prisma.analyticsEvent.groupBy({
      by: ["pagePath"],
      where: { eventType: "page_view", occurredAt: { gte: since }, pagePath: { not: null } },
      _count: true,
      orderBy: { _count: { pagePath: "desc" } },
      take: 10,
    });

    const clickGroups = await prisma.analyticsEvent.groupBy({
      by: ["elementText", "pagePath"],
      where: { eventType: "page_click", occurredAt: { gte: since } },
      _count: true,
      orderBy: { _count: { elementText: "desc" } },
      take: 10,
    });

    return {
      storage: "database",
      pageViews,
      pageClicks,
      uniqueSessions: sessions,
      topPages: pageGroups.map((g) => ({
        path: g.pagePath ?? "(unknown)",
        views: g._count,
      })),
      topClicks: clickGroups.map((g) => ({
        label: g.elementText ?? "(unnamed)",
        path: g.pagePath ?? "(unknown)",
        clicks: g._count,
      })),
      payments: {
        count: payments._count,
        revenueCents: payments._sum.amountCents ?? 0,
      },
    };
  }

  const store = await loadDemoStore();
  const recent = store.events.filter((e) => new Date(e.ingestedAt) >= since);
  const pageViews = recent.filter((e) => e.eventType === "page_view").length;
  const pageClicks = recent.filter((e) => e.eventType === "page_click").length;
  const sessionKeys = new Set(recent.map((e) => e.sessionKey));

  const pageCounts = new Map<string, number>();
  const clickCounts = new Map<string, { label: string; path: string; clicks: number }>();

  for (const e of recent) {
    if (e.eventType === "page_view" && e.pagePath) {
      pageCounts.set(e.pagePath, (pageCounts.get(e.pagePath) ?? 0) + 1);
    }
    if (e.eventType === "page_click") {
      const key = `${e.pagePath ?? ""}|${e.elementText ?? e.clickAction ?? ""}`;
      const row = clickCounts.get(key) ?? {
        label: e.elementText ?? e.clickAction ?? "(unnamed)",
        path: e.pagePath ?? "(unknown)",
        clicks: 0,
      };
      row.clicks += 1;
      clickCounts.set(key, row);
    }
  }

  return {
    storage: "demo",
    pageViews,
    pageClicks,
    uniqueSessions: sessionKeys.size,
    topPages: [...pageCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([path, views]) => ({ path, views })),
    topClicks: [...clickCounts.values()].sort((a, b) => b.clicks - a.clicks).slice(0, 10),
    payments: { count: 0, revenueCents: 0 },
  };
}