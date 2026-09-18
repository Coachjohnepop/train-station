import "server-only";

import {
  LANDING_AB_CONTROL,
  LANDING_AB_LIVE,
  LANDING_AB_META,
  LANDING_AB_VARIANTS,
  type LandingAbArmStatus,
  type LandingAbVariant,
} from "@/lib/landing-ab";
import { isDatabaseConfigured } from "@/lib/database-config";
import { isDemoMode } from "@/lib/demo-exercises";

export type { LandingAbArmStatus };

export type LandingAbArmRow = {
  variant: LandingAbVariant;
  letter: string;
  name: string;
  status: LandingAbArmStatus;
  sessions: number;
  clicks: number;
  signupHits: number;
};

export type LandingAbReport = {
  live: LandingAbVariant[];
  control: LandingAbVariant;
  arms: LandingAbArmRow[];
  liveTotalSessions: number;
};

function emptyReport(): LandingAbReport {
  return {
    live: [...LANDING_AB_LIVE],
    control: LANDING_AB_CONTROL,
    arms: LANDING_AB_VARIANTS.map((variant) => ({
      variant,
      ...LANDING_AB_META[variant],
      sessions: 0,
      clicks: 0,
      signupHits: 0,
    })),
    liveTotalSessions: 0,
  };
}

function isVariant(v: string | null | undefined): v is LandingAbVariant {
  return Boolean(v && (LANDING_AB_VARIANTS as readonly string[]).includes(v));
}

export async function getLandingAbReport(since: Date): Promise<LandingAbReport> {
  const base = emptyReport();
  if (!isDatabaseConfigured() || isDemoMode()) return base;

  const { prisma } = await import("@/lib/prisma");
  try {
    const sessionRows = await prisma.$queryRaw<
      Array<{ variant: string; sessions: bigint | number }>
    >`
      WITH first_ev AS (
        SELECT DISTINCT ON ("sessionKey")
          "sessionKey",
          properties->>'landingVariant' AS v
        FROM "AnalyticsEvent"
        WHERE "occurredAt" >= ${since}
          AND properties->>'landingVariant' IN ('tour', 'jeremy', 'floor', 'class')
          AND "sessionKey" IS NOT NULL
        ORDER BY "sessionKey", "occurredAt" ASC
      ),
      assigned AS (
        SELECT COALESCE(
          CASE
            WHEN s."utmContent" IN ('tour', 'jeremy', 'floor', 'class') THEN s."utmContent"
          END,
          f.v
        ) AS variant
        FROM "AnalyticsSession" s
        LEFT JOIN first_ev f ON f."sessionKey" = s."sessionKey"
        WHERE s."lastActivityAt" >= ${since}
      )
      SELECT variant, COUNT(*)::int AS sessions
      FROM assigned
      WHERE variant IS NOT NULL
      GROUP BY variant
    `;

    const eventRows = await prisma.$queryRaw<
      Array<{
        variant: string;
        clicks: bigint | number;
        signup_hits: bigint | number;
      }>
    >`
      SELECT
        properties->>'landingVariant' AS variant,
        COUNT(*) FILTER (WHERE "eventType" = 'page_click')::int AS clicks,
        COUNT(*) FILTER (
          WHERE COALESCE("clickHref", "pagePath", '') ILIKE '%signup%'
        )::int AS signup_hits
      FROM "AnalyticsEvent"
      WHERE "occurredAt" >= ${since}
        AND properties->>'landingVariant' IN ('tour', 'jeremy', 'floor', 'class')
      GROUP BY 1
    `;

    const byVariant = new Map(base.arms.map((a) => [a.variant, { ...a }]));
    for (const row of sessionRows) {
      if (!isVariant(row.variant)) continue;
      const arm = byVariant.get(row.variant);
      if (arm) arm.sessions = Number(row.sessions) || 0;
    }
    for (const row of eventRows) {
      if (!isVariant(row.variant)) continue;
      const arm = byVariant.get(row.variant);
      if (!arm) continue;
      arm.clicks = Number(row.clicks) || 0;
      arm.signupHits = Number(row.signup_hits) || 0;
    }

    const arms = LANDING_AB_VARIANTS.map((v) => byVariant.get(v)!);
    const liveTotalSessions = arms
      .filter((a) => (LANDING_AB_LIVE as readonly string[]).includes(a.variant))
      .reduce((n, a) => n + a.sessions, 0);

    return {
      live: [...LANDING_AB_LIVE],
      control: LANDING_AB_CONTROL,
      arms,
      liveTotalSessions,
    };
  } catch (e) {
    console.warn("[landing-ab-report]", e instanceof Error ? e.message : e);
    return base;
  }
}
